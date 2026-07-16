/**
 * Supabase Postgres access to the DCA automation-user registration list.
 * Replaces the former Vercel KV (Upstash Redis) set. Shared by the register
 * endpoint (write) and the cron executor (read).
 *
 * Requires SUPABASE_DB_URL (Supabase Session Pooler connection string). On Vercel,
 * set it under Project → Settings → Environment Variables.
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

async function ensureTable(p: Pool): Promise<void> {
  if (!tableReady) {
    tableReady = p
      .query(
        `CREATE TABLE IF NOT EXISTS automation_users (
           member text PRIMARY KEY,
           chain_id integer NOT NULL,
           user_addr text NOT NULL,
           created_at timestamptz NOT NULL DEFAULT now()
         )`,
      )
      .then(() => undefined)
      .catch((e) => {
        tableReady = null;
        throw e;
      });
  }
  return tableReady;
}

export function isSupabaseConfigured(): boolean {
  return typeof process.env.SUPABASE_DB_URL === "string" && process.env.SUPABASE_DB_URL.trim().length > 0;
}

/** Registers a user for DCA automation. Returns the stored `${chainId}:${userAddress}` member key. */
export async function addAutomationUser(chainId: number, userAddress: string): Promise<string> {
  const p = getPool();
  if (!p) throw new Error("SUPABASE_DB_URL is not configured.");
  await ensureTable(p);
  const member = `${chainId}:${userAddress.toLowerCase()}`;
  await p.query(
    `INSERT INTO automation_users (member, chain_id, user_addr) VALUES ($1, $2, $3)
     ON CONFLICT (member) DO NOTHING`,
    [member, chainId, userAddress.toLowerCase()],
  );
  return member;
}

/** Returns all registered members as `${chainId}:${userAddress}` strings. */
export async function getAutomationUsers(): Promise<string[]> {
  const p = getPool();
  if (!p) throw new Error("SUPABASE_DB_URL is not configured.");
  await ensureTable(p);
  const { rows } = await p.query("SELECT member FROM automation_users");
  return rows.map((r) => r.member as string);
}
