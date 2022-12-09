
import axios, { AxiosError } from 'axios';
import { Network } from './wallet';




export class Gorillapool {
    static API_PREFIX = ``;
    static TX_URL_PREFIX = ``;
    static setNetwork(network: Network) {

        Gorillapool.API_PREFIX = `https://api.whatsonchain.com/v1/bsv/${network === Network.Testnet ? 'test' : 'main'}`;
        Gorillapool.TX_URL_PREFIX = `${network === Network.Testnet ? 'https://classic-test.whatsonchain.com/tx' : 'https://classic.whatsonchain.com/tx'}`;
    }

    
    static async sendRawTransaction(txhex: string) {


        // 1 second per KB
        const size = Math.max(1, txhex.length / 2 / 1024); //KB
        const time = Math.max(100000, 1000 * size);

        try {
            const headers = {
                method: 'post',
                url: `https://testnet-mapi.gorillapool.io/mapi/tx`,
                data: Buffer.from(txhex, 'hex'),
                headers: {
                    'Accept': 'text/plain',
                    'Content-Type': 'application/octet-stream'
                },
                timeout: time,
                maxBodyLength: Infinity
            }
            
            console.log("POST tx: ", headers.url);
            console.log(Date.now());

            const {
                data
            } = await axios(headers);
            
            const payload = JSON.parse(data.payload)
            if(payload.returnResult === 'success') {
                return payload.txid;
            } else if(payload.returnResult === 'failure') {
                console.error('sendTx error:', txhex)
                throw new Error(payload.resultDescription)
            }
        
            throw new Error('sendTx error')
        } catch (e) {

            let message = 'Unknown Error'

            if(axios.isAxiosError(e)) {
                const ae = e as AxiosError;
                if ('response' in ae && ae.response != undefined) {
                    message = JSON.stringify(ae.response.data);
                } else {
                    message = JSON.stringify({});
                }
            } else if(e instanceof Error) {
                message = e.message;
            }

            throw new Error('sendRawTransaction error: ' + message)
        }
    }

    static async listUnspent(address: string): Promise<any> {
        console.log(`${Gorillapool.API_PREFIX}/address/${address}/unspent`);
        return axios.get(`${Gorillapool.API_PREFIX}/address/${address}/unspent`, {
            timeout: 30000
        });
    }

    static getTxUri(txid: string): string {
        return `${Gorillapool.TX_URL_PREFIX}/${txid}`;
    }
}
