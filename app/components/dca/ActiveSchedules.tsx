"use client";

import { useAccount } from "wagmi";
import { useDCAVaultRead, useDCASchedule, useContracts } from "@/app/hooks";
import { REVERSE_FREQUENCY_MAP, getTokenSymbolForAddress } from "@/lib/constants";
import { CancelScheduleButton } from "./CancelScheduleButton";
import { formatUnits } from "viem";

export const ActiveSchedules = () => {
  const { address, isConnected } = useAccount();
  const { activeSchedules, scheduleCount, isLoading } = useDCAVaultRead(address);

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please connect your wallet to view schedules</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600">Loading schedules...</p>
      </div>
    );
  }

  if (scheduleCount === 0 || (activeSchedules && activeSchedules.length === 0)) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800">No active DCA schedules yet</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Active Schedules</h2>

      <div className="space-y-4">
        {activeSchedules &&
          activeSchedules.map((scheduleId: bigint) => (
            <ScheduleCard
              key={scheduleId.toString()}
              scheduleId={scheduleId}
              userAddress={address}
            />
          ))}
      </div>
    </div>
  );
};

interface ScheduleCardProps {
  scheduleId: bigint;
  userAddress?: string;
}

const ScheduleCard = ({ scheduleId, userAddress }: ScheduleCardProps) => {
  const { chainId } = useContracts();
  const { schedule, isReady, isLoading } = useDCASchedule(scheduleId, userAddress);

  if (isLoading || !schedule) {
    return <div className="p-4 bg-gray-100 rounded-lg">Loading schedule...</div>;
  }

  const tokenSymbol = getTokenSymbolForAddress(chainId, schedule.targetToken as string);

  const frequency = REVERSE_FREQUENCY_MAP[schedule.frequency as keyof typeof REVERSE_FREQUENCY_MAP];
  const amountPerInterval = formatUnits(schedule.amountPerInterval, 6);
  const remainingNum = Number(formatUnits(schedule.totalAmount, 6));
  const amountNum = Number(amountPerInterval);
  const executedCount = Number(schedule.executedCount);
  // Contract stores remaining; original deposit = remaining + (amountPerInterval * executedCount)
  const originalTotalNum = remainingNum + amountNum * executedCount;
  const totalSchedules = Math.ceil(originalTotalNum / amountNum) || 1;
  const executionProgress = (executedCount / totalSchedules) * 100;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Target Token</p>
          <p className="text-lg font-semibold text-gray-800">{tokenSymbol}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Frequency</p>
          <p className="text-lg font-semibold text-gray-800">{frequency}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Amount Per Interval</p>
          <p className="text-lg font-semibold text-gray-800">{amountPerInterval} USDC</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Total deposited</p>
          <p className="text-lg font-semibold text-gray-800">{originalTotalNum.toFixed(2)} USDC</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Executed / Total</p>
          <p className="text-lg font-semibold text-gray-800">
            {executedCount} / {totalSchedules}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Remaining</p>
          <p className="text-lg font-semibold text-blue-600">
            {remainingNum.toFixed(2)} USDC
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <p className="text-sm text-gray-600">Progress</p>
          <p className="text-sm font-medium text-gray-800">{executionProgress.toFixed(1)}%</p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${executionProgress}%` }}
          />
        </div>
      </div>

      {/* Status and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              isReady
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {isReady ? "Ready to Execute" : "Waiting"}
          </span>
        </div>
        <CancelScheduleButton scheduleId={scheduleId} />
      </div>
    </div>
  );
};
