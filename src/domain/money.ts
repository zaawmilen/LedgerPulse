// Decimal-safe money arithmetic. Never use JS floating point for currency —
// this scales every amount to an integer of 1/10000th units (matching the
// NUMERIC(20,4) columns) and does the math in BigInt.

const SCALE = 10_000n; // 4 decimal places

export function toScaled(amount: string): bigint {
  if (!/^\d+(\.\d{1,4})?$/.test(amount)) {
    throw new Error(`Invalid decimal amount: "${amount}"`);
  }
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").padEnd(4, "0");
  return BigInt(whole) * SCALE + BigInt(frac);
}

export function fromScaled(scaled: bigint): string {
  const whole = scaled / SCALE;
  const frac = scaled % SCALE;
  return `${whole}.${frac.toString().padStart(4, "0")}`;
}

export function sumScaled(amounts: string[]): bigint {
  return amounts.reduce((acc, a) => acc + toScaled(a), 0n);
}
