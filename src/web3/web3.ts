import { bsv, AbstractContract} from 'scryptlib';
import { UTXO, wallet, SignType } from './wallet';
import axios from 'axios';

const WEB3_VERSION = '0.0.2';


function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export class web3 {

  static wallet: wallet;

  static setWallet(wallet: wallet) {
    web3.wallet = wallet;
  }


  static version() {
    return WEB3_VERSION;
  }


  static loadContractDesc(url: string): Promise<any> {
    return axios.get(url, {
      timeout: 10000
    }).then(res => {
      return res.data;
    });
  }


  static async getChangeAddress(): Promise<string> {
    return web3.wallet.getRawChangeAddress();
  }


  static async sendRawTx(rawTx: string): Promise<string> {
    return web3.wallet.sendRawTransaction(rawTx);
  }


  static async deploy(contract: AbstractContract, amountInContract: number): Promise<string> {
    const wallet = web3.wallet
    const changeAddress = await web3.wallet.getRawChangeAddress();

    return wallet.listUnspent(amountInContract, {
      purpose: 'listUnspent'
    }).then(async (utxos: UTXO[]) => {
      console.log(JSON.stringify(utxos));
      if(utxos.length === 0) {
        throw new Error('no utxo available')
      }
      const tx = new bsv.Transaction();
      tx.from([utxos[0]])
        .addOutput(new bsv.Transaction.Output({
          script: contract.lockingScript,
          satoshis: amountInContract,
        }))
        .change(changeAddress);

      return wallet.signRawTransaction(tx.toString(), utxos[0].script, utxos[0].satoshis, 0, SignType.ALL);
    }).then(async (rawTx: string) => {
      await web3.sendRawTx(rawTx);
      return rawTx;
    })
  }

  static async call(contractUtxo: UTXO,
    amountInContract: number,
    cbBuildTx: (tx: bsv.Transaction) => Promise<void>
  ): Promise<string> {
    const wallet = web3.wallet;
    const changeAddress = await web3.wallet.getRawChangeAddress();
    
    // TODO: We sholdn't query for the utxo again, as we can know it locally.
    //       Then we won't need this hacky delay.
    await delay(10000);

    return wallet.listUnspent(amountInContract, { 
      purpose: 'listUnspent'
    }).then(async (utxos: UTXO[]) => {
      if(utxos.length === 0) {
        throw new Error('no utxo available')
      }

      const tx = new bsv.Transaction();
      
      // Add input that unlocks latest smart contract instance.
      tx.addInput(new bsv.Transaction.Input({
        prevTxId: contractUtxo.txId,
        outputIndex: contractUtxo.outputIndex,
        script: new bsv.Script(), // placeholder
        output: new bsv.Transaction.Output({
          script: contractUtxo.script,
          satoshis: contractUtxo.satoshis,
        })
      }));
      
      // Add funding input.
      tx.addInput(new bsv.Transaction.Input({
        //prevTxId: utxos[0].txId,
        //outputIndex: utxos[0].outputIndex,
        prevTxId: contractUtxo.txId,
        outputIndex: contractUtxo.outputIndex + 1,
        script: new bsv.Script(), // placeholder
        output: new bsv.Transaction.Output({
          script: utxos[0].script,
          satoshis: utxos[0].satoshis,
        })
      }));
      
      // Add contract output placeholder
      tx.addOutput(new bsv.Transaction.Output({
        script: new bsv.Script(),
        satoshis: 0,
      }))

      // Add change output.
      tx.change(changeAddress);

      await cbBuildTx(tx); // Sets new contract iteration stuff.
                           // Namely this should be the unlocking script
                           // and an output with the new locking script
      
      tx.seal();
      
      // Sign funding input.
      let fundingUnlockScript = wallet.signRawTransaction(tx.toString(), utxos[0].script, utxos[0].satoshis, 1, SignType.ALL);
      return fundingUnlockScript;
    }).then(async (rawTx: string) => {
      await web3.sendRawTx(rawTx);
      return rawTx;
    })
  }
}