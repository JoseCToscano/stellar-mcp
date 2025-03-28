import { Networks, Keypair, rpc, authorizeEntry } from '@stellar/stellar-sdk';
import { basicNodeSigner } from '@stellar/stellar-sdk/contract';
import dotenv from 'dotenv';
import {
  createSACClient,
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
    contractId: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`,
    transactionXdr: `AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMhhEAAAAAAAAAAQAAAAEAAAAAAAAAAAAAAABn5rYUAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAADAAAAEgAAAAGHvF6aDxMzqFWXGjulLW2IUlgsAQF7ZlX8wIvbS1bhkAAAABIAAAAAAAAAANcvORnc3C+25w7dlR7roTNeEoBrmOcxx6ZBk61ma3m0AAAACgAAAAAAAAAAAAAAAACYloAAAAABAAAAAQAAAAGHvF6aDxMzqFWXGjulLW2IUlgsAQF7ZlX8wIvbS1bhkA9kcmeNY6xMAAAAAAAAAAEAAAAAAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5hAAAACHRyYW5zZmVyAAAAAwAAABIAAAABh7xemg8TM6hVlxo7pS1tiFJYLAEBe2ZV/MCL20tW4ZAAAAASAAAAAAAAAADXLzkZ3NwvtucO3ZUe66EzXhKAa5jnMcemQZOtZmt5tAAAAAoAAAAAAAAAAAAAAAAAmJaAAAAAAAAAAAEAAAAAAAAAAwAAAAYAAAABh7xemg8TM6hVlxo7pS1tiFJYLAEBe2ZV/MCL20tW4ZAAAAAUAAAAAQAAAAYAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAUAAAAAQAAAAeohgKAy5+TNbYj+BpOgOiaeSACQnWxd/LUv/pqpftWBgAAAAMAAAAAAAAAANcvORnc3C+25w7dlR7roTNeEoBrmOcxx6ZBk61ma3m0AAAABgAAAAGHvF6aDxMzqFWXGjulLW2IUlgsAQF7ZlX8wIvbS1bhkAAAABUPZHJnjWOsTAAAAAAAAAAGAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5hAAAAEAAAAAEAAAACAAAADwAAAAdCYWxhbmNlAAAAABIAAAABh7xemg8TM6hVlxo7pS1tiFJYLAEBe2ZV/MCL20tW4ZAAAAABABGZ7AAAXhgAAAG4AAAAAAAMha0AAAAA`,
  };

  const keypair = Keypair.fromSecret(params.secretKey);
  const sacClient = await createSACClient(
    params.contractId,
    process.env.NETWORK_PASSPHRASE!,
    process.env.RPC_URL!
  );
  const result = sacClient.txFromXDR(params.transactionXdr);
  const { shouldSignWithSigner, walletContractId } =
    await shouldSignWithWalletSigner(result, params.contractId);

  // Signing with a passkey wallet
  if (shouldSignWithSigner && walletContractId) {
    const passkeyWallet = getPasskeyWallet(walletContractId);
    const signedTx = await passkeyWallet.sign(params.transactionXdr, {
      keypair,
    });
    console.log('signedTx', signedTx);
    const re = await passkeyServer.send(signedTx);
    console.log('re', re);
    return re;
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
  });

  // Send through Launchtube
  return await submitToLaunchtube(result.toXDR());
}

main().catch(console.error);
