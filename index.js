const fs = require('fs');
const ethers = require('ethers');
const colors = require('colors');

const authHeaders = {
    'accept': 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://www.anime.xyz',
    'priority': 'u=1, i',
    'privy-app-id': 'cm5zp8ovq0e0p147xbwt2cuby',
    'privy-ca-id': 'e7d42f1a-49f3-4a2c-b8e2-93fc1527a1d6',
    'privy-client': 'react-auth:1.84.0',
    'referer': 'https://www.anime.xyz/',
    'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};


async function checkAllocation(privateKey) {
    try {
        const wallet = new ethers.Wallet(privateKey);
        const checksumAddress = ethers.utils.getAddress(wallet.address);

        console.log(colors.cyan(`\nChecking allocation for: ${checksumAddress}`));

        // Step 1: Get nonce and expiration time
        const initResponse = await fetch('https://auth.privy.io/api/v1/siwe/init', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ address: checksumAddress })
        });

        if (!initResponse.ok) throw new Error(`Init failed: ${initResponse.status}`);
        const initData = await initResponse.json();
        console.log({ initData });

        // Step 2: Create properly formatted SIWE message
        const message = [
            'www.anime.xyz wants you to sign in with your Ethereum account:',
            checksumAddress,
            '',
            'By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.',
            '',
            `URI: https://www.anime.xyz`,
            `Version: 1`,
            `Chain ID: 1`,
            `Nonce: ${initData.nonce}`,
            `Issued At: ${new Date(initData.expires_at).toISOString().replace(/\.\d+Z$/, 'Z')}`,
            `Resources:`,
            `- https://privy.io`
        ].join('\n');

        // Step 3: Sign the message properly
        const signature = await wallet.signMessage(message);
        console.log('signature: ', signature);

        // Step 4: Authenticate
        const authResponse = await fetch('https://auth.privy.io/api/v1/siwe/authenticate', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                message,
                signature,
                chainId: 'eip155:1',
                walletClientType: 'rabby_wallet',
                connectorType: 'injected',
                mode: 'login-or-sign-up'
            })
        });

        if (!authResponse.ok) {
            const errorBody = await authResponse.text();
            throw new Error(`Auth failed: ${authResponse.status} - ${errorBody}`);
        }

        const { token } = await authResponse.json();

        // Step 4: Get allocation data
        const allocationHeaders = {
            ...authHeaders,
            'cookie': `privy-session=t; privy-token=${token}`,
        };

        const allocationResponse = await fetch(
            'https://www.anime.xyz/api/users/allocations-ebeb21c4-2baf-4899-911b-d913ef445026',
            { headers: allocationHeaders }
        );

        console.log(await allocationResponse.text());

        if (!allocationResponse.ok) throw new Error(`Allocation check failed: ${allocationResponse.status}`);
        const allocationData = await allocationResponse.json();

        // Process allocation results
        const allocations = allocationData.allocations[address];
        if (!allocations || allocations.length === 0) {
            console.log(colors.yellow('No allocations found'));
            return;
        }

        const allocationHex = allocations[0].config.metadata.ANIME;
        const allocationValue = ethers.utils.formatEther(allocationHex);
        console.log(colors.green(`ANIME Allocation: ${parseFloat(allocationValue).toLocaleString()}`));
        fs.appendFileSync('allocations.txt', `${privateKey},${checksumAddress},${allocationValue}\n`);

    } catch (error) {
        console.log(colors.red(`Error: ${error.message}`));
    }
}

async function main() {
    const keys = fs.readFileSync('keys.txt', 'utf-8')
        .split('\n')
        .filter(k => {
            const key = k.trim();
            return key.length === 64 || (key.startsWith('0x') && key.length === 66);
        });

    if (keys.length === 0) {
        console.log(colors.red('No valid private keys found in keys.txt'));
        return;
    }

    for (const key of keys) {
        await checkAllocation(key.trim());
    }
}

main().catch(console.error);