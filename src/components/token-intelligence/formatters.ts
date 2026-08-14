import { formatUnits } from "viem";

import type {
  BalanceValue,
  DomainMetric,
  Evidence,
  NumberValue,
  ProviderId,
  TextValue,
  TriState,
} from "@/core/token-intelligence/types";

const SOURCE_LABEL: Record<ProviderId, string> = {
  goplus: "GoPlus",
  "honeypot-check": "Honeypot simulation",
  "honeypot-top-holders": "Honeypot holders",
};

export function sourceLabel(source: ProviderId) {
  return SOURCE_LABEL[source];
}

export function formatSources(sources: readonly ProviderId[]) {
  const unique = [...new Set(sources)];

  return unique.length > 0
    ? unique.map((source) => sourceLabel(source)).join(", ")
    : "Source unknown";
}

export function formatPercent(value: NumberValue, digits = 1) {
  return value === "unknown" ? "Unknown" : `${value.toFixed(digits)}%`;
}

export function formatCount(value: NumberValue) {
  return value === "unknown" ? "Unknown" : Math.round(value).toLocaleString("en-US");
}

export function formatUsdValue(value: NumberValue) {
  if (value === "unknown") {
    return "Unknown";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 2,
  }).format(value);
}

export function formatNumberValue(value: NumberValue) {
  return value === "unknown"
    ? "Unknown"
    : value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function formatRawBalance(value: BalanceValue) {
  if (value === "unknown") {
    return "Unknown";
  }

  if (value.decimals === "unknown") {
    return `${value.units.toLocaleString("en-US")} raw units`;
  }

  return `${formatUnits(value.units, value.decimals)} token units`;
}

export function formatTextValue(value: TextValue) {
  return value === "unknown" || value.trim().length === 0 ? "Unknown" : value;
}

export function formatTriState(value: TriState, yes: string, no: string) {
  if (value === "unknown") {
    return "Unknown";
  }

  return value ? yes : no;
}

export function formatMetric<T>(
  metric: DomainMetric<T>,
  formatter: (value: T) => string,
) {
  return metric.value === "unknown" ? "Unknown" : formatter(metric.value);
}

export function evidenceSources<T>(evidence: Evidence<T>) {
  return formatSources(evidence.observations.map((item) => item.source));
}

export function qualityDetail(metric: DomainMetric<unknown>) {
  if (metric.quality === "complete") {
    return formatSources(metric.sources);
  }

  if (metric.quality === "partial") {
    return `Partial · ${formatSources(metric.sources)}`;
  }

  return "Coverage unknown";
}

export function formatDate(value: NumberValue) {
  if (value === "unknown") {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
