// Import the token list from tokenList.js
const tokenList = require('./tokenList')
const axios = require('axios')
const {ethers, JsonRpcProvider } = require('ethers');
const ABI = require('../artifacts/contracts/Trident.sol/Trident.json');
const contractABI = ABI.abi;
const snarkjs = require("snarkjs");
const provider = new JsonRpcProvider('https://polygon.llamarpc.com');
const dotenv = require('dotenv')
dotenv.config();
const privateKey = process.env.PRIVATE_KEY;
const fs = require('fs');
const signer = new ethers.Wallet(privateKey, provider);

const {
  getRandomTokenSet,
  createAllTokenPairs,
  getPricesForPairs,
  findFloydArbitrageOpportunities,
  findArbitrageOpportunities,
  Edge,
  getTxData,
} = require('./functions');

const contractAddress = '0xb153cdf653aa997a99d0d3eed76bef94fc333889';
const tokenSelect = tokenList.WMATIC;
const token = tokenSelect.address;
let amount = ethers.parseUnits('1000', tokenSelect.decimals);
const gasLimit = ethers.parseUnits("16000000", "wei");

async function runArbitrageDetection() {
  const tokenSet = getRandomTokenSet();
  const tokenPairs = createAllTokenPairs(tokenSet);
  const weights = await getPricesForPairs(tokenPairs);
  const edges = tokenPairs.map((pair, index) => (
    new Edge(pair[0], pair[1], weights[index])
  ));

const floydOpportunities = findFloydArbitrageOpportunities(tokenSet, edges);
console.log("Floyd-Warshall Arbitrage Opportunities:", floydOpportunities);
const bellmanFordOpportunities = findArbitrageOpportunities(tokenSet, edges);
console.log("Bellman-Ford Arbitrage Opportunities:", bellmanFordOpportunities);

const arbitrageOpportunities = floydOpportunities.concat(bellmanFordOpportunities);
  if (arbitrageOpportunities.length > 0) {
    fs.appendFileSync('results.txt', `Arbitrage Opportunities: ${JSON.stringify(arbitrageOpportunities)}\n`);
    let i = 0;
    while (i < arbitrageOpportunities.length) {
      try {
        const firstOpportunity = arbitrageOpportunities[i];
        console.log("First opportunity", firstOpportunity)
        const routing = firstOpportunity.map(symbol => tokenList[symbol].address);
        // Initialize txData array
        let txData = [];
        let initialDstAmount = amount;
        let finalDstAmount = null;

        const routes = [];
        if (token != routing[0]) {
          let firstSwapData = await getTxData(
            [token, routing[0]],
            amount,
            contractAddress
          );
          txData.push(firstSwapData);
          console.log("First swap done")
          routes.push(token);
        }
        if (routing.length > 0) {
          let j = 0;
          let pairs = [];
          while (j < routing.length - 1) {
            pairs.push([routing[j], routing[j + 1]]); // Use array of addresses instead of string
            let pairData = await getTxData(pairs[j], amount, contractAddress); // Await the completion of getTxData
            txData.push(pairData); // Store the data for each pair
            amount = pairData.dstAmount;
            routes.push(routing[j]);
            console.log("Next swap done");
            // Introduce a delay after each iteration (except for the last one)
            if (j < routing.length - 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
            j++;
          }
          routes.push(routing[j]);
        }
        if (routing[routing.length - 1] != token) {
          let lastSwapData = await getTxData(
            [routing[routing.length - 1], token],
            amount,
            contractAddress
          );
          finalDstAmount = lastSwapData.dstAmount;
          txData.push(lastSwapData);
          console.log("Last swap done")
          routes.push(token);
        }

        // Map each element of txData to its data.tx.data field
        const txDataArray = txData.map((data) => `0x${data.tx.data.slice(10)}`);

          // Connect Flashloan Contract
          const contract = new ethers.Contract(
            contractAddress,
            contractABI,
            signer
          );

          // Send Flashloan Transaction with a specified gas limit
          const txFlashLoan = await contract.requestFlashLoan(
          token,
          initialDstAmount,
          routes,
          txDataArray, // Pass the encoded txData
          {
            gasLimit: gasLimit,
            // gasPrice: ethers.parseUnits("35", 9),
            maxPriorityFeePerGas: ethers.parseUnits("55", 9),
            maxFeePerGas: ethers.parseUnits("55", 9),
            maxFeePerBlobGas: null
          } // Specify the gas limit hereecify the gas limit here
          );
        // Record results
        let results = {
          'token': token,
          'routing': routing,
          'txDataArray': txDataArray,
          'initialDstAmount': initialDstAmount.toString(),
          'Final Amount': finalDstAmount.toString(),
        };
        fs.appendFileSync('results.txt', `${JSON.stringify(results)}\n`);
          // Show Results
          const txFlashLoanReceipt = await txFlashLoan.wait();
          expect(txFlashLoanReceipt.status).to.eql(1);

      } catch (error) {
        fs.appendFileSync('errors.txt', `${error}`);
        console.log(error);
      }
      i++;
    }
  
  } else {
    console.log('No arbitrage opportunities found.');
  }
}


// Run the arbitrage detection continuously
(async () => {
  while (true) {
    try {
      await runArbitrageDetection();
    } catch (error) {
      console.error('Error during arbitrage detection:', error);
    }
    // Delay before the next iteration (adjust the delay as needed)
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds delay
  }
})();