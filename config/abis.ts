/**
 * Contract ABIs for SteadyStake
 */

export const DCA_VAULT_ABI = [
  {
    type: "function",
    name: "createSchedule",
    inputs: [
      { name: "targetToken", type: "address" },
      { name: "frequency", type: "uint8" },
      { name: "amountPerInterval", type: "uint256" },
      { name: "totalAmount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createScheduleAndEnrollWithGas",
    inputs: [
      { name: "targetToken", type: "address" },
      { name: "frequency", type: "uint8" },
      { name: "amountPerInterval", type: "uint256" },
      { name: "totalAmount", type: "uint256" },
      { name: "gasAmountForTank", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeSwap",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
      { name: "swapData", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelSchedule",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSchedule",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
    ],
    outputs: [
      {
        components: [
          { name: "targetToken", type: "address" },
          { name: "frequency", type: "uint8" },
          { name: "amountPerInterval", type: "uint256" },
          { name: "lastExecutionTime", type: "uint256" },
          { name: "totalAmount", type: "uint256" },
          { name: "executedCount", type: "uint256" },
          { name: "active", type: "bool" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveSchedules",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isScheduleReady",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "scheduleCount",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feePercentage",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "enrollForAutoExecution",
    inputs: [{ name: "scheduleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEnrolledScheduleIds",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "enrolledForAutoExecution",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "enrolledCount",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "additionalAutoPlanFeeUsdc6",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "gasTank",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "autoPlanFeeRecipient",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScheduleCreated",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "scheduleId", type: "uint256", indexed: true },
      { name: "targetToken", type: "address", indexed: false },
      { name: "frequency", type: "uint8", indexed: false },
      { name: "amountPerInterval", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ScheduleCancelled",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "scheduleId", type: "uint256", indexed: true },
      { name: "returnedAmount", type: "uint256", indexed: false },
      { name: "cancelFee", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export const GAS_TANK_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "gasCostPerExecutionUsdc6",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const DCA_RESOLVER_ABI = [
  {
    type: "function",
    name: "checker",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleId", type: "uint256" },
    ],
    outputs: [
      { name: "canExec", type: "bool" },
      { name: "execPayload", type: "bytes" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "batchChecker",
    inputs: [
      { name: "user", type: "address" },
      { name: "scheduleIds", type: "uint256[]" },
    ],
    outputs: [
      { name: "executables", type: "uint256[]" },
      { name: "execPayloads", type: "bytes[]" },
    ],
    stateMutability: "view",
  },
] as const;
