import { bsv, getPreimage, buildContractClass, PubKey, toHex, Int, Bool, signTx} from 'scryptlib';
import { web3 } from './web3';

import { zokratesProof } from './zk';

import { ContractUtxos, initPlayer, ContractState, Player, PlayerPublicKey, PlayerPrivkey } from './storage.js';


const rewardAmount = 1000; // TODO: Make configurable.
  
let contract = undefined;

let program = undefined;
let abi = undefined;
let provingkey = undefined;

export async function initializeContract(fieldsMap) {
  initPlayer();
  
  // Fetch the outputs of ZoKrates.
  program = await fetch('/zk/out').then(resp => resp.arrayBuffer()).then(data => new Uint8Array(data));
  abi = await fetch('/zk/abi.json').then(resp => resp.json());
  provingkey = await fetch('/zk/proving.key').then(resp => resp.arrayBuffer()).then(data => new Uint8Array(data));

  // Fetch the desc file of our compiled contract.
  let desc = await fetch('/minesweeper_debug_desc.json').then(resp => resp.json());
  console.log(desc);
  const Minesweeper = buildContractClass(desc);

  const publicKeyPlayer = PlayerPublicKey.get(Player.You);
  const publicKeyServer = PlayerPublicKey.get(Player.Computer);
  
  contract = new Minesweeper(
      new PubKey(toHex(publicKeyPlayer)),
      new PubKey(toHex(publicKeyServer)),
      new Int(fieldsMap.mapCommit), 
      0,
      true,
      0, 0,
      rewardAmount
  );
  
  let contractState = {
    successfulReveals: 0,
    playersTurn: true,
    lastRevealX: 0,
    lastRevealY: 0
  };
  ContractState.set(contractState);
  
  try {
      ContractUtxos.clear();
      const rawTx = await web3.deploy(contract, rewardAmount);
      ContractUtxos.add(rawTx);

      const txid = ContractUtxos.getdeploy().utxo.txId
      console.log(txid);
   
      setTimeout(async () => {
        web3.wallet.getbalance().then(balance => {
          console.log('update balance:', balance)
        })
      }, 10000);
  } catch (error) {
    let msg = "Deploy contract error:" + error.message;
    alert(msg);
    throw new Error(msg);
  }
}

export async function callContractUpdateFunc(clickedField, fieldsMap) {
  const contractUtxo = ContractUtxos.getlast().utxo;
  
  let contractState = ContractState.get();
  
  contractUtxo.script = contract.lockingScript.toHex(); // TODO: this should already be set in the utxo?

  const Proof = contract.getTypeClassByType("Proof");
  const G1Point = contract.getTypeClassByType("G1Point");
  const G2Point = contract.getTypeClassByType("G2Point");
  const FQ2 = contract.getTypeClassByType("FQ2");

  // For the next tx, set playersTurn flag to true.
  // As it wasn't a mine also increment the score.
  let newState = {
    successfulReveals: clickedField.isMine ? contractState.successfulReveals + 1 : contractState.successfulReveals,
    playersTurn: true,
    lastRevealX: contractState.lastRevealX,
    lastRevealY: contractState.lastRevealY
  };
  
  const neighborMineCount = clickedField.bombsAround;
  const isMine = false;
  
  
  let {proof, output} = await zokratesProof(
    fieldsMap.mapInt,
    fieldsMap.mapCommit,
    contractState.lastRevealX, contractState.lastRevealY,
    isMine, neighborMineCount, 
    {
      program: program,
      abi: abi,
      provingkey: provingkey
    });

  return web3.call(contractUtxo, rewardAmount, async (tx) => {

    tx.setOutput(0, (tx) => {
      let newLockingScript = undefined;
      if (!clickedField.isMine) {
        newLockingScript = contract.getNewStateScript(newState);
      } else if (newState.successfulReveals >= fieldsMap.mapMineCount) {
        const privateKey = new bsv.PrivateKey.fromWIF(PlayerPrivkey.get(Player.You));
        newLockingScript = bsv.Script.buildPublicKeyHashOut(privateKey.toAddress())
      } else {
        const privateKey = new bsv.PrivateKey.fromWIF(PlayerPrivkey.get(Player.Computer));
        newLockingScript = bsv.Script.buildPublicKeyHashOut(privateKey.toAddress())
      }

      return new bsv.Transaction.Output({
        script: newLockingScript,
        satoshis: rewardAmount,
      });
    })

    tx.setInputScript(0, (tx, output) => {
      const Signature = bsv.crypto.Signature;
      const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID;
      const preimage = getPreimage(tx, output.script, output.satoshis, 0, sighashType);
      const privateKey = new bsv.PrivateKey.fromWIF(PlayerPrivkey.get(Player.Computer));
      const sig = signTx(tx, privateKey, output.script, output.satoshis);

      return contract.update(sig, isMine, neighborMineCount, new Proof({
          a: new G1Point({
            x: new Int(proof.proof.a[0]),
            y: new Int(proof.proof.a[1]),
          }),
          b: new G2Point({
            x: new FQ2({
              x: new Int(proof.proof.b[0][0]),
              y: new Int(proof.proof.b[0][1]),
            }),
            y: new FQ2({
              x: new Int(proof.proof.b[1][0]),
              y: new Int(proof.proof.b[1][1]),
            })
          }),
          c: new G1Point({
            x: new Int(proof.proof.c[0]),
            y: new Int(proof.proof.c[1]),
          })
        }), preimage).toScript();
    });
  }).then(async rawTx => {
    ContractUtxos.add(rawTx);
    ContractState.set(newState);
    
    contract.successfulReveals = newState.successfulReveals;
    contract.playersTurn = newState.playersTurn;
    contract.lastRevealX = newState.lastRevealX;
    contract.lastRevealY = newState.lastRevealY;
    
    setTimeout(async () => {
      web3.wallet.getbalance().then(balance => {
        console.log('update balance:', balance)
      })
    }, 5000);

  })
    .catch(e => {
      alert('Contract call failed.');
      console.log("error: ", e);
      throw new Error('Contract call failed.')
    })
}

export async function callContractRevealFunc(clickedField, fieldsMap) {
  const contractUtxo = ContractUtxos.getlast().utxo;
  
  let contractState = ContractState.get();
  
  contractUtxo.script = contract.lockingScript.toHex();

  let clickedX = clickedField.coords[0] - 1;
  let clickedY = clickedField.coords[1] - 1;

  // For the next tx, set playersTurn flag to false.
  // Other stuff should be the same as it's the servers job to update.
  let newState = {
    successfulReveals: contractState.successfulReveals,
    playersTurn: false,
    lastRevealX: clickedX,
    lastRevealY: clickedY
  };

  return web3.call(contractUtxo, rewardAmount, async (tx) => {

    tx.setOutput(0, (tx) => {
      const newLockingScript = contract.getNewStateScript(newState);

      return new bsv.Transaction.Output({
        script: newLockingScript,
        satoshis: rewardAmount,
      })
    })

    tx.setInputScript(0, (tx, output) => {
      const Signature = bsv.crypto.Signature;
      const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID;
      const preimage = getPreimage(tx, output.script, output.satoshis, 0, sighashType);
      const privateKey = new bsv.PrivateKey.fromWIF(PlayerPrivkey.get(Player.You));
      const sig = signTx(tx, privateKey, output.script, output.satoshis);

      return contract.reveal(sig, clickedX, clickedY, preimage).toScript();
    });
  }).then(async rawTx => {
    ContractUtxos.add(rawTx);
    ContractState.set(newState);

    contract.successfulReveals = newState.successfulReveals;
    contract.playersTurn = newState.playersTurn;
    contract.lastRevealX = newState.lastRevealX;
    contract.lastRevealY = newState.lastRevealY;
    
    setTimeout(async () => {
      web3.wallet.getbalance().then(balance => {
        console.log('update balance:', balance)
      })
    }, 5000);

  })
    .catch(e => {
      alert('Contract call failed.');
      console.log("error: ", e);
      throw new Error('Contract call failed.')
    })
}

