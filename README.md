# ZK Minesweeper

An implementation of the popular Minesweeper game as a smart contract for the Bitcoin blockchain. ZK-SNARKS are used to keep information (i.e. mine locations) hidden.

> :warning: **Disclaimer**: This is a demo implementation. Currently both the players and game server logic run on the same client, namely the browser. In a production ready implementation the two should be separated.

# Setup

Install **sCrypt Compiler**:


Your can install **sCrypt Compiler** by installing [sCrypt IDE](https://marketplace.visualstudio.com/items?itemName=bsv-scrypt.sCrypt).

Or just install the compiler binary :

```
npm install
npx scryptlib download
```


Install the ZoKrates CLI:

```
curl -Ls https://scrypt.io/scripts/setup-zokrates.sh | sh
```

Setup and check the zkSNARK verifier:

```
npm run setup
```

# Start

```
npm run app:start
```

