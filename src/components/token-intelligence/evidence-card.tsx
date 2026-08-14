import { View } from "react-native";

import { AppText } from "@/components/ui/text";
import type {
  ProviderAvailability,
  ProviderId,
  TokenIntelligence,
} from "@/core/token-intelligence/types";

import { formatTextValue, sourceLabel } from "./formatters";
import { MetricRow, SectionCard, formatObservedAge } from "./primitives";
import { styles } from "./token-intelligence.styles";

function providerStatus(provider: ProviderAvailability) {
  switch (provider.status) {
    case "available":
      return provider.observedAt === "unknown"
        ? "Available"
        : `Available · ${formatObservedAge(provider.observedAt)}`;
    case "loading":
      return "Loading";
    case "unsupported":
      return "Unsupported";
    case "unavailable":
      return "Unavailable";
  }
}

export function EvidenceCard({ intelligence }: { intelligence: TokenIntelligence }) {
  const providers = Object.entries(intelligence.availability.providers) as [
    ProviderId,
    ProviderAvailability,
  ][];

  return (
    <View style={styles.stack}>
      {intelligence.evidence.conflicts.length > 0 ? (
        <SectionCard title="Conflicting evidence" risk="high">
          <AppText variant="caption" tone="muted">
            Providers disagree. Both observations are shown; no convenient answer was selected.
          </AppText>

          <View style={styles.evidenceList}>
            {intelligence.evidence.conflicts.map((conflict) => (
              <View
                key={`${conflict.fact}:${conflict.observations.map((item) => item.source).join(":")}`}
                style={[styles.evidence, styles.conflict]}
              >
                <AppText variant="bodyStrong" tone="danger">
                  {conflict.fact}
                </AppText>
                {conflict.observations.map((observation) => (
                  <MetricRow
                    key={`${observation.source}:${observation.observedAt}:${observation.value}`}
                    label={`${sourceLabel(observation.source)} · ${formatObservedAge(observation.observedAt)}`}
                    value={observation.value}
                  />
                ))}
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Data sources" subtitle="Fact-level provenance is shown beside each metric">
        <View style={styles.rows}>
          {providers.map(([id, provider]) => (
            <MetricRow
              key={id}
              label={sourceLabel(id)}
              value={providerStatus(provider)}
              detail={
                provider.reason === "unknown"
                  ? undefined
                  : formatTextValue(provider.reason)
              }
            />
          ))}
        </View>
      </SectionCard>
    </View>
  );
}
