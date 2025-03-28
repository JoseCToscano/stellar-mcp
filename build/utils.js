import { contract } from "@stellar/stellar-sdk";
import { Client as SacClient } from 'sac-sdk';
export const submitToLaunchtube = async (xdrTx, fee) => {
    if (!process.env.LAUNCHTUBE_URL)
        throw new Error('Launchtube service not configured');
    const data = new FormData();
    data.set('xdr', xdrTx);
    if (fee)
        data.set('fee', fee.toString());
    const launchtubeHeaders = {
        'X-Client-Name': 'passkey-kit',
        'X-Client-Version': '0.10.19',
        'Authorization': `Bearer ${process.env.LAUNCHTUBE_JWT}`
    };
    return fetch(process.env.LAUNCHTUBE_URL, {
        method: 'POST',
        headers: launchtubeHeaders,
        body: data
    }).then(async (res) => {
        if (res.ok)
            return res.json();
        else
            throw await res.json();
    });
};
export const createContractClient = async (contractId, networkPassphrase, rpcUrl) => {
    return contract.Client.from({
        contractId,
        networkPassphrase,
        rpcUrl
    });
};
export const createSACClient = async (contractId, networkPassphrase, rpcUrl) => {
    return new SacClient({
        contractId,
        rpcUrl,
        networkPassphrase,
    });
};
