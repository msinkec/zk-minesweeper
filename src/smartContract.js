import { bsv, AbstractContract, buildContractClass, PubKey, toHex, Int, Bool} from 'scryptlib';
import { web3 } from './web3';

import { ContractUtxos, initPlayer, GameData, ContractState, Player, PlayerPublicKey } from './storage.js';


export async function initializeContract() {
  let desc = await web3.loadContractDesc(
    "/minesweeper_debug_desc.json"
  );
  
  const Minesweeper = buildContractClass(desc);
  
  const publicKeyPlayer = PlayerPublicKey.get(Player.You);
  const publicKeyServer = PlayerPublicKey.get(Player.Computer);
  
  let game = GameData.get()

  initPlayer();
  
  const contract = new Minesweeper(
      new PubKey(toHex(publicKeyPlayer)),
      new PubKey(toHex(publicKeyServer)),
      new Int(game.mineFieldCommit), 
      0,
      new Bool(true),
      0, 0
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

      const rawTx = await web3.deploy(contract, 10000);

      ContractUtxos.add(rawTx, 0, -1);

      const txid = ContractUtxos.getdeploy().utxo.txId
      console.log(txid);

      //setDeployTxid(txid)

      setTimeout(async () => {
        web3.wallet.getbalance().then(balance => {
          console.log('update balance:', balance)
          //setBalance(balance)
        })
      }, 10000);
  } catch (error) {
    console.error("deploy contract fails", error);
    //setBattleShipContract(null);
    alert("deploy contract error:" + error.message);
    return;
  }
}

export async function callContractUpdateFunc() {
  // TODO: Get needed params and broadcast update.
}

export async function callContractRevealFunc(x, y, isMine, neighborMineCount) {
//  let desc = await web3.loadContractDesc(
//    "/minesweeper_debug_desc.json"
//  );
//  
//  const Minesweeper = buildContractClass(desc);
//
//  const contract = new Minesweeper(
//      new PubKey(toHex(publicKeyPlayer)),
//      new PubKey(toHex(publicKeyServer)),
//      new Int(game.mineFieldCommit), 
//      0,
//      new Bool(true),
//      0, 0
//  );
//  
//  const publicKeyPlayer = PlayerPublicKey.get(Player.You);
//  const publicKeyServer = PlayerPublicKey.get(Player.Computer);
//  
//  let game = GameData.get()
//  
//  const contractUtxo = ContractUtxos.getlast().utxo;
//
//  const Proof = contract.getTypeClassByType("Proof");
//  const G1Point = contract.getTypeClassByType("G1Point");
//  const G2Point = contract.getTypeClassByType("G2Point");
//  const FQ2 = contract.getTypeClassByType("FQ2");
//
//  let contractState = ContractState.get();
//  
//  let newStates = {
//    successfulReveals: contractState.successfulReveals,
//    playersTurn: false,
//    lastRevealX: x,
//    lastRevealY: y
//  };
//
//  contractUtxo.script = contract.getNewStateScript(contractState).toHex();
//  
////  let {proof, output} = await zokratesProof(game.mineFieldInt, game.mineFieldCommit, x, y, isMine, neighborMineCount);
////  
////  const proofScryptObj = new Proof({
////          a: new G1Point({
////            x: new Int(proof.proof.a[0]),
////            y: new Int(proof.proof.a[1]),
////          }),
////          b: new G2Point({
////            x: new FQ2({
////              x: new Int(proof.proof.b[0][0]),
////              y: new Int(proof.proof.b[0][1]),
////            }),
////            y: new FQ2({
////              x: new Int(proof.proof.b[1][0]),
////              y: new Int(proof.proof.b[1][1]),
////            })
////          }),
////          c: new G1Point({
////            x: new Int(proof.proof.c[0]),
////            y: new Int(proof.proof.c[1]),
////          })
////        })
////
//  return web3.call(contractUtxo, async (tx) => {
//
//    tx.setOutput(0, (tx) => {
//      const amount = contractUtxo.satoshis - tx.getEstimateFee();
//
//      if (amount < 1) {
//        alert('Not enough funds.');
//        throw new Error('Not enough funds.')
//      }
//
//      const newLockingScript = contract.getNewStateScript(newStates);
//
//      return new bsv.Transaction.Output({
//        script: newLockingScript,
//        satoshis: amount,
//      })
//    })
//
//
//    tx.setInputScript(0, (tx, output) => {
//      const preimage = getPreimage(tx, output.script, output.satoshis)
//      const currentTurn = !newStates.yourTurn;
//      const privateKey = new bsv.PrivateKey.fromWIF(currentTurn ? PlayerPrivkey.get(Player.You) : PlayerPrivkey.get(Player.Computer));
//      const sig = signTx(tx, privateKey, output.script, output.satoshis)
//      const position = indexToCoords(index);
//
//      let amount = contractUtxo.satoshis - tx.getEstimateFee();
//
//      if (amount < 1) {
//        alert('Not enough funds.');
//        throw new Error('Not enough funds.')
//      }
//
//      return contract.reveal(sig, x, y, inputSatoshis, preimage).toScript();
//    })
//      .seal();
//
//
//  }).then(async rawTx => {
//    ContractUtxos.add(rawTx, isPlayerFired, index);
//    ContractState.set(newStates);
//
//    setTimeout(async () => {
//      web3.wallet.getbalance().then(balance => {
//        console.log('update balance:', balance)
//      })
//    }, 5000);
//
//  })
//    .catch(e => {
//      console.error('call contract fail', e)
//    })
}

