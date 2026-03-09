/**
 * Fetch current gas price from chain RPC and return fee overrides bumped by 20%
 * for retrying transactions that fail with "replacement transaction underpriced".
 */
const RPC_BY_CHAIN: Record<number, string> = {
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
  84532: "https://sepolia.base.org",
  8453: "https://mainnet.base.org",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  2222: "https://evm.kava.io",
};

const BUMP_PERCENT = 120n; // 20% bump

export async function getBumpedGasOptions(
  chainId: number
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  const rpc = RPC_BY_CHAIN[chainId];
  if (!rpc) {
    // Fallback: use conservative values (e.g. 30 gwei / 2 gwei)
    return {
      maxFeePerGas: 30n * 10n ** 9n,
      maxPriorityFeePerGas: 2n * 10n ** 9n,
    };
  }

  try {
    const [gasPriceRes, feeHistoryRes] = await Promise.all([
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_gasPrice",
          params: [],
          id: 1,
        }),
      }),
      fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_feeHistory",
          params: ["0x4", "latest", [25, 50, 75]],
          id: 2,
        }),
      }),
    ]);

    const gasPriceJson = await gasPriceRes.json();
    const gasPrice = BigInt(gasPriceJson.result ?? "0x0");
    if (gasPrice === 0n) throw new Error("No gas price");

    let baseFee = gasPrice / 2n;
    let maxPriorityFeePerGas = 2n * 10n ** 9n;
    if (feeHistoryRes.ok) {
      const feeHistoryJson = await feeHistoryRes.json();
      const baseFees = feeHistoryJson.result?.baseFeePerGas;
      if (Array.isArray(baseFees) && baseFees.length > 0)
        baseFee = BigInt(baseFees[baseFees.length - 1]);
      const rewards = feeHistoryJson.result?.reward;
      if (Array.isArray(rewards) && rewards.length > 0 && Array.isArray(rewards[0]) && rewards[0].length > 0) {
        const lastReward = rewards[0][rewards[0].length - 1];
        if (lastReward) maxPriorityFeePerGas = BigInt(lastReward);
      }
    }

    const bumpedGasPrice = (gasPrice * BUMP_PERCENT) / 100n;
    const bumpedPriority = (maxPriorityFeePerGas * BUMP_PERCENT) / 100n;
    const bumpedBaseFee = (baseFee * BUMP_PERCENT) / 100n;
    const maxFeePerGas = bumpedBaseFee + bumpedPriority;

    return {
      maxFeePerGas: maxFeePerGas > bumpedGasPrice ? maxFeePerGas : bumpedGasPrice,
      maxPriorityFeePerGas: bumpedPriority,
    };
  } catch {
    return {
      maxFeePerGas: 30n * 10n ** 9n,
      maxPriorityFeePerGas: 2n * 10n ** 9n,
    };
  }
}
