# Research Project

Make sure you create a .env file containing the following:

```shell
MAINNET = https://polygon.llamarpc.com
TESTNET = https://polygon-mumbai.g.alchemy.com/v2/CicNdRk9ovNIbZEO2aRvXDaAsrTXeSzl
PRIVATE_KEY = ##
WALLET = ##
```

Start by running:

```shell
npm i
```
Compile smart contract by running:

```shell
npx hardhat compile
```

Next go to the scripts folder and run the main file
```shell
cd scripts/
node execute
```