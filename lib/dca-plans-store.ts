/**
 * Supabase Postgres access to the `dca_plans` table — the system of record for DCA plans.
 *
 * Plans are recorded here the moment they are created or cancelled, straight from the transaction
 * receipt, so the backend never has to scan block logs to discover them. Anything not recorded here
 * is shown in the dashboard as "Not recorded" rather than being inferred.
 *
 * Mirrors the pattern in automation-users.ts (module-level pool, idempotent DDL) and the schema in
 * backend/src/supabase/dca-plans-store.ts — keep the two in sync.
 *
 * Requires SUPABASE_DB_URL (Supabase Session Pooler connection string).
 */
import { Pool } from "pg";

let pool: Pool | null = null;
let tableReady: Promise<void> | null = null;

function getPool(): Pool | null {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

export function isSupabaseConfigured(): boolean {
  return typeof process.env.SUPABASE_DB_URL === "string" && process.env.SUPABASE_DB_URL.trim().length > 0;
}

async function ensureTables(p: Pool): Promise<void> {
  if (!tableReady) {
    tableReady = p
      .query(
        `CREATE TABLE IF NOT EXISTS dca_plans (
           chain_id integer NOT NULL,
           user_addr text NOT NULL,
           schedule_id integer NOT NULL,
           target_token text,
           frequency smallint,
           amount_per_interval_usdc6 text,
           committed_usdc6 text,
           swapped_usdc6 text,
           executed_count integer NOT NULL DEFAULT 0,
           created_at timestamptz,
           last_execution_at timestamptz,
           ended_at timestamptz,
           status text NOT NULL DEFAULT 'active',
           returned_usdc6 text,
           updated_at timestamptz NOT NULL DEFAULT now(),
           PRIMARY KEY (chain_id, user_addr, schedule_id)
         );
         CREATE INDEX IF NOT EXISTS dca_plans_member_idx ON dca_plans (chain_id, user_addr);
         CREATE TABLE IF NOT EXISTS automation_users (
           member text PRIMARY KEY,
           chain_id integer NOT NULL,
           user_addr text NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now()
         );`,
      )
      .then(() => undefined)
      .catch((e) => {
        tableReady = null;
        throw e;
      });
  }
  return tableReady;
}

export interface RecordPlanCreatedInput {
  chainId: number;
  userAddr: string;
  scheduleId: number;
  targetToken: string;
  frequency: number;
  amountPerIntervalUsdc6: string;
  /** total deposited at creation — the plan's committed total */
  committedUsdc6: string;
  createdAt: Date;
}

/**
 * Record a newly created plan and register the user for automation, in one transaction: a plan the
 * executor cannot see is a plan that never runs, so both rows land together or neither does.
 * Re-recording the same plan leaves the original creation facts untouched.
 */
export async function recordPlanCreated(input: RecordPlanCreatedInput): Promise<void> {
  const p = getPool();
  if (!p) throw new Error("SUPABASE_DB_URL is not configured.");
  await ensureTables(p);
  const user = input.userAddr.toLowerCase();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO dca_plans (
         chain_id, user_addr, schedule_id, target_token, frequency,
         amount_per_interval_usdc6, committed_usdc6, swapped_usdc6, executed_count,
         created_at, status, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'0',0,$8,'active', now())
       ON CONFLICT (chain_id, user_addr, schedule_id) DO UPDATE SET
         target_token = COALESCE(dca_plans.target_token, EXCLUDED.target_token),
         frequency = COALESCE(dca_plans.frequency, EXCLUDED.frequency),
         amount_per_interval_usdc6 = COALESCE(dca_plans.amount_per_interval_usdc6, EXCLUDED.amount_per_interval_usdc6),
         committed_usdc6 = COALESCE(dca_plans.committed_usdc6, EXCLUDED.committed_usdc6),
         created_at = COALESCE(dca_plans.created_at, EXCLUDED.created_at),
         updated_at = now()`,
      [
        input.chainId,
        user,
        input.scheduleId,
        input.targetToken.toLowerCase(),
        input.frequency,
        input.amountPerIntervalUsdc6,
        input.committedUsdc6,
        input.createdAt,
      ],
    );
    await client.query(
      `INSERT INTO automation_users (member, chain_id, user_addr) VALUES ($1, $2, $3)
       ON CONFLICT (member) DO NOTHING`,
      [`${input.chainId}:${user}`, input.chainId, user],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export interface RecordPlanCancelledInput {
  chainId: number;
  userAddr: string;
  scheduleId: number;
  /** USDC refunded to the user by cancelSchedule */
  returnedUsdc6: string;
  at: Date;
}

/** Record a cancellation. The vault zeroes the deposit on cancel, so remaining becomes 0. */
export async function recordPlanCancelled(input: RecordPlanCancelledInput): Promise<void> {
  const p = getPool();
  if (!p) throw new Error("SUPABASE_DB_URL is not configured.");
  await ensureTables(p);
  await p.query(
    `UPDATE dca_plans SET
       status = 'cancelled',
       returned_usdc6 = $4,
       ended_at = COALESCE(ended_at, $5),
       updated_at = now()
     WHERE chain_id = $1 AND user_addr = $2 AND schedule_id = $3`,
    [input.chainId, input.userAddr.toLowerCase(), input.scheduleId, input.returnedUsdc6, input.at],
  );
}
