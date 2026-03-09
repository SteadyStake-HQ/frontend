# DCA Automation (Gas Tank + Own Backend)

DCA schedules are executed automatically by a **standalone backend executor** (not Vercel Cron). Users fund a **gas tank** (USDC) before creating a plan; each execution deducts a fixed gas cost from their tank and reimburses the relayer.

**Gas tank is global (CEX-style):** You can top up USDC on any supported network; that balance is **one shared balance** across all networks. The backend treats the sum of your GasTank balance on every chain as a single pool. When your DCA runs on any chain, the cost is deducted from this global balance (preferring the execution chain, or the chain where you have the most balance). The relayer receives USDC on the chain we deduct from (and can bridge to native on the execution chain if needed).

## Flow

1. **User tops up gas tank** (USDC) on any supported chain in the app. The UI shows **total balance across all networks** and estimated gas needed for their plan: `totalRuns × costPerRun × 3` (3× buffer for network instability).
2. **User creates a DCA plan** only if **global** gas tank balance ≥ required gas.
3. **Frontend** calls `POST /api/automation/register` with `{ chainId, userAddress }` so the backend knows whom to check.
4. **Backend executor** runs every 5 minutes (e.g. via `npm run loop` in `backend/`):
   - Reads registered `chainId:userAddress` from KV.
   - For each user, fetches **global** GasTank balance (sum across all chains with GasTank).
   - For each schedule that is **ready** (`isScheduleReady`), checks that **global** balance ≥ estimated cost.
   - Gets a 0x swap quote, sends **executeSwap** from the **relayer wallet** (relayer pays gas).
   - Calls **GasTank.recordExecution(user, costUsdc6)** on the **best chain** (execution chain if enough balance there, else the chain where the user has the most balance) to deduct and reimburse the relayer in USDC.
5. No Gelato or Vercel Cron; the relayer wallet must hold native gas token and be set as the GasTank **executor**.

## Contracts

- **DCAVault**: unchanged; `executeSwap(user, scheduleId, swapData)` is called by anyone (the relayer).
- **GasTank**: new contract; users `deposit`/`withdraw` USDC; only the **executor** can call `recordExecution(user, amountUsdc6)` to deduct and receive USDC.

Deploy GasTank per chain (see `contracts/script/Deploy.s.sol`), set `RELAYER_ADDRESS` when deploying so the relayer is the executor, then add the GasTank address to:
- Frontend: `frontend/config/deployed-addresses.json` (add `GasTank` per chain).
- Backend: `backend/deployed-addresses.json` (add `GasTank` per chain).

## Setup

### 1. Deploy GasTank

From `contracts/`:

```bash
export PRIVATE_KEY=0x...
export RELAYER_ADDRESS=0x...   # wallet that will run the backend executor
forge script script/Deploy.s.sol:DeployTestnet --rpc-url $RPC --broadcast
# or DeployMainnet / DeployBNB / DeployKava / DeployPolygon
```

Add the logged **GasTank** address to `frontend/config/deployed-addresses.json` and `backend/deployed-addresses.json` for each chain.

### 2. Backend executor

In `backend/`:

| Variable | Description |
|----------|-------------|
| `RELAYER_PRIVATE_KEY` | Wallet that sends executeSwap and recordExecution; must be GasTank executor and hold native gas token. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Same as frontend (Vercel KV / Upstash Redis). |
| `ZERO_EX_API_KEY` | Optional; for 0x swap quotes. |
| `GAS_COST_PER_EXECUTION_USDC` | Amount in USD per execution (e.g. `0.01`); converted to 6 decimals when calling recordExecution. |
| `AUTOMATION_CHAIN_IDS` | Optional; comma-separated chain IDs (e.g. `84532,8453`). Empty = all registered chains. |

Run once:

```bash
cd backend && npm i && npm run run
```

Run every 5 minutes (e.g. pm2 or cron):

```bash
cd backend && npm run build && npm run loop
```

### 3. Frontend

- **Gas tank**: Users see balance and can deposit/withdraw USDC. Before creating a DCA plan, the app shows **required gas** = (number of runs) × (cost per run in USD) × 3, and blocks creation if gas tank balance is below that (or shows a clear warning).
- **Registration**: When a user creates a schedule, the frontend still calls `POST /api/automation/register` so the backend executor includes them.

### 4. Vercel

- **Cron**: Removed from `vercel.json`. Do not use Vercel Cron for DCA.
- **Auto-deploy**: See [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) to enable deploys on git push.

## Security

- **Relayer**: Keep `RELAYER_PRIVATE_KEY` secret; that wallet pays gas and is reimbursed from GasTank.
- **GasTank executor**: Only the relayer address should be set as executor; only they can call `recordExecution`.
- **Register API**: Still unauthenticated; abuse only adds load and requires users to have gas tank balance.

## Testing (Base Sepolia)

1. Deploy GasTank on Base Sepolia, set executor to your relayer address, add GasTank to both deployed-addresses.
2. Set `AUTOMATION_CHAIN_IDS=84532` in backend `.env`.
3. In the app, connect to Base Sepolia, top up gas tank, create a DCA plan (e.g. 1-minute frequency).
4. Run `npm run run` in `backend/` (or wait for the loop). Check logs for `executed` and any `errors`.
