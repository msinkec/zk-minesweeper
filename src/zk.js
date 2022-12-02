/* global BigInt */
import { buildMimc7 } from './mimc7';

const { initialize } = require('zokrates-js');
const fs = require('fs');
const path = require('path');


export async function zokratesProof(mineField, mineFieldCommit, x, y, mineHit, neighborMineCount) {

  const defaultProvider = await initialize();

  let zokratesProvider = defaultProvider.withOptions({ 
    backend: "bellman",
    curve: "bn128",
    scheme: "g16"
  });

  const program = fs.readFileSync(path.join(__dirname, '../circuits', 'out'));
  let abi = JSON.parse(fs.readFileSync(path.join(__dirname, '../circuits', 'abi.json')).toString());

  // computation
  const { witness, output } = zokratesProvider.computeWitness(
    {
      program: program,
      abi: abi
    },
    [ mineField.toString(),
      mineFieldCommit.toString(),
      x.toString(), y.toString(), 
      mineHit, 
      neighborMineCount.toString()]
  );

  const provingkey = fs.readFileSync(path.join(__dirname, '../circuits', 'proving.key')).toJSON().data

  const proof = zokratesProvider.generateProof(program, witness, provingkey);

  // or verify off-chain
  //const verificationkey = JSON.parse(fs.readFileSync(path.join(__dirname, 'circuits', 'verification.key')).toString())
  //const isVerified = zokratesProvider.verify(verificationkey, proof);

  //console.log('zokrates isVerified:' + isVerified)

  return {
    proof,
    output
  };
}

export async function mineFieldMimc(mineField) {
  const mimc7 = await buildMimc7();
  return mimc7.F.toString(mimc7.hash(BigInt(mineField), 0));
}

export async function mineFieldArrToInt(mineFieldArr) {
  let binStr = '0b';
  for (let i = mineFieldArr.length - 1; i >= 0; i--) {
     binStr += mineFieldArr[i].toString();
  }
  return BigInt(binStr);
}
