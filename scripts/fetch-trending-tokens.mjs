/**
 * Fetches trending 100 tokens for BNB, BASE, Polygon (Kava not supported by Moralis).
 * Writes config/trending-tokens.json. Run weekly/monthly, then commit – contracts.ts imports this file.
 *
 * Usage: npm run fetch-trending-tokens  (from frontend; uses MORALIS_API_KEY or .env.local)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local if present (for NEXT_PUBLIC_MORALIS_API_KEY)
function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  } catch (_) {}
}
loadEnvLocal();
const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2";
const LIMIT = 100;

const CHAINS = [
  { chainId: 56, param: "bsc", label: "BNB" },
  { chainId: 8453, param: "base", label: "BASE" },
  { chainId: 2222, param: null, label: "KAVA" }, // Moralis does not support Kava → empty array
  { chainId: 137, param: "polygon", label: "Polygon" },
];

function parseToken(item) {
  if (!item || typeof item !== "object") return null;
  const o = item;
  const address = o.token_address ?? o.tokenAddress ?? o.address;
  const symbol = o.symbol ?? o.tokenSymbol ?? o.token_symbol ?? "???";
  const name = o.name ?? o.tokenName ?? o.token_name ?? symbol ?? "Unknown";
  const logo = o.tokenLogo ?? o.token_logo ?? o.logo ?? o.image;
  const decimalsRaw = o.decimals ?? o.token_decimals ?? o.tokenDecimals;
  const decimals =
    typeof decimalsRaw === "number" && Number.isInteger(decimalsRaw) && decimalsRaw >= 0
      ? decimalsRaw
      : 18;
  if (!address || typeof address !== "string") return null;
  const addr = address.startsWith("0x") ? address : `0x${address}`;
  if (addr.length !== 42) return null;
  const logoUrl = typeof logo === "string" && logo.startsWith("http") ? logo : undefined;
  return { name, symbol, address: addr.toLowerCase(), decimals, logo: logoUrl };
}

async function fetchTrending(apiKey, chainParam) {
  const url = `${MORALIS_BASE}/tokens/trending?chain=${encodeURIComponent(chainParam)}&limit=${LIMIT}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "X-API-Key": apiKey },
  });
  if (!res.ok) {
    console.warn(`  ${chainParam}: ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json();
  const list = Array.isArray(data) ? data : data?.result ?? data?.data ?? [];
  const seen = new Set();
  const tokens = [];
  for (const item of list) {
    const t = parseToken(item);
    if (!t) continue;
    const key = t.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(t);
  }
  return tokens;
}

async function main() {
  const apiKey =
    process.env.MORALIS_API_KEY ||
    process.env.NEXT_PUBLIC_MORALIS_API_KEY ||
    "";
  if (!apiKey.trim()) {
    console.error("Set MORALIS_API_KEY or NEXT_PUBLIC_MORALIS_API_KEY");
    process.exit(1);
  }

  const out = {};
  for (const { chainId, param, label } of CHAINS) {
    if (param == null) {
      console.log(`${label} (${chainId}): skipped (not supported by Moralis)`);
      out[chainId] = [];
      continue;
    }
    process.stdout.write(`Fetching ${label} (${param}, ${chainId})... `);
    const tokens = await fetchTrending(apiKey, param);
    out[chainId] = tokens;
    console.log(`${tokens.length} tokens`);
  }

  const configDir = path.join(__dirname, "..", "config");
  const outputPath = path.join(configDir, "trending-tokens.json");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nWrote ${outputPath}`);
  console.log("Update committed; contracts.ts imports this file for token lists.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
