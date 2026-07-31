/**
 * Multi-chain contract config. Available networks from .env (NEXT_PUBLIC_SUPPORTED_CHAIN_IDS).
 *
 * **No token list lives here.** Which tokens a plan may buy is curated per network on the backend
 * dashboard (/tokens.html) and read at runtime through /api/tokens — see
 * app/hooks/useSupportedTokens.ts. It has exactly one source, on purpose: a second one here could
 * only ever disagree with the operator, and it did — the picker went on offering tokens from a
 * committed JSON file that no operator had approved.
 *
 * The per-chain token *addresses* below are not a list. They name specific contracts the app has to
 * know by address — the settlement stablecoin above all — and they feed getContracts(), not the
 * picker.
 */
import deployedAddresses from "./deployed-addresses.json";
import {
  SUPPORTED_CHAIN_IDS,
  isSupportedChainId,
  type SupportedChainId,
} from "./chains-env";

export { SUPPORTED_CHAIN_IDS, type SupportedChainId };

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
// Kava has no live USDC: the Multichain bridge that issued 0xfA9343C3...A40f shut down in 2023 and
// left that token stranded, so native Tether USDt (6 decimals) is the vault's settlement stablecoin.
const KAVA_MAINNET_TOKENS = {
  USDT: "0x919C1c267BC06a7039e03fcc2eF738525769109c" as const,
  WKAVA: "0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b" as const,
};

// Polygon mainnet (137)
const POLYGON_MAINNET_TOKENS = {
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as const,
  WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" as const,
  WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" as const,
};

// BOT Chain mainnet (677) – https://dev-docs.botchain.ai/docs/DEX/contract-addresses/
// The chain has no USDC; bridged USDT (6 decimals) is the vault's settlement stablecoin.
const BOT_MAINNET_TOKENS = {
  USDT: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C" as const,
  WBOT: "0xD5452816194a3784dBa983426cCe7c122F4abd30" as const,
  BDexV2Router02: "0x1414eD29FdFD322c3c0a830330ed982E2D629e76" as const,
};

// BOT Chain testnet (968) – same BDEX V2 stack against testnet liquidity
const BOT_TESTNET_TOKENS = {
  USDT: "0x75edC9335175Fc0552D51D48439F229c10420fe3" as const,
  WBOT: "0xD5452816194a3784dBa983426cCe7c122F4abd30" as const,
  BDexV2Router02: "0xD6425a02f0845B8D99e349C34D2E7A576E177345" as const,
};

// Ethereum Sepolia (11155111) – MockUSDC deployment (DeployEthSepoliaWithMockUSDC)
const ETH_SEPOLIA_TOKENS = {
  USDC: "0x89A01f63A5F4b42d30483ee17c5f537A4B94b15E" as const,
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const,
  MockAERO: "0xf38525778E8EE2adD00Bfa12249Df3c2aD561a26" as const,
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Display symbol of the settlement stablecoin the vault holds on a chain. The code calls the slot
 * `MockUSDC` for historical reasons, but BOT Chain has no USDC — bridged USDT fills it — so every
 * user-facing label must come from here rather than the literal "USDC".
 */
const STABLE_SYMBOL_BY_CHAIN: Record<number, string> = {
  677: "USDT",
  968: "USDT",
  2222: "USDT", // Kava: native Tether USDt — its USDC came from the defunct Multichain bridge
};

/**
 * A chain deployed from the mock stack (`DeployBotTestnetWithMockUSDC`) really does hold MockUSDC,
 * so a recorded MockUSDC address overrides the table above. Mirrors `getStableSymbol()` in
 * backend/src/config.ts — keep the two in step.
 */
export function getStableSymbol(chainId: number): string {
  const mock = BY_CHAIN[String(chainId)]?.MockUSDC;
  if (mock && mock !== ZERO_ADDRESS) return "USDC";
  return STABLE_SYMBOL_BY_CHAIN[chainId] ?? "USDC";
}

/**
 * Decimals of the settlement stablecoin the vault holds on a chain.
 *
 * Every amount that crosses the contract boundary — plan deposits, approvals, GasTank balances —
 * is in this token's base units, so parseUnits/formatUnits must use this and never a literal 6.
 * It is 6 everywhere except BNB Chain: BSC has no liquid 6-decimal stablecoin (Binance-Peg
 * USDC/USDT, BUSD, FDUSD, USD1 and DAI are all 18-decimal, and the 6-decimal bridged wrappers hold
 * only a few hundred thousand dollars), so chain 56 settles in 18-decimal Binance-Peg USDC.
 *
 * Mirrors `getStableDecimals()` in backend/src/config.ts — keep the two in step.
 */
const STABLE_DECIMALS_BY_CHAIN: Record<number, number> = {
  56: 18, // Binance-Peg USD Coin
};

export function getStableDecimals(chainId: number): number {
  // Mock-stack chains deploy MockUSDC, which is 6-decimal like the real token.
  const mock = BY_CHAIN[String(chainId)]?.MockUSDC;
  if (mock && mock !== ZERO_ADDRESS) return 6;
  return STABLE_DECIMALS_BY_CHAIN[chainId] ?? 6;
}

/**
 * Scale used for any figure that spans chains — above all the pooled gas-tank balance the header
 * shows. Fixed at 6 decimals because that is what every consumer of those totals already assumes.
 *
 * A cross-chain sum has to be normalised before it is added up: balances live in each chain's own
 * base units, so adding BSC's 18-decimal raw balance straight into the pool inflates the total by
 * 10^12 and reads as a tank with a trillion dollars in it.
 */
export const POOLED_DECIMALS = 6;

/** Native settlement-token base units -> the canonical pooled (6-decimal) scale. */
export function toPooledUsd6(amount: bigint, chainId: number): bigint {
  const decimals = getStableDecimals(chainId);
  if (decimals === POOLED_DECIMALS) return amount;
  return decimals > POOLED_DECIMALS
    ? amount / 10n ** BigInt(decimals - POOLED_DECIMALS)
    : amount * 10n ** BigInt(POOLED_DECIMALS - decimals);
}

/** The canonical pooled (6-decimal) scale -> a chain's native settlement-token base units. */
export function fromPooledUsd6(amount: bigint, chainId: number): bigint {
  const decimals = getStableDecimals(chainId);
  if (decimals === POOLED_DECIMALS) return amount;
  return decimals > POOLED_DECIMALS
    ? amount * 10n ** BigInt(decimals - POOLED_DECIMALS)
    : amount / 10n ** BigInt(POOLED_DECIMALS - decimals);
}

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
 * The vault deployed on `chainId`, irrespective of whether this build offers that network.
 *
 * `getContracts` is gated on SUPPORTED_CHAIN_IDS, which NETWORK_TYPE filters — correct for the UI,
 * wrong for anything that has to deal with a chain the user is already on. Recording a confirmed
 * plan is the case that matters: gating it meant a `NETWORK_TYPE=mainnet` build refused to record
 * plans on Ethereum Sepolia, and those plans then never appeared on the operator dashboard.
 * Deployment is the only question worth asking there, so this answers just that.
 */
export function getDeployedVault(chainId: number): string | null {
  const vault = BY_CHAIN[String(chainId)]?.DCAVault;
  return vault && vault !== ZERO_ADDRESS ? vault : null;
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
      MockUSDC: KAVA_MAINNET_TOKENS.USDT,
      MockSwapRouter: ZERO_ADDRESS,
      MockAERO: KAVA_MAINNET_TOKENS.WKAVA,
      MockDEGEN: ZERO_ADDRESS,
      MockCBETH: ZERO_ADDRESS,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  // BOT Chain: MockUSDC holds the settlement stablecoin (USDT here) and MockSwapRouter holds
  // the UniV2SwapAdapter, matching how the other chains reuse these fields.
  if (chainId === 677) {
    return {
      chainId: 677,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: BOT_MAINNET_TOKENS.USDT,
      MockSwapRouter: addrs.ZeroExAdapter ?? ZERO_ADDRESS,
      MockAERO: BOT_MAINNET_TOKENS.WBOT,
      MockDEGEN: ZERO_ADDRESS,
      MockCBETH: ZERO_ADDRESS,
      GasTank: addrs.GasTank ?? ZERO_ADDRESS,
    };
  }

  // Testnet may run either stack: real bridged USDT + BDEX, or the self-contained
  // MockUSDC + MockSwapRouter deploy. Deployed mocks win when present.
  if (chainId === 968) {
    return {
      chainId: 968,
      DCAVault: addrs.DCAVault,
      DCAResolver: addrs.DCAResolver,
      MockUSDC: addrs.MockUSDC ?? BOT_TESTNET_TOKENS.USDT,
      MockSwapRouter: addrs.ZeroExAdapter ?? ZERO_ADDRESS,
      MockAERO: addrs.MockAERO ?? BOT_TESTNET_TOKENS.WBOT,
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

/**
 * Default chain: the first supported chain that actually has deployed contracts.
 * BOT mainnet (677) leads the switcher (botChainFirst) but may not be deployed yet —
 * it must not become the app-wide contract fallback, or CONTRACTS below would be null
 * and every consumer that isn't connected to a deployed chain would crash. Skip chains
 * missing from deployed-addresses.json.
 */
export const DEFAULT_CHAIN_ID =
  SUPPORTED_CHAIN_IDS.find((id) => getContracts(id) !== null) ??
  SUPPORTED_CHAIN_IDS[0] ??
  8453;

/** Contracts for default chain (Base mainnet). Use getContracts(chainId) when chain is known. */
export const CONTRACTS: ChainContracts = getContracts(DEFAULT_CHAIN_ID)!;

/** @deprecated Use useChainId() + getContracts(chainId). Kept for compatibility. */
export const NETWORK_ID = DEFAULT_CHAIN_ID;

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return isSupportedChainId(chainId);
}
