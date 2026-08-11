const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

export function formatTokenAmount(balance: string): string {
  const value = Number(balance);

  if (!Number.isFinite(value)) {
    return balance;
  }

  if (value === 0) {
    return "0";
  }

  if (value >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }

  return Number(value.toPrecision(5)).toString();
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
