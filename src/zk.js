/* global BigInt */
import { buildMimc7 } from './mimc7';

const { initialize } = require('zokrates-js');
const path = require('path');


export async function zokratesProof(mineField, mineFieldCommit, x, y, mineHit, neighborMineCount, compilerOut) {

  const defaultProvider = await initialize();

  let zokratesProvider = defaultProvider.withOptions({ 
    backend: "bellman",
    curve: "bn128",
    scheme: "g16"
  });

  // computation
  const { witness, output } = zokratesProvider.computeWitness(
    {
      program: compilerOut.program,
      abi: compilerOut.abi
    },
    [ mineField.toString(),
      mineFieldCommit.toString(),
      x.toString(), y.toString(), 
      mineHit, 
      neighborMineCount.toString()]
  );

  const proof = zokratesProvider.generateProof(compilerOut.program, witness, compilerOut.provingkey);

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
