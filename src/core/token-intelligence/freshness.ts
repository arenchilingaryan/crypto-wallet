import {
  TOKEN_INTELLIGENCE_CACHE_POLICY_MS,
  type TokenIntelligenceFacet,
} from "./constants";
import {
  UNKNOWN,
  type Freshness,
  type NumberValue,
} from "./types";
import { asTimestamp } from "./validation";

export function getFreshness(
  observedAtValue: NumberValue,
  facet: TokenIntelligenceFacet,
  nowValue: number,
): Freshness {
  const observedAt = asTimestamp(observedAtValue);
  const now = asTimestamp(nowValue);

  if (observedAt === UNKNOWN || now === UNKNOWN || observedAt > now) {
    return "unknown";
  }

  return now - observedAt > TOKEN_INTELLIGENCE_CACHE_POLICY_MS[facet]
    ? "stale"
    : "fresh";
}
