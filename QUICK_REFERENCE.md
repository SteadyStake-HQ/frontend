# SteadyStake DCA - Quick Reference

## Quick Start

### Import Components
```tsx
import { CreateScheduleForm, ActiveSchedules } from "@/app/components/dca";
```

### Import Hooks
```tsx
import { 
  useDCAVault, 
  useDCAVaultRead, 
  useDCASchedule,
  useTokenBalance,
  useTokenApproval
} from "@/app/hooks";
```

### Import Constants
```tsx
import { FREQUENCY_MAP, SUPPORTED_TOKENS } from "@/lib/constants";
import { CONTRACTS, NETWORK_ID } from "@/config/contracts";
```

---

## Common Patterns

### Pattern 1: Create a Schedule
```tsx
const { createSchedule, isLoading } = useDCAVault();

const handleCreate = async () => {
  try {
    await createSchedule(
      SUPPORTED_TOKENS["AERO"].address,
      FREQUENCY_MAP["DAILY"],    // 1
      "100",                     // 100 USDC per day
      "3000"                     // 3000 USDC total
    );
    alert("Schedule created!");
  } catch (error) {
    alert(error.message);
  }
};
```

### Pattern 2: Get User's Schedules
```tsx
const { address } = useAccount();
const { activeSchedules, scheduleCount } = useDCAVaultRead(address);

// Display schedules
return (
  <div>
    <p>Active schedules: {scheduleCount}</p>
    {activeSchedules?.map(id => (
      <ScheduleItem key={id.toString()} scheduleId={id} />
    ))}
  </div>
);
```

### Pattern 3: Get Schedule Details
```tsx
const scheduleId = BigInt(1);
const { schedule, isReady } = useDCASchedule(scheduleId);

if (schedule) {
  const [user, token, freq, amountPerInterval, total, executed, totalExecuted, nextTime, paused] = schedule;
  console.log(`Executed: ${executed}, Total: ${total}`);
}
```

### Pattern 4: Check Balance Before Creating
```tsx
const { balance } = useTokenBalance(CONTRACTS.MockUSDC);
const requiredAmount = parseUnits("1000", 6);

if (balance < requiredAmount) {
  return <p>Insufficient balance. Need 1000 USDC</p>;
}
```

### Pattern 5: Handle Approval Flow
```tsx
const { approve } = useTokenApproval(CONTRACTS.MockUSDC);
const { allowance } = useTokenAllowance(
  CONTRACTS.MockUSDC, 
  CONTRACTS.DCAVault
);

if (allowance < amountRequired) {
  // Need approval
  await approve(amount, CONTRACTS.DCAVault);
}

// Then create schedule...
```

---

## Contract Interaction Flow

```
┌─────────────────────┐
│  Connect Wallet     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check USDC Balance  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Check USDC Approve  │
└──────────┬──────────┘
           │
       ├─ YES ──► Skip to Create
       │
       └─ NO ──► Approve USDC to DCAVault
                        │
                        ▼
┌─────────────────────┐
│  Create Schedule    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Schedule Active     │
│ Waiting Execution   │
└──────────┬──────────┘
           │
           ├─ Execute ──► Swap tokens
           │
           └─ Cancel ──► Return funds (fee if >50%)
```

---

## Frequency Reference

| Frequency | Code | Use Case |
|-----------|------|----------|
| ONEMIN | 0 | Testing (1 minute intervals) |
| DAILY | 1 | Production - Daily buys |
| WEEKLY | 2 | Production - Weekly buys |
| BIWEEKLY | 3 | Production - Bi-weekly buys |
| MONTHLY | 4 | Production - Monthly buys |

---

## Fee Calculation Reference

### Early Fee (3% if >50% remaining)
```
remaining > (totalAmount * 50%) 
  → fee = remaining * 3% 
  → return = remaining - fee

remaining ≤ (totalAmount * 50%) 
  → fee = 0 
  → return = remaining
```

### Protocol Fee (0.25% per execution)
```
Automatically deducted on each execution
Configurable 0-5%
```

---

## Supported Tokens

```
Target Tokens (swap TO):
- AERO (0x97aB18aAe96efC206EC7efFad8f586252A4c21A7)
- DEGEN (0x4F0646107aA0C80A315fF9f727766CDdB4Fc1844)
- cbETH (0x8f15e90F0002A874d372A9380974a2d66c57C1FF)

Source Token (swap FROM):
- USDC (0x6c031A4E2d2104DDf624c03826d0ecF3C689c924)
```

---

## Component Props Reference

### CreateScheduleForm
```tsx
<CreateScheduleForm />
// No props required
// Handles all user input & errors
```

### ActiveSchedules
```tsx
<ActiveSchedules />
// No props required
// Displays all schedules for connected wallet
```

### CancelScheduleButton
```tsx
<CancelScheduleButton scheduleId={BigInt(1)} />
// Required: scheduleId as bigint
// Shows confirmation with fee warning
```

---

## Error Handling Patterns

### Catch Common Errors
```tsx
try {
  await createSchedule(...);
} catch (error) {
  if (error.message.includes("insufficient balance")) {
    return "Need more USDC";
  }
  if (error.message.includes("not connected")) {
    return "Connect wallet first";
  }
  return error.message;
}
```

### User Feedback
```tsx
const [status, setStatus] = useState("");
const [error, setError] = useState("");

const handleCreate = async () => {
  try {
    setStatus("Creating schedule...");
    await createSchedule(...);
    setStatus("✓ Schedule created!");
    setTimeout(() => setStatus(""), 3000);
  } catch (err) {
    setError(err.message);
  }
};
```

---

## Testing Checklist

- [ ] Wallet connected to Base Sepolia
- [ ] Have USDC (test faucet: ask in Discord)
- [ ] Target token selected
- [ ] Frequency set (use ONEMIN for testing)
- [ ] Amount per interval > 0
- [ ] Total amount > amount per interval
- [ ] Total amount ≤ USDC balance
- [ ] Schedule created successfully
- [ ] Schedule appears in list
- [ ] Can cancel schedule
- [ ] Fee shown correctly on cancel

---

## Useful Links

- [Base Sepolia Faucet](https://faucet.quicknode.com/base) - Get ETH for gas
- [Basescan](https://sepolia.basescan.org/) - View transactions
- [Wagmi Docs](https://wagmi.sh/) - Hook library docs
- [Viem Docs](https://viem.sh/) - Web3 library docs

---

## Deployed Contracts (Base Sepolia)

```
DCAVault: 0xE89AdC2bb78a11F1939375ad238cb0275E5A7710
DCAResolver: 0xDEb540fc44D169791ebfeDf60b8fF646EA5D3DCB
MockUSDC: 0x6c031A4E2d2104DDf624c03826d0ecF3C689c924
MockAERO: 0x97aB18aAe96efC206EC7efFad8f586252A4c21A7
MockDEGEN: 0x4F0646107aA0C80A315fF9f727766CDdB4Fc1844
MockCBETH: 0x8f15e90F0002A874d372A9380974a2d66c57C1FF
```

---

## Common Gotchas

1. **Decimals**: USDC = 6, other tokens = 18
   ```tsx
   const usdcAmount = parseUnits("100", 6);
   const aeroAmount = parseUnits("100", 18);
   ```

2. **BigInt operations**: Always use BigInt for contract values
   ```tsx
   const remaining = totalAmount - executedAmount; // Must be bigint
   ```

3. **Approval required**: Always approve before creating schedule first time
   ```tsx
   // Check allowance first
   if (allowance < neededAmount) {
     await approve(neededAmount, DCAVault);
   }
   ```

4. **Chain ID**: Must match Base Sepolia (84532)
   ```tsx
   chainId: 84532  // Always include in contract calls
   ```

5. **Gas**: Every operation costs ETH (need to fund wallet)
   - Create schedule: ~150k gas
   - Cancel schedule: ~80k gas
   - Approve: ~45k gas

---

## Next Steps

1. **Build dashboard page** with CreateScheduleForm + ActiveSchedules
2. **Add error toast notifications**
3. **Add transaction confirmation modal**
4. **Add balance/fee summary card**
5. **Deploy to production** (update contracts.ts with mainnet addresses)

---

Need help? Check [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed documentation.
