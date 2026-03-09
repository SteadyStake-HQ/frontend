# Frontend Integration Guide - SteadyStake DCA

## Overview

This guide explains how to use the SteadyStake DCA smart contracts integrated into the Next.js frontend.

## Contract Configuration

### Deployed Contracts (Base Sepolia)

All deployed contract addresses and ABIs are configured in:

- **[config/contracts.ts](../config/contracts.ts)** - Contract addresses
- **[config/abis.ts](../config/abis.ts)** - Contract ABIs
- **[lib/constants.ts](../lib/constants.ts)** - Constants and type definitions

### Supported Features

- **Frequencies**: ONEMIN (1 minute), DAILY, WEEKLY, BIWEEKLY, MONTHLY
- **Early Cancellation Fee**: 3% penalty if canceling with >50% funds remaining
- **No Fee Scenario**: No penalty if >50% of total amount already executed
- **Network**: Base Sepolia (Chain ID: 84532)

## React Hooks

### useDCAVault()

Create schedules and cancel them with full fee handling.

```typescript
const { createSchedule, cancelSchedule, isLoading } = useDCAVault();

// Create a new DCA schedule
await createSchedule(
  targetTokenAddress,     // Address of target token (e.g., AERO)
  frequencyId,            // 0=ONEMIN, 1=DAILY, 2=WEEKLY, 3=BIWEEKLY, 4=MONTHLY
  amountPerInterval,      // String amount in USDC (decimals handled)
  totalAmount             // String total amount in USDC (decimals handled)
);

// Cancel an existing schedule
await cancelSchedule(scheduleId);
```

### useDCAVaultRead()

Fetch user's active schedules.

```typescript
const { activeSchedules, scheduleCount, isLoading } = useDCAVaultRead(userAddress);

// Returns:
// - activeSchedules: Array<bigint> - List of active schedule IDs
// - scheduleCount: number - Total count of schedules
// - isLoading: boolean - Loading state
```

### useDCASchedule()

Get detailed information about a specific schedule.

```typescript
const { schedule, isReady, isLoading } = useDCASchedule(scheduleId, userAddress);

// Returns:
// - schedule: [userAddress, targetToken, frequency, amountPerInterval, totalAmount, executedCount, totalExecuted, nextExecutionTime, paused]
// - isReady: boolean - Whether schedule is ready for execution
// - isLoading: boolean - Loading state
```

### useTokenApproval()

Approve tokens for spending by the DCAVault contract.

```typescript
const { approve, isLoading } = useTokenApproval(tokenAddress);

// Approve USDC spending
await approve(
  amount,                 // String amount in token decimals
  spender                 // Address to approve (DCAVault)
);
```

### useTokenBalance()

Get user's token balance.

```typescript
const { balance, isLoading } = useTokenBalance(tokenAddress, userAddress);

// Returns balance as bigint (raw decimals)
// For USDC: balance / 1e6 = USDC amount
```

### useTokenAllowance()

Get approved spending amount for a token.

```typescript
const { allowance, isLoading } = useTokenAllowance(tokenAddress, spender, userAddress);

// Returns allowance as bigint (raw decimals)
```

## UI Components

### CreateScheduleForm

Drop-in component for creating DCA schedules with automatic approval handling.

```tsx
import { CreateScheduleForm } from "@/app/components/dca";

export default function DCAPage() {
  return <CreateScheduleForm />;
}
```

**Features:**
- Token selection dropdown (AERO, DEGEN, cbETH, USDC)
- Frequency selection (1MIN, DAILY, WEEKLY, BIWEEKLY, MONTHLY)
- Amount per interval and total amount inputs
- Automatic USDC approval when needed
- Balance display
- Error and success messages
- Execution count calculator

### ActiveSchedules

Display all active schedules for the connected user.

```tsx
import { ActiveSchedules } from "@/app/components/dca";

export default function SchedulesPage() {
  return <ActiveSchedules />;
}
```

**Features:**
- Lists all active schedules
- Shows progress bar for execution
- Displays remaining amount
- "Ready to Execute" status indicator
- Cancel button with fee warning

### CancelScheduleButton

Standalone button component with early fee confirmation modal.

```tsx
import { CancelScheduleButton } from "@/app/components/dca";

export default function ScheduleDetailPage({ scheduleId }) {
  return <CancelScheduleButton scheduleId={scheduleId} />;
}
```

**Features:**
- Shows early cancellation fee warning when applicable
- Displays net amount to be returned
- Confirms cancellation with user
- Handles transaction submission
- Shows success/error messages

## Utility Functions

### Helper Functions (useDCAHelpers.ts)

```typescript
import {
  calculateRemainingAmount,
  calculateCancelFee,
  formatUSDC,
  calculateExecutionProgress,
  calculateExecutionTime,
  formatScheduleData,
} from "@/app/hooks";

// Calculate remaining USDC to be executed
const remaining = calculateRemainingAmount(totalAmount, amountPerInterval, executedCount);

// Calculate early cancellation fee
const fee = calculateCancelFee(remainingAmount);

// Format USDC amount for display
const displayAmount = formatUSDC(amountInWei);

// Calculate execution progress percentage
const progress = calculateExecutionProgress(totalAmount, amountPerInterval, executedCount);

// Calculate next execution timestamp
const nextTime = calculateExecutionTime(startTime, executedCount, "DAILY");

// Parse raw schedule data into typed object
const schedule = formatScheduleData(rawScheduleArray);
```

### Constants (lib/constants.ts)

```typescript
import {
  FREQUENCY_MAP,           // Maps "DAILY" -> 1, "WEEKLY" -> 2, etc.
  REVERSE_FREQUENCY_MAP,   // Maps 1 -> "DAILY", 2 -> "WEEKLY", etc.
  SUPPORTED_TOKENS,        // Token addresses and metadata
  calculateRemainingSchedules,    // How many more executions left
  shouldChargeEarlyFee,    // Check if early fee applies
  calculateEarlyFee,       // Calculate 3% early fee amount
} from "@/lib/constants";

const tokenAddress = SUPPORTED_TOKENS["AERO"].address;
const chargeFee = shouldChargeEarlyFee(totalAmount, amountPerInterval, executedCount);
```

## Complete Integration Example

```tsx
"use client";

import { useAccount } from "wagmi";
import { CreateScheduleForm, ActiveSchedules } from "@/app/components/dca";

export default function DCADashboard() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="p-6 text-center">
        <p className="text-xl">Please connect your wallet to use DCA</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">SteadyStake DCA Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Create Schedule Form */}
        <div>
          <CreateScheduleForm />
        </div>

        {/* Right: Active Schedules */}
        <div>
          <ActiveSchedules />
        </div>
      </div>
    </div>
  );
}
```

## Fee Calculation Examples

### Example 1: Early Cancellation with Fee

```
Total USDC: 1000
Amount per interval: 100
Executed count: 3
Remaining: 700 USDC (70% of total)

Since 700 > 500 (50% of 1000):
Fee (3%): 700 * 0.03 = 21 USDC
Return: 700 - 21 = 679 USDC
```

### Example 2: Late Cancellation without Fee

```
Total USDC: 1000
Amount per interval: 100
Executed count: 6
Remaining: 400 USDC (40% of total)

Since 400 <= 500 (50% of 1000):
Fee: 0 USDC
Return: 400 USDC (full amount)
```

## Error Handling

All hooks and components include error handling:

```tsx
const { createSchedule, isLoading } = useDCAVault();

try {
  await createSchedule(tokenAddress, frequencyId, perInterval, total);
  console.log("Schedule created!");
} catch (error) {
  console.error("Failed to create schedule:", error.message);
  // Display error to user
}
```

## Network Configuration

Base Sepolia is configured in:
- `wagmi.ts` - Wagmi config with Base Sepolia RPC
- `config/contracts.ts` - Network ID: 84532

To switch networks:
1. Update `NETWORK_ID` in [config/contracts.ts](../config/contracts.ts)
2. Update contract addresses for new network
3. Update wagmi configuration for new RPC endpoint

## Testing on Testnet

1. **Fund wallet with Base Sepolia ETH** for gas fees
2. **Use test USDC** - Already deployed at `0x6c031A4E2d2104DDf624c03826d0ecF3C689c924`
3. **Use 1MIN frequency** for rapid testing of up to 5 executions

## Contract Interaction Flow

```
User connects wallet
    ↓
CreateScheduleForm displayed
    ↓
User selects token, frequency, amounts
    ↓
Form checks USDC balance
    ↓
Form requests USDC approval if needed
    ↓
User confirms approval tx
    ↓
Form submits createSchedule tx
    ↓
Schedule created in DCAVault
    ↓
ActiveSchedules component refreshes
    ↓
User's schedule appears in list
    ↓
User can cancel anytime (with/without fee)
```

## Files Structure

```
frontend/
├── config/
│   ├── contracts.ts          # Contract addresses & network ID
│   └── abis.ts              # Contract ABIs (DCAVault, ERC20, Resolver)
├── lib/
│   └── constants.ts         # Type definitions & utilities
├── app/
│   ├── hooks/
│   │   ├── useDCAVault.ts   # Main hooks for contract interactions
│   │   ├── useDCAHelpers.ts # Helper functions & calculations
│   │   └── index.ts         # Export all hooks
│   └── components/
│       └── dca/
│           ├── CreateScheduleForm.tsx     # Schedule creation form
│           ├── ActiveSchedules.tsx        # Schedule list display
│           ├── CancelScheduleButton.tsx   # Cancel with fee handling
│           └── index.ts                  # Export all components
```

## Support & Debugging

- Check wallet connection with `useAccount()`
- Verify contract addresses in [config/contracts.ts](../config/contracts.ts)
- Check transaction status on [Basescan](https://sepolia.basescan.org/)
- Monitor console for detailed error messages
- Ensure USDC balance is sufficient for schedule creation
- Use `formatUnits(bigInt, 6)` to convert USDC amounts for display

## Next Steps

1. Integrate DCA dashboard into existing pages
2. Add transaction notifications/toasts
3. Implement schedule monitoring dashboard
4. Add fee statistics/analytics
5. Create CLI tools for automation testing
6. Deploy to production on Base mainnet
