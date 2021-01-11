"use strict";
const ApiKey = process.env.INFURA_API_KEY || require('./network_keys/api/infura');
const Infura = {
  Mainnet: "https://mainnet.infura.io/v3/" + ApiKey,
  Ropsten: "https://ropsten.infura.io/v3/" + ApiKey,
  Rinkeby: "https://rinkeby.infura.io/v3/" + ApiKey,
  Kovan: "https://kovan.infura.io/v3/" + ApiKey
};
const Wallets = require('./network_keys/private/wallets');
const Provider = require('truffle-privatekey-provider');

module.exports = {
  networks: {
    test: {
      host: "127.0.0.1",
      port: 8545,
      network_id: 5777, // Match Ganache(Truffle) network id
      //provider: () => new Provider('88197d4cac39375094dab1cfd7e302a0874a342ed6a1a965a8d8e4e381327eb1', 'http://127.0.0.1:8545'),
      gas: 8000000,
    },
    rinkeby: {
      network_id: 4,
      provider: () => new Provider(Wallets.Rinkeby, Infura.Rinkeby),
      gas: 4712388,
      gasPrice: '1000000000'
    },
    mainnet: {
      network_id: 1,
      provider: () => new Provider(Wallets.Mainnet, Infura.Mainnet),
      gas: 5000000,
      gasPrice: '8000000000'
    },
    ropsten: {
      network_id: 3,
      provider: () => new Provider(Wallets.Ropsten, Infura.Ropsten),
      gas: 5000000,
      gasPrice: '6000000000'
    },
    kovan: {
      network_id: 1,
      provider: () => new Provider(Wallets.Kovan, Infura.Kovan),
      gas: 5000000,
    }
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
      version: "0.6.6",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: true,
         runs: 999
       },
      //  evmVersion: "byzantium"
      }
    },
  },
};
