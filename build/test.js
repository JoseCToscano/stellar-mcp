import { Networks, Keypair, rpc, authorizeEntry } from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import dotenv from 'dotenv';
import { createSACClient, submitToLaunchtube } from './utils.js';
dotenv.config();
async function main() {
    console.log("Starting...");
    const keypair = Keypair.fromSecret("SD5KDAGTWF4N6JT5635WI5G6PCG5U3FI7I2SBGCJ3IE6ZTS3JMJUDWWD");
    console.log(keypair.publicKey());
    const params = {
        from: keypair.publicKey(),
        to: "GDLS6OIZ3TOC7NXHB3OZKHXLUEZV4EUANOMOOMOHUZAZHLLGNN43IALX",
        amount: "10000000"
    };
    // Get the SAC client
    const sacClient = await createSACClient("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", Networks.TESTNET, "https://soroban-testnet.stellar.org");
    let txXdr;
    const functionName = 'transfer';
    const functionToCall = sacClient[functionName];
    // For SAC contracts, we can use parameters more directly
    const result = await functionToCall({
        from: params.from,
        to: params.to,
        amount: BigInt(params.amount)
    });
    txXdr = result.toXDR();
    //  await result.signAuthEntries({
    //   signAuthEntry: basicNodeSigner(keypair, Networks.TESTNET).signAuthEntry
    // });
    const server = new rpc.Server("https://soroban-testnet.stellar.org");
    const ledgerSeq = (await server.getLatestLedger()).sequence;
    const validUntilLedger = ledgerSeq + 100;
    await result.signAuthEntries({
        address: keypair.publicKey(),
        authorizeEntry: async (entry) => {
            return authorizeEntry(entry, keypair, validUntilLedger, Networks.TESTNET);
        }
    });
    // Now sign the transaction envelope
    await result.sign({
        signTransaction: basicNodeSigner(keypair, Networks.TESTNET).signTransaction
    });
    console.log('will send tx');
    // Send through Launchtube
    const launchtubeResult = await submitToLaunchtube(result.toXDR());
    console.log(launchtubeResult);
    return launchtubeResult;
}
main().catch(console.error);
