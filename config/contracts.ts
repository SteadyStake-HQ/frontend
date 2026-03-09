/**
 * Multi-chain contract config. Available networks from .env (NEXT_PUBLIC_SUPPORTED_CHAIN_IDS).
 * Token lists: import from ./trending-tokens.json (run `npm run fetch-trending-tokens` weekly/monthly, then commit).
 */
import deployedAddresses from "./deployed-addresses.json";
import trendingTokensData from "./trending-tokens.json";
import { getTokenLogoUrl, isMoralisLogoUrl } from "@/lib/token-logo";
import {
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
  type SupportedChainId,
} from "./chains-env";

export { SUPPORTED_CHAIN_IDS, type SupportedChainId };

/** Single token entry for UI and swap/DCA: name, symbol, address, decimals, logo. */
export interface TokenListEntry {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logo?: string;
}

const BY_CHAIN = deployedAddresses as Record<
  string,
  {
    chainId: number;
    DCAVault: string;
    DCAResolver: string;
    ZeroExAdapter: string;
    GasTank?: string;
    /** Base Sepolia: from sync-base-sepolia.js after deploy */
    MockUSDC?: string;
    MockAERO?: string;
    MockDEGEN?: string;
    MockCBETH?: string;
  }
>;

// Base mainnet canonical token addresses
const BASE_MAINNET_TOKENS = {
  USDC: "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913" as const,
  AERO: "0x940181a94a35a4569e4529a3cdfb74e38fd98631" as const,
  DEGEN: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed" as const,
  cbETH: "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22" as const,
};

// Base Sepolia testnet (mock tokens – match contracts/script/Deploy.s.sol:DeployTestnet)
const BASE_SEPOLIA_TOKENS = {
  USDC: "0xAbd1a2748Bc70bD439F0438C22D1E92C0Eae3dA8" as const,
  MockSwapRouter: "0x31E7944eF2e5D9f9bEcf60bBfB2ED1CD93D4685e" as const,
  AERO: "0xE17D603EbD845AF1da46269A1F01512Bc18d3928" as const,
  DEGEN: "0x45ADdb2ecB6E510F62cB4Ed84E0329470D72032D" as const,
  cbETH: "0x40132aD82ff25D738f8C699D137E45011149B36B" as const,
};

// BNB Chain mainnet canonical token addresses
const BNB_MAINNET_TOKENS = {
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as const,
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const,
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as const,
  PEPE: "0x25d887ce7a35172c62febfd67a1856f20faebb00" as const,
};

// Kava EVM mainnet (2222)
const KAVA_MAINNET_TOKENS = {
  USDC: "0xfA9343C3897324496A05fC75abeD6bAC29f8A40f" as const,
  WKAVA: "0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b" as const,
};

// Polygon mainnet (137)
const POLYGON_MAINNET_TOKENS = {
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const,
  WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" as const,
  WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" as const,
};

// Ethereum Sepolia (11155111) – MockUSDC deployment (DeployEthSepoliaWithMockUSDC)
const ETH_SEPOLIA_TOKENS = {
  USDC: "0x89A01f63A5F4b42d30483ee17c5f537A4B94b15E" as const,
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const,
  MockAERO: "0xf38525778E8EE2adD00Bfa12249Df3c2aD561a26" as const,
};

// Static token lists with name, symbol, address, decimals, logo (Trust Wallet CDN – no 403)
const BASE_MAINNET_TOKEN_LIST: TokenListEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: BASE_MAINNET_TOKENS.USDC,
    decimals: 6,
    logo: getTokenLogoUrl(8453, BASE_MAINNET_TOKENS.USDC),
  },
  {
    name: "Aerodrome",
    symbol: "AERO",
    address: BASE_MAINNET_TOKENS.AERO,
    decimals: 18,
    logo: getTokenLogoUrl(8453, BASE_MAINNET_TOKENS.AERO),
  },
  {
    name: "Degen",
    symbol: "DEGEN",
    address: BASE_MAINNET_TOKENS.DEGEN,
    decimals: 18,
    logo: getTokenLogoUrl(8453, BASE_MAINNET_TOKENS.DEGEN),
  },
  {
    name: "Coinbase Staked ETH",
    symbol: "cbETH",
    address: BASE_MAINNET_TOKENS.cbETH,
    decimals: 18,
    logo: getTokenLogoUrl(8453, BASE_MAINNET_TOKENS.cbETH),
  },
];

const BASE_SEPOLIA_TOKEN_LIST: TokenListEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: BASE_SEPOLIA_TOKENS.USDC,
    decimals: 6,
    logo: undefined,
  },
  {
    name: "Aerodrome",
    symbol: "AERO",
    address: BASE_SEPOLIA_TOKENS.AERO,
    decimals: 18,
    logo: undefined,
  },
  {
    name: "Degen",
    symbol: "DEGEN",
    address: BASE_SEPOLIA_TOKENS.DEGEN,
    decimals: 18,
    logo: undefined,
  },
  {
    name: "Coinbase Staked ETH",
    symbol: "cbETH",
    address: BASE_SEPOLIA_TOKENS.cbETH,
    decimals: 18,
    logo: undefined,
  },
];

const BNB_MAINNET_TOKEN_LIST: TokenListEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: BNB_MAINNET_TOKENS.USDC,
    decimals: 18,
    logo: getTokenLogoUrl(56, BNB_MAINNET_TOKENS.USDC),
  },
  {
    name: "Wrapped BNB",
    symbol: "WBNB",
    address: BNB_MAINNET_TOKENS.WBNB,
    decimals: 18,
    logo: getTokenLogoUrl(56, BNB_MAINNET_TOKENS.WBNB),
  },
  {
    name: "Binance USD",
    symbol: "BUSD",
    address: BNB_MAINNET_TOKENS.BUSD,
    decimals: 18,
    logo: getTokenLogoUrl(56, BNB_MAINNET_TOKENS.BUSD),
  },
  {
    name: "Pepe",
    symbol: "PEPE",
    address: BNB_MAINNET_TOKENS.PEPE,
    decimals: 18,
    logo: getTokenLogoUrl(56, BNB_MAINNET_TOKENS.PEPE),
  },
];

const KAVA_MAINNET_TOKEN_LIST: TokenListEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: KAVA_MAINNET_TOKENS.USDC,
    decimals: 6,
    logo: getTokenLogoUrl(2222, KAVA_MAINNET_TOKENS.USDC),
  },
  {
    name: "Wrapped KAVA",
    symbol: "WKAVA",
    address: KAVA_MAINNET_TOKENS.WKAVA,
    decimals: 18,
    logo: getTokenLogoUrl(2222, KAVA_MAINNET_TOKENS.WKAVA),
  },
];

const POLYGON_MAINNET_TOKEN_LIST: TokenListEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: POLYGON_MAINNET_TOKENS.USDC,
    decimals: 6,
    logo: getTokenLogoUrl(137, POLYGON_MAINNET_TOKENS.USDC),
  },
  {
    name: "Wrapped Ether",
    symbol: "WETH",
    address: POLYGON_MAINNET_TOKENS.WETH,
    decimals: 18,
    logo: getTokenLogoUrl(137, POLYGON_MAINNET_TOKENS.WETH),
  },
  {
    name: "Wrapped MATIC",
    symbol: "WMATIC",
    address: POLYGON_MAINNET_TOKENS.WMATIC,
    decimals: 18,
    logo: getTokenLogoUrl(137, POLYGON_MAINNET_TOKENS.WMATIC),
  },
];

const ETH_SEPOLIA_TOKEN_LIST: TokenListEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    address: ETH_SEPOLIA_TOKENS.USDC,
    decimals: 6,
    logo: getTokenLogoUrl(11155111, ETH_SEPOLIA_TOKENS.USDC),
  },
  {
    name: "Aerodrome",
    symbol: "AERO",
    address: ETH_SEPOLIA_TOKENS.MockAERO,
    decimals: 18,
    logo: getTokenLogoUrl(11155111, ETH_SEPOLIA_TOKENS.MockAERO),
  },
];

type RawTrendingToken = {
  name?: string;
  symbol?: string;
  address?: string;
  decimals?: number;
  logo?: string;
};

/** Normalize trending-tokens.json entry to TokenListEntry. Keep Moralis logo URLs – UI proxies them for permanent use. */
function normalizeTrendingList(
  chainId: number,
  raw: RawTrendingToken[],
): TokenListEntry[] {
  const list: TokenListEntry[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const addr = typeof t.address === "string" ? t.address : "";
    const address = (addr.startsWith("0x") ? addr : `0x${addr}`).toLowerCase();
    if (!address || address.length !== 42 || seen.has(address)) continue;
    seen.add(address);
    const logo = t.logo ?? getTokenLogoUrl(chainId, address);
    list.push({
      name: typeof t.name === "string" ? t.name : "Unknown",
      symbol: typeof t.symbol === "string" ? t.symbol : "???",
      address,
      decimals:
        typeof t.decimals === "number" && t.decimals >= 0 ? t.decimals : 18,
      logo: logo ?? undefined,
    });
  }
  return list;
}

/** Trending tokens from public/trending-tokens.json (BNB, BASE, Polygon; Kava empty). */
const TRENDING_BY_CHAIN = (() => {
  const data = trendingTokensData as Record<string, RawTrendingToken[]>;
  const out: Partial<Record<number, TokenListEntry[]>> = {};
  for (const chainId of [56, 8453, 137]) {
    const raw = data[String(chainId)];
    if (Array.isArray(raw) && raw.length > 0)
      out[chainId] = normalizeTrendingList(chainId, raw);
  }
  return out;
})();

/** Token list for a chain: from trending-tokens.json (BNB/BASE/Polygon) or built-in list. */
export function getTokenList(chainId: number): TokenListEntry[] {
  const fromTrending = TRENDING_BY_CHAIN[chainId];
  if (fromTrending && fromTrending.length > 0) return fromTrending;
  switch (chainId) {
    case 8453:
      return BASE_MAINNET_TOKEN_LIST;
    case 11155111:
      return ETH_SEPOLIA_TOKEN_LIST;
    case 84532: {
      const addrs = BY_CHAIN["84532"];
      if (addrs?.MockUSDC && addrs?.MockAERO) {
        return [
          {
            name: "USD Coin",
            symbol: "USDC",
            address: addrs.MockUSDC,
            decimals: 6,
            logo: undefined,
          },
          {
            name: "Aerodrome",
            symbol: "AERO",
            address: addrs.MockAERO,
            decimals: 18,
            logo: undefined,
          },
          {
            name: "Degen",
            symbol: "DEGEN",
            address: addrs.MockDEGEN || BASE_SEPOLIA_TOKENS.DEGEN,
            decimals: 18,
            logo: undefined,
          },
          {
            name: "Coinbase Staked ETH",
            symbol: "cbETH",
            address: addrs.MockCBETH || BASE_SEPOLIA_TOKENS.cbETH,
            decimals: 18,
            logo: undefined,
          },
        ];
      }
      return BASE_SEPOLIA_TOKEN_LIST;
    }
    case 56:
      return BNB_MAINNET_TOKEN_LIST;
    case 2222:
      return KAVA_MAINNET_TOKEN_LIST;
    case 137:
      return POLYGON_MAINNET_TOKEN_LIST;
    default:
      return [];
  }
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface ChainContracts {
  chainId: number;
  DCAVault: string;
  DCAResolver: string;
  MockUSDC: string;
  MockSwapRouter: string;
  MockAERO: string;
  MockDEGEN: string;
  MockCBETH: string;
  /** Gas tank for DCA execution gas; zero address if not deployed on chain */
  GasTank: string;
}

/**
 * Get contract and token addresses for a given chain. Returns null if chain is not supported (see .env NEXT_PUBLIC_SUPPORTED_CHAIN_IDS).
 */
export function getContracts(chainId: number): ChainContracts | null {
  if (!isSupportedChainId(chainId)) return null;
  const addrs = BY_CHAIN[String(chainId)];
  if (!addrs) return null;

  const isBase = chainId === 8453;
  const isBaseSepolia = chainId === 84532;
  const isEthSepolia = chainId === 11155111;
  const isBNB = chainId === 56;
  const isKava = chainId === 2222;
  const isPolygon = chainId === 137;

  if (isBase) {
    return {
      chainId: 8453,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: BASE_MAINNET_TOKENS.USDC,
      MockSwapRouter: ZERO_ADDRESS,
      MockAERO: BASE_MAINNET_TOKENS.AERO,
      MockDEGEN: BASE_MAINNET_TOKENS.DEGEN,
      MockCBETH: BASE_MAINNET_TOKENS.cbETH,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  if (isBaseSepolia) {
    return {
      chainId: 84532,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: addrs.MockUSDC || BASE_SEPOLIA_TOKENS.USDC,
      MockSwapRouter: addrs.ZeroExAdapter || BASE_SEPOLIA_TOKENS.MockSwapRouter,
      MockAERO: addrs.MockAERO || BASE_SEPOLIA_TOKENS.AERO,
      MockDEGEN: addrs.MockDEGEN || BASE_SEPOLIA_TOKENS.DEGEN,
      MockCBETH: addrs.MockCBETH || BASE_SEPOLIA_TOKENS.cbETH,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  if (isEthSepolia) {
    return {
      chainId: 11155111,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: addrs.MockUSDC ?? ETH_SEPOLIA_TOKENS.USDC,
      MockSwapRouter: addrs.ZeroExAdapter ?? ZERO_ADDRESS,
      MockAERO: addrs.MockAERO ?? ETH_SEPOLIA_TOKENS.MockAERO,
      MockDEGEN: ZERO_ADDRESS,
      MockCBETH: ZERO_ADDRESS,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  if (isBNB) {
    return {
      chainId: 56,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: BNB_MAINNET_TOKENS.USDC,
      MockSwapRouter: ZERO_ADDRESS,
      MockAERO: BNB_MAINNET_TOKENS.WBNB,
      MockDEGEN: BNB_MAINNET_TOKENS.BUSD,
      MockCBETH: ZERO_ADDRESS,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  if (isKava) {
    return {
      chainId: 2222,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: KAVA_MAINNET_TOKENS.USDC,
      MockSwapRouter: ZERO_ADDRESS,
      MockAERO: KAVA_MAINNET_TOKENS.WKAVA,
      MockDEGEN: ZERO_ADDRESS,
      MockCBETH: ZERO_ADDRESS,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  if (isPolygon) {
    return {
      chainId: 137,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: POLYGON_MAINNET_TOKENS.USDC,
      MockSwapRouter: ZERO_ADDRESS,
      MockAERO: POLYGON_MAINNET_TOKENS.WETH,
      MockDEGEN: POLYGON_MAINNET_TOKENS.WMATIC,
      MockCBETH: ZERO_ADDRESS,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  return null;
}

/** Default chain (first in NEXT_PUBLIC_SUPPORTED_CHAIN_IDS, or Base mainnet) */
export const DEFAULT_CHAIN_ID = SUPPORTED_CHAIN_IDS[0] ?? 8453;

/** Contracts for default chain (Base mainnet). Use getContracts(chainId) when chain is known. */
export const CONTRACTS: ChainContracts = getContracts(DEFAULT_CHAIN_ID)!;

/** @deprecated Use useChainId() + getContracts(chainId). Kept for compatibility. */
export const NETWORK_ID = DEFAULT_CHAIN_ID;

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return isSupportedChainId(chainId);
}
