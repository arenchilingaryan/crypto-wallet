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

export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }

  return formatUsd(value);
}

export function formatTokenPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1) {
    return formatUsd(value);
  }

  return `$${Number(value.toPrecision(4))}`;
}
