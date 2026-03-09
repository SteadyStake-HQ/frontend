/**
 * Token logo URLs. Moralis CDN returns 403 when hotlinked; we proxy via /api/token-logo
 * so logos are fetched once and cached permanently. Otherwise use Trust Wallet CDN.
 */

const TRUST_CDN = "https://assets-cdn.trustwallet.com/blockchains";
const PROXY_PATH = "/api/token-logo";
const TRUST_CHAIN_SLUG: Partial<Record<number, string>> = {
  8453: "base",
  56: "smartchain",
  137: "polygon",
  2222: "kavaevm",
};

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
 * Logo URL for display: use apiLogo if non-Moralis; if Moralis, use our proxy
 * (fetched once, cached 1 year). Otherwise Trust Wallet CDN.
 */
export function getTokenLogoUrl(
  chainId: number,
  address: string,
  apiLogo?: string,
): string | undefined {
  if (apiLogo && isMoralisLogoUrl(apiLogo)) {
    return `${PROXY_PATH}?url=${encodeURIComponent(apiLogo)}`;
  }
  if (apiLogo && !isMoralisLogoUrl(apiLogo)) return apiLogo;
  const slug = TRUST_CHAIN_SLUG[chainId];
  if (!slug) return undefined;
  const addr = (
    address.startsWith("0x") ? address : `0x${address}`
  ).toLowerCase();
  return `${TRUST_CDN}/${slug}/assets/${addr}/logo.png`;
}
