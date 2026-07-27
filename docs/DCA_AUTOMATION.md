# DCA Automation (Gas Tank + Own Backend)

DCA schedules are executed automatically by a **standalone backend executor** (not Vercel Cron). Users fund a **gas tank** (USDC) before creating a plan; each execution deducts a fixed gas cost from their tank and reimburses the relayer.

**Gas tank is global (CEX-style):** You can top up USDC on any supported network; that balance is **one shared balance** across all networks. The backend treats the sum of your GasTank balance on every chain as a single pool. When your DCA runs on any chain, the cost is deducted from this global balance (preferring the execution chain, or the chain where you have the most balance). The relayer receives USDC on the chain we deduct from (and can bridge to native on the execution chain if needed).

## Flow

1. **User tops up gas tank** (USDC) on any supported chain in the app. The UI shows **total balance across all networks** and estimated gas needed for their plan: `totalRuns × costPerRun × 3` (3× buffer for network instability).
2. **User creates a DCA plan** only if **global** gas tank balance ≥ required gas.
3. **Frontend** calls `POST /api/automation/register` with `{ chainId, userAddress }` so the backend knows whom to check.
4. **Backend executor** runs every 5 minutes (e.g. via `npm run loop` in `backend/`):
   - Reads registered `chainId:userAddress` from Supabase.
   - For each user, fetches **global** GasTank balance (sum across all chains with GasTank).
   - For each schedule that is **ready** (`isScheduleReady`), checks that **global** balance ≥ estimated cost.
   - Gets a 0x swap quote, sends **executeSwap** from the **relayer wallet** (relayer pays gas).
   - Calls **GasTank.recordExecution(user, costUsdc6)** on the **best chain** (execution chain if enough balance there, else the chain where the user has the most balance) to deduct and reimburse the relayer in USDC.
5. No Gelato or Vercel Cron; the relayer wallet must hold native gas token and be set as the GasTank **executor**.

Set `SCHEDULER_API_URL` in the frontend deployment to the public backend URL. The dashboard proxies
the backend `GET /api/plans/timing` endpoint so Auto DCA countdowns target the scheduler sweep that
will execute the plan. Manual execution still becomes available at the exact on-chain due time.

## Contracts

- **DCAVault**: unchanged; `executeSwap(user, scheduleId, swapData)` is called by anyone (the relayer).
- **GasTank**: new contract; users `deposit`/`withdraw` USDC; only the **executor** can call `recordExecution(user, amountUsdc6)` to deduct and receive USDC.

> **The executor must be set, or no gas is ever deducted.** A GasTank deployed with
> `executor == address(0)` reverts every `recordExecution` with `OnlyExecutor` — swaps still run,
> but tanks never drain. Deploys now fail when `RELAYER_ADDRESS` is missing; to audit or repair
> tanks already live, run `node scripts/set-gastank-executor.js` (add `--apply` to send).

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
| `SUPABASE_DB_URL` | Supabase Postgres (Session Pooler) connection string, shared with the frontend; stores the registered-user list. |
| `ZERO_EX_API_KEY` | Optional; for 0x swap quotes. |
| `GAS_COST_PER_EXECUTION_USDC` | **Last fallback.** Per-execution cost in USDC (e.g. `0.01`), used only when neither an operator price nor the GasTank's own `gasCostPerExecutionUsdc6` is set. See "Per-run price" below. |
| `ADMIN_API_TOKEN` | Required to change the per-run price, hold a plan, or allocate a network from the operator dashboard. Unset = those endpoints refuse every request. |

Which networks the relayer runs on is not an env variable: it is every chain with a deployed
GasTank, minus the ones an operator has paused or removed under **Networks** on the dashboard.

#### Per-run price

What a run charges a user's tank is resolved in one order, by the relayer and the app alike — a
number the UI quotes and the relayer does not debit is what lets a fully funded plan run its tank
dry mid-way:

1. **Operator price** — set per network on the backend dashboard at `/run-price.html`, stored by
   `backend/src/run-price.ts` (Supabase `kv_store`, or `run-price.json` when no database is
   configured). Changeable without a transaction, which is why it wins.
2. **`gasCostPerExecutionUsdc6`** on that chain's GasTank — an owner-only transaction
   (`scripts/set-gas-cost.js`).
3. **`GAS_COST_PER_EXECUTION_USDC`** for a chain where neither is set.
4. Otherwise each run is charged what it measured, so the amount moves with gas.

The dashboard shows each network's flat rate beside what a run costs the relayer right now (gas
price × measured gas × native token price), so a rate can be set against the live cost rather than
guessed. The app reads the operator price through `/api/run-price` and the rest from the chain
(`useEffectiveRunPriceUsdc6`). A price change reaches the relayer within ~30s and the app within
~2 minutes of caching, so avoid changing a price and quoting the new one in the same breath.

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
2. To run Base Sepolia alone, pause the other networks on the dashboard's **Networks** page (or `POST /api/admin/networks/pause`).
3. In the app, connect to Base Sepolia, top up gas tank, create a DCA plan (e.g. 1-minute frequency).
4. Run `npm run run` in `backend/` (or wait for the loop). Check logs for `executed` and any `errors`.
