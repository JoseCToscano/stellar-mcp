import {
  Networks,
  Keypair,
  rpc,
  authorizeEntry,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import dotenv from 'dotenv';
import {
  createContractClient,
  getPasskeyWallet,
  passkeyServer,
  shouldSignWithWalletSigner,
  submitToLaunchtube,
} from './utils.js';

dotenv.config();

async function main() {
  // console.log("Starting...");
  // const keypair = Keypair.fromSecret("SD5KDAGTWF4N6JT5635WI5G6PCG5U3FI7I2SBGCJ3IE6ZTS3JMJUDWWD");
  // console.log(keypair.publicKey());
  // const params = {
  //     from: keypair.publicKey(),
  //     to: "GDLS6OIZ3TOC7NXHB3OZKHXLUEZV4EUANOMOOMOHUZAZHLLGNN43IALX",
  //     amount: "10000000"
  // }

  //  // Get the SAC client
  //  const sacClient = await createSACClient(
  //     "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  //     Networks.TESTNET,
  //     "https://soroban-testnet.stellar.org"
  // );

  //  let txXdr: string;
  //  const functionName = 'transfer';
  //  const functionToCall = sacClient[functionName];

  //  // For SAC contracts, we can use parameters more directly
  //  const result = await functionToCall({
  //      from: params.from,
  //      to: params.to,
  //      amount: BigInt(params.amount)
  //  });
  //  txXdr = result.toXDR();
  const params = {
    // secretKey: `SB3D6ULVPFP4RQCNFPK6ONRGGWG66Z246HUS3AG2PHINF57N3OWIZU2Q`,
    // contractId: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`,
    // transactionXdr: `AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMJ3wAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAABn5ijRAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAADAAAAEgAAAAAAAAAAiwq+JB0InMHoYtvSnRB3tTG3o40fseOnb9r3KqS7BugAAAASAAAAAAAAAADXLzkZ3NwvtucO3ZUe66EzXhKAa5jnMcemQZOtZmt5tAAAAAoAAAAAAAAAAAAAAAAAmJaAAAAAAQAAAAEAAAAAAAAAAIsKviQdCJzB6GLb0p0Qd7Uxt6ONH7Hjp2/a9yqkuwboCyyUKin8KzkAAAAAAAAAAQAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAADAAAAEgAAAAAAAAAAiwq+JB0InMHoYtvSnRB3tTG3o40fseOnb9r3KqS7BugAAAASAAAAAAAAAADXLzkZ3NwvtucO3ZUe66EzXhKAa5jnMcemQZOtZmt5tAAAAAoAAAAAAAAAAAAAAAAAmJaAAAAAAAAAAAEAAAAAAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAMAAAAAAAAAAIsKviQdCJzB6GLb0p0Qd7Uxt6ONH7Hjp2/a9yqkuwboAAAAAAAAAADXLzkZ3NwvtucO3ZUe66EzXhKAa5jnMcemQZOtZmt5tAAAAAYAAAAAAAAAAIsKviQdCJzB6GLb0p0Qd7Uxt6ONH7Hjj2/a9yqkuwboAAAAFQsslCop/Cs5AAAAAAALAD0AAAIYAAABbAAAAAAADCcYAAAAAA==`
    secretKey: `SB3D6ULVPFP4RQCNFPK6ONRGGWG66Z246HUS3AG2PHINF57N3OWIZU2Q`,
    contractId: `CDOCQ4YNWDPWB3HHGQQCVCX5PWJYHWYKYAC2PCE237WWZFQNW2GYXSDA`,
    transactionXdr: `AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4igAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAABn5uhgAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB3ChzDbDfYOznNCAqiv19k4PbCsAFp4ia3+1slg22jYsAAAALYWRkX2NvbnRhY3QAAAAAAwAAABIAAAABh7xemg8TM6hVlxo7pS1tiFJYLAEBe2ZV/MCL20tW4ZAAAAAPAAAACk5ld0NvbnRhY3QAAAAAABIAAAAAAAAAADuZETgO/piLoKiQDrHP5E82b32+lGvtB3JA9/Yk3xXFAAAAAQAAAAEAAAABh7xemg8TM6hVlxo7pS1tiFJYLAEBe2ZV/MCL20tW4ZAzd/3yCl8rXgAAAAAAAAABAAAAAAAAAAHcKHMNsN9g7Oc0ICqK/X2Tg9sKwAWniJrf7WyWDbaNiwAAAAthZGRfY29udGFjdAAAAAADAAAAEgAAAAGHvF6aDxMzqFWXGjulLW2IUlgsAQF7ZlX8wIvbS1bhkAAAAA8AAAAKTmV3Q29udGFjdAAAAAAAEgAAAAAAAAAAO5kROA7+mIugqJAOsc/kTzZvfb6Ua+0HckD39iTfFcUAAAAAAAAAAQAAAAAAAAADAAAABgAAAAGHvF6aDxMzqFWXGjulLW2IUlgsAQF7ZlX8wIvbS1bhkAAAABQAAAABAAAAB6iGAoDLn5M1tiP4Gk6A6Jp5IAJCdbF38tS/+mql+1YGAAAAB8nvRMZk5+b/os0mcTYEOxFRbZPUvHI8Hes97sp0CwiaAAAAAgAAAAYAAAABh7xemg8TM6hVlxo7pS1tiFJYLAEBe2ZV/MCL20tW4ZAAAAAVM3f98gpfK14AAAAAAAAABgAAAAHcKHMNsN9g7Oc0ICqK/X2Tg9sKwAWniJrf7WyWDbaNiwAAABQAAAABAFO3gQAAcVAAAASkAAAAAAAu4cQAAAAA`,
  };

  const keypair = Keypair.fromSecret(params.secretKey);
  const sacClient = await createContractClient(
    params.contractId,
    process.env.NETWORK_PASSPHRASE!,
    process.env.RPC_URL!
  );
  const result = sacClient.txFromXDR(params.transactionXdr);

  const { shouldSignWithSigner, walletContractId } =
    await shouldSignWithWalletSigner(result, params.contractId);
  console.log('shouldSignWithSigner', shouldSignWithSigner);
  // Signing with a passkey wallet
  if (shouldSignWithSigner && walletContractId) {
    const passkeyWallet = getPasskeyWallet(walletContractId);
    console.log('will sign with passkey wallet');
    let signedTx;
    let error;
    try {
      signedTx = await passkeyWallet.sign(params.transactionXdr, {
        keypair,
      });
    } catch (e) {
      if (e.error.includes('Error(Auth, InvalidAction)')) {
        console.log('Error(Auth, InvalidAction)');
        return;
      }
      error = e;
    }
    console.log('signedTx', signedTx);
    if (!signedTx) {
      console.log('signedTx is null');
      console.log('error', error);
      return;
    }
    console.log('signedTx', signedTx);
    try {
      const res = await passkeyServer.send(signedTx);
      const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, 'base64');
      const parsedResult = scValToNative(
        meta.v3().sorobanMeta()!.returnValue()
      );
      console.log('parsedResult', parsedResult);
    } catch (e) {
      if (e.error.includes('Error(Auth, InvalidAction)')) {
        console.log('Error(Auth, InvalidAction)');
        return;
      }
      console.log('error', e);
    }
    return;
  }

  // Signing with a regular Stellar wallet
  const server = new rpc.Server('https://soroban-testnet.stellar.org');

  const ledgerSeq = (await server.getLatestLedger()).sequence;
  const validUntilLedger = ledgerSeq + 100;

  await result.signAuthEntries({
    address: keypair.publicKey(),
    authorizeEntry: async (entry) => {
      return authorizeEntry(entry, keypair, validUntilLedger, Networks.TESTNET);
    },
  });

  // Simulate the transaction
  await result.simulate();

  // Now sign the transaction envelope
  await result.sign({
    signTransaction: basicNodeSigner(keypair, Networks.TESTNET).signTransaction,
    force: true,
  });

  // Send through Launchtube
  const res = await submitToLaunchtube(result.toXDR());
  const meta = xdr.TransactionMeta.fromXDR(res.resultMetaXdr, 'base64');
  const parsedResult = scValToNative(meta.v3().sorobanMeta()!.returnValue());
  console.log('parsedResult', parsedResult);
}

main().catch(console.error);
