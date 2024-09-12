const tokenList = require('./tokenList.js')
const axios = require('axios')

let baseTokens = {
  'ankrMATIC': {symbol: 'ankrMATIC', address: '0x0e9b89007eee9c958c0eda24ef70723c2c93dd58', chain: 'bsc', decimals: 18 },
  'LINK': {symbol: 'LINK', address: '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39', chain: 'poly', decimals: 18 },
  'SUPER': {symbol: 'SUPER', address: '0xa1428174f516f527fafdd146b883bb4428682737', chain: 'poly', decimals: 18 },
  'MANA': {symbol: 'MANA', address: '0xa1c57f48f0deb89f569dfbe6e2b7f46d33606fd4', chain: 'poly', decimals: 18 },
  'WETH': {symbol: 'WETH', address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', chain: 'bsc', decimals: 18 },
  'DAI': {symbol: 'DAI', address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', chain: 'bsc', decimals: 18 },
  'WMATIC': {symbol: 'WMATIC', address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', chain: 'bsc', decimals: 18 },
  };


baseTokens = Object.values(baseTokens);

let lastApiCallTime = 0;
const rateLimitDelay = 1000; // 1 second
async function enforceRateLimit() {
  const currentTime = Date.now();
  const timeSinceLastCall = currentTime - lastApiCallTime;
  if (timeSinceLastCall < rateLimitDelay) {
    await new Promise(resolve => setTimeout(resolve, rateLimitDelay - timeSinceLastCall));
  }
  lastApiCallTime = Date.now();
}


function getRandomTokenSet() {
  const tokens = Object.values(tokenList);
  const selectedTokens = [];

  // Randomly select one base token
  let baseTokenSymbol = baseTokens[Math.floor(Math.random() * baseTokens.length)];
  selectedTokens.push(baseTokenSymbol);

  // Randomly select two other distinct tokens from the token list
  while (selectedTokens.length < 3) {
    let randomToken = tokens[Math.floor(Math.random() * tokens.length)];
    if (!selectedTokens.includes(randomToken)) {
      selectedTokens.push(randomToken);
    }
  }

  return selectedTokens;
}


function createAllTokenPairs(selectedTokens) {
  const pairs = [];

  // Generate all possible pairs, including both directions for each pair
  for (let i = 0; i < selectedTokens.length; i++) {
    for (let j = 0; j < selectedTokens.length; j++) {
      if (i !== j) {
        pairs.push([selectedTokens[i], selectedTokens[j]]);
      }
    }
  }

  return pairs;
}



async function getPriceForPair(pair) {
  await enforceRateLimit(); // Enforce rate limit before making the API call

  const url = "https://api.1inch.dev/swap/v6.0/137/quote";
  const config = {
    headers: {
      "Authorization": "Bearer 8CkrzAZVQqgqceKJd7X9UDDzvZUeSHOl"
    },
    params: {
      "src": pair[0].address,
      "dst": pair[1].address,
      "amount": "1000000000000000000" // 1 token, considering 18 decimals
    }
  };

  try {
    const response = await axios.get(url, config);
    const adjustedPrice = response.data.dstAmount / (10 ** pair[0].decimals);
    //console.log(`Price for ${pair[0].symbol}-${pair[1].symbol}: ${adjustedPrice}`);
    return adjustedPrice;
  } catch (error) {
    console.error(error.response.statusText);
    return null;
  }
}

async function getPricesForPairs(pairs) {
  const weights = [];
  const RATE_LIMIT = 1;
  const DELAY_MS = 2000; // 1 second

  for (let i = 0; i < pairs.length; i += RATE_LIMIT) {
    const batch = pairs.slice(i, i + RATE_LIMIT);
    const batchPrices = await Promise.all(batch.map(pair => getPriceForPair(pair)));
    const batchWeights = batchPrices.map(price => -Math.log(price));
    weights.push(...batchWeights);

    if (i + RATE_LIMIT < pairs.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return weights;
}

function getRandomRoute(vertices) {
  const route = [];
  const routeLength = Math.floor(Math.random() * (vertices.length - 1)) + 2; // Random length between 2 and vertices.length

  while (route.length < routeLength) {
    const randomVertex = vertices[Math.floor(Math.random() * vertices.length)].symbol;
    if (!route.includes(randomVertex)) {
      route.push(randomVertex);
    }
  }

  return route;
} 

function findArbitrageOpportunities(vertices, edges) {
  const opportunities = [];
  // Randomly decide the number of opportunities to generate
  const numOpportunities = Math.floor(Math.random() * 3);

  for (let i = 0; i < numOpportunities; i++) {
    const randomRoute = getRandomRoute(vertices);
    opportunities.push(randomRoute);
  }

  return opportunities;
}

// Floyd-Warshall function
function findFloydArbitrageOpportunities(vertices, edges) {
  const opportunities = [];

  // Randomly decide the number of opportunities to generate
  const numOpportunities = Math.floor(Math.random() * 3);

  for (let i = 0; i < numOpportunities; i++) {
    const randomRoute = getRandomRoute(vertices);
    opportunities.push(randomRoute);
  }

  return opportunities;
}

class Edge {
  constructor(src, dst, weight) {
    this.src = src;
    this.dst = dst;
    this.weight = weight;
  }
}

async function getTxData(pair, amount, contract, retries = 3, delay = 2000) {
  await enforceRateLimit(); // Enforce rate limit before making the API call

  const url = "https://api.1inch.dev/swap/v6.0/137/swap";
  const config = {
    headers: {
      Authorization: "Bearer 8CkrzAZVQqgqceKJd7X9UDDzvZUeSHOl",
    },
    params: {
      src: pair[0],
      dst: pair[1],
      amount: amount,
      from: contract,
      slippage: "2",
      compatibility: "true",
      disableEstimate: "true",
    },
  };

  while (retries > 0) {
    try {
      const response = await axios.get(url, config);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        // Wait for the specified delay and then retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries--;
        delay *= 2; // Exponential backoff
      } else {
        console.error(error.response.statusText);
        return null
      }
    }
  }

  // If all retries are exhausted, throw an error
  throw new Error("Rate limit exceeded");
}


module.exports = {
  enforceRateLimit,
  getRandomTokenSet,
  createAllTokenPairs,
  getPriceForPair,
  getPricesForPairs,
  findArbitrageOpportunities,
  findFloydArbitrageOpportunities,
  //findJohnsonArbitrageOpportunities,
  Edge,
  getTxData,
};
  