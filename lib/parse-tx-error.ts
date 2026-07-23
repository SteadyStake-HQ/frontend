/**
 * Turn a raw wallet/viem error into a short, human-readable message.
 *
 * viem's `Error.message` is a multi-line dump — the contract call, ABI args,
 * a docs link, the sender, the viem version, etc. Dropping that straight into
 * a toast is unreadable (see the "User denied transaction signature" blob).
 * This collapses the common cases to a single friendly sentence and, for
 * anything unrecognised, returns just the first meaningful line.
 */

/** Pull a lowercased searchable string out of whatever was thrown. */
function errorText(err: unknown): string {
  if (err instanceof Error) {
    // viem nests the useful bits under these; include them all.
    const parts = [err.message];
    const anyErr = err as { shortMessage?: string; details?: string; cause?: unknown };
    if (anyErr.shortMessage) parts.push(anyErr.shortMessage);
    if (anyErr.details) parts.push(anyErr.details);
    if (anyErr.cause instanceof Error) parts.push(anyErr.cause.message);
    return parts.join(" ");
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function parseTxError(err: unknown, fallback = "Transaction failed"): string {
  const raw = errorText(err);
  const text = raw.toLowerCase();

  // User rejected in the wallet — by far the most common "error".
  if (
    text.includes("user rejected") ||
    text.includes("user denied") ||
    text.includes("rejected the request") ||
    text.includes("denied transaction") ||
    text.includes("action_rejected") ||
    /\bcode:?\s*4001\b/.test(text)
  ) {
    return "You cancelled the transaction in your wallet.";
  }

  // Gas / balance problems.
  if (text.includes("insufficient funds")) {
    return "Not enough funds to cover the transaction and gas fee.";
  }
  if (text.includes("transfer amount exceeds balance") || text.includes("exceeds balance")) {
    return "Your token balance is too low for this amount.";
  }
  if (text.includes("insufficient allowance") || text.includes("exceeds allowance")) {
    return "Token approval is too low — please approve again.";
  }

  // Nonce / replacement issues (the underpriced retry path lives elsewhere).
  if (text.includes("nonce too low")) {
    return "Wallet nonce out of sync — refresh and try again.";
  }
  if (text.includes("replacement transaction underpriced") || text.includes("underpriced")) {
    return "Gas price too low to replace the pending transaction. Try again.";
  }

  // On-chain revert.
  if (text.includes("reverted") || text.includes("execution reverted")) {
    const reason = extractRevertReason(raw);
    return reason ? `Transaction reverted: ${reason}` : "Transaction reverted on-chain.";
  }

  // Network / RPC.
  if (
    text.includes("network error") ||
    text.includes("failed to fetch") ||
    text.includes("timeout") ||
    text.includes("timed out")
  ) {
    return "Network error — check your connection and try again.";
  }
  if (text.includes("chain mismatch") || text.includes("does not match the target chain")) {
    return "Wrong network selected in your wallet.";
  }

  // Unknown: return the first non-empty line, trimmed to a sane length.
  const firstLine = raw.split("\n").map((l) => l.trim()).find(Boolean);
  if (!firstLine) return fallback;
  return firstLine.length > 140 ? `${firstLine.slice(0, 137)}…` : firstLine;
}

/** Best-effort extraction of a revert reason string from a viem error dump. */
function extractRevertReason(raw: string): string | null {
  const match =
    raw.match(/reverted(?:\s+with(?:\s+the\s+following)?\s+reason)?:\s*["']?([^"'\n]+)/i) ||
    raw.match(/reason:\s*["']?([^"'\n]+)/i);
  if (!match) return null;
  const reason = match[1].trim();
  return reason && reason.toLowerCase() !== "reverted" ? reason : null;
}
