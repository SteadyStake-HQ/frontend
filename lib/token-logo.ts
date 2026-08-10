/**
 * Token logo URLs. Moralis CDN returns 403 when hotlinked; we proxy via /api/token-logo
 * so logos are fetched once and cached permanently. Otherwise use Trust Wallet CDN.
 *
 * Nothing here fetches. Every function returns URLs for an `<img>` to try, which is why
 * `getTokenLogoCandidates` returns a list rather than a best guess: whether a CDN actually has a
 * given token's image is only knowable from the response, and the element is already watching for it.
 */

import { getAddress } from "viem";

const TRUST_CDN = "https://assets-cdn.trustwallet.com/blockchains";
const PROXY_PATH = "/api/token-logo";
const TRUST_CHAIN_SLUG: Partial<Record<number, string>> = {
  8453: "base",
  56: "smartchain",
  137: "polygon",
  2222: "kavaevm",
  // Trust Wallet has no BOT Chain assets repo; 677/968 fall through to no logo.
};

/**
 * CoinGecko hosts every coin image at three sizes on the same path — `/thumb/`
 * (25px), `/small/` (~50px), `/large/` (~250px) — but its token *list* only ever
 * links the thumb. Rendered at 32–56px that thumb is upscaled and looks blurry,
 * so rewrite the size segment to `/large/` for the sharp asset. Non-CoinGecko
 * URLs and URLs already at large/original are returned unchanged.
 */
export function upgradeCoinGeckoLogoUrl(url: string): string {
  try {
    const u = new URL(url);
    // Both the legacy (assets.coingecko.com) and current (coin-images.coingecko.com) hosts.
    if (!u.hostname.endsWith("coingecko.com")) return url;
    return url.replace(
      /(\/coins\/images\/\d+\/)(thumb|small)(\/)/i,
      (_m, pre: string, _size: string, post: string) => `${pre}large${post}`,
    );
  } catch {
    return url;
  }
}

/** EIP-55 form of an address, or null when the input is not one. */
function checksumAddress(address: string): string | null {
  try {
    return getAddress(address.startsWith("0x") ? address : `0x${address}`);
  } catch {
    return null;
  }
}

/**
 * Trust Wallet's asset repo names its directories with EIP-55 checksummed addresses, and the CDN
 * does not redirect a lowercased one — it 404s. URLs built with a lowercased address were stored in
 * the token list for a long time, so fixing only the code that writes them would leave every
 * existing row broken until the operator re-imported. Rewriting the address segment on the way to
 * the `<img>` repairs those rows in place. Non-Trust-Wallet URLs are returned unchanged.
 */
export function upgradeTrustWalletLogoUrl(url: string): string {
  try {
    if (!new URL(url).hostname.endsWith("trustwallet.com")) return url;
  } catch {
    return url;
  }
  return url.replace(
    /(\/assets\/)(0x[0-9a-fA-F]{40})(\/)/,
    (match, prefix: string, address: string, suffix: string) => {
      const checksummed = checksumAddress(address);
      return checksummed ? `${prefix}${checksummed}${suffix}` : match;
    },
  );
}

/** Moralis CDN host – use proxy so we can use their logo URLs permanently. */
export function isMoralisLogoUrl(url: string | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === "cdn.moralis.io" ||
      u.hostname === "logo.moralis.io" ||
      u.hostname.endsWith(".moralis.io")
    );
  } catch {
    return false;
  }
}

/**
 * Every URL worth trying for one token's logo, best first.
 *
 * A list rather than a single URL because the previous behaviour — pick one, and draw a lettered
 * avatar the moment it 404s — threw away a working image whenever the stored one was stale or the
 * token simply was not in the CDN it happened to name. The list source's own URL is the best answer
 * when there is one; Trust Wallet is a guess at a path that either exists or does not, so it belongs
 * after it, not instead of it.
 */
export function getTokenLogoCandidates(
  chainId: number,
  address: string,
  apiLogo?: string,
): string[] {
  const candidates: string[] = [];
  const add = (url: string | null | undefined) => {
    if (url && !candidates.includes(url)) candidates.push(url);
  };

  if (apiLogo) {
    add(
      isMoralisLogoUrl(apiLogo)
        ? `${PROXY_PATH}?url=${encodeURIComponent(apiLogo)}`
        : upgradeTrustWalletLogoUrl(upgradeCoinGeckoLogoUrl(apiLogo)),
    );
  }

  const slug = TRUST_CHAIN_SLUG[chainId];
  const checksummed = checksumAddress(address);
  if (slug && checksummed) add(`${TRUST_CDN}/${slug}/assets/${checksummed}/logo.png`);

  return candidates;
}

/**
 * Logo URL for display: use apiLogo if non-Moralis; if Moralis, use our proxy
 * (fetched once, cached 1 year). Otherwise Trust Wallet CDN.
 *
 * The first of `getTokenLogoCandidates`. Callers that render an `<img>` should prefer the list —
 * this one has no way to recover when the URL it returns is the broken one.
 */
export function getTokenLogoUrl(
  chainId: number,
  address: string,
  apiLogo?: string,
): string | undefined {
  return getTokenLogoCandidates(chainId, address, apiLogo)[0];
}
