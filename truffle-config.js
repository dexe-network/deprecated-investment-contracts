"use strict";
// const ApiKey = process.env.INFURA_API_KEY || require('./network_keys/api/infura');
// const { infuraApiKey, mnemonic } = require('./network_keys/secrets.json');
const HDWalletProvider = require("@truffle/hdwallet-provider");
const infuraApiKey = "";

const Infura = {
  Mainnet: "https://mainnet.infura.io/v3/" + infuraApiKey,
  Ropsten: "https://ropsten.infura.io/v3/" + infuraApiKey,
  Rinkeby: "https://rinkeby.infura.io/v3/" + infuraApiKey,
  Kovan: "https://kovan.infura.io/v3/" + infuraApiKey,
  BSC: "https://bsc-dataseed1.binance.org "
};
// const Wallets = require('./network_keys/private/wallets');
// const Provider = require('truffle-privatekey-provider');

module.exports = {
  networks: {
    bsc_test: {
      host: "127.0.0.1",
      port: 8545,
      // network_id: 55, // 5777 Match Ganache(Truffle) network id
      network_id: 56, //Match Ganache(Truffle) network id
      // provider: () => new HDWalletProvider(mnemonic, Infura.BSC),
      //provider: () => new Provider('88197d4cac39375094dab1cfd7e302a0874a342ed6a1a965a8d8e4e381327eb1', 'http://127.0.0.1:8545'),
      gas: 15000000,
    },
    test: {
      host: "127.0.0.1",
      port: 8545,
      // network_id: 55, // 5777 Match Ganache(Truffle) network id
      network_id: 5777, //Match Ganache(Truffle) network id
      // provider: () => new HDWalletProvider(mnemonic, Infura.BSC),
      //provider: () => new Provider('88197d4cac39375094dab1cfd7e302a0874a342ed6a1a965a8d8e4e381327eb1', 'http://127.0.0.1:8545'),
      gas: 4000000000,
      networkCheckTimeout: 10000000
    },
    rinkeby: {
      network_id: 4,
      provider: () => new HDWalletProvider(mnemonic, Infura.Rinkeby),
      gas: 10000000,
      gasPrice: '1000000000'
    },
    mainnet: {
      network_id: 1,
      provider: () => new HDWalletProvider(mnemonic, Infura.Mainnet),
      gas: 10000000,
      gasPrice: '8000000000'
    },
    ropsten: {
      network_id: 3,
      provider: () => new HDWalletProvider(mnemonic, Infura.Ropsten),
      gas: 5000000,
      gasPrice: '6000000000'
    },
    kovan: {
      network_id: 1,
      provider: () => new HDWalletProvider(mnemonic, Infura.Kovan),
      gas: 10000000,
    },
    bsc: {
      provider: () => new HDWalletProvider(mnemonic, 'https://bsc-dataseed1.binance.org'),
      network_id: 56,
      // confirmations: 10,
      timeoutBlocks: 200,
      gas: 10000000,
      gasPrice: 10000000000
      // skipDryRun: false
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // reporter: 'eth-gas-reporter',
    //     reporterOptions : {
    //         currency: 'USD',
    //         gasPrice: 5
    //     }
  },
  compilers: {
    solc: {
      version: "0.6.8",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: true,
         runs: 200
       },
      //  evmVersion: "byzantium"
      }
    },
  },
};
