# Deployment & Verification Guide (Base Sepolia)

This file documents the steps to deploy, verify, and update the frontend after redeploying `DCAVault` and `DCAResolver`.

Prerequisites
- Foundry (`forge`) installed and configured
- `PRIVATE_KEY` environment variable containing deployer key
- RPC URL for Base Sepolia (e.g., `BASE_SEPOLIA_RPC_URL`)
- `ETHERSCAN_API_KEY` (or Basescan API key) for verification

1) Build & Run Tests (locally)

Install dependencies and remappings as required by your repo (lib folder or `git submodule` for dependencies). Then run:

```bash
forge test -vv
```

Note: If tests fail due to missing `forge-std` or OpenZeppelin remappings, ensure `lib/` contains the required packages or update `remappings.txt`.

2) Deploy to Base Sepolia

Set environment variables and run the deploy script:

```bash
export PRIVATE_KEY=0x...
export RPC_URL="https://sepolia.base.org" # replace with actual
forge script contracts/script/Deploy.s.sol:DeployTestnet --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY -vvvv
```

After deployment the script prints deployed addresses.

3) Verify Contracts (via forge)

Use `forge verify-contract`. You will need constructor arguments in the right format.

```bash
# Example (replace addresses and API key)
forge verify-contract --chain sepolia --constructor-args <encoded-args> <deployed_address> src/DCAVault.sol:DCAVault $ETHERSCAN_API_KEY
forge verify-contract --chain sepolia --constructor-args <encoded-args> <deployed_address> src/DCAResolver.sol:DCAResolver $ETHERSCAN_API_KEY
```

If `forge verify-contract` doesn't support the target explorer, use the explorer's web UI.

4) Update Frontend

After successful deployment and verification, update the frontend environment variables (or .env.local):

```
NEXT_PUBLIC_DCA_VAULT=0xYourNewDcAVaultAddress
NEXT_PUBLIC_DCA_RESOLVER=0xYourNewResolverAddress
NEXT_PUBLIC_MOCK_USDC=0x...
```

Then restart the Next.js dev server:

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

5) Optional: Update ABI

If the ABI changed, copy the updated ABI to `frontend/config/abis.ts` or ensure the frontend hooks use the same compiled ABIs.

---

If you want, I can prepare a script to automatically update `frontend/config/contracts.ts` with newly deployed addresses (given the addresses), or add a small CLI helper. Tell me which you'd like next.