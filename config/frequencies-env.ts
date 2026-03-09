/**
 * Frequency options for DCA, driven by .env (NEXT_PUBLIC_FREQUENCY_OPTIONS).
 * Contract supports: 0 = 1 min, 1 = Daily, 2 = Weekly, 3 = Bi-weekly, 4 = Monthly.
 * Example: NEXT_PUBLIC_FREQUENCY_OPTIONS=0,1,2,3,4 (include 0 for 1-min test option).
 */

const LABELS: Record<number, string> = {
  0: "1 Minute",
  1: "Daily",
  2: "Weekly",
  3: "Bi-weekly",
  4: "Monthly",
};

const ALL_IDS = [0, 1, 2, 3, 4] as const;
const DEFAULT_IDS: number[] = [0, 1, 2, 3, 4]; // Include 1min (0) for test; set .env to 1,2,3,4 to hide it

function parseFrequencyIds(): number[] {
  const raw = process.env.NEXT_PUBLIC_FREQUENCY_OPTIONS?.trim();
  if (!raw) return [...DEFAULT_IDS];
  const ids = raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && ALL_IDS.includes(n as (typeof ALL_IDS)[number]));
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique : [...DEFAULT_IDS];
}

const PARSED_IDS = parseFrequencyIds();

export const FREQUENCY_OPTIONS: { id: number; label: string }[] = PARSED_IDS.map((id) => ({
  id,
  label: LABELS[id] ?? `Frequency ${id}`,
}));

export type FrequencyOptionId = (typeof FREQUENCY_OPTIONS)[number]["id"];
