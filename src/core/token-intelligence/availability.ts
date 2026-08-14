import type {
  Availability,
  ProviderSnapshot,
  ProviderStatus,
} from "./types";

export function providerStatus<T>(snapshot: ProviderSnapshot<T>): ProviderStatus {
  return snapshot.status;
}

export function sectionAvailability(
  snapshots: readonly ProviderSnapshot<unknown>[],
  requiredAvailable = snapshots.length,
): Availability {
  if (snapshots.length === 0) {
    return "unavailable";
  }

  const available = snapshots.filter((item) => item.status === "available").length;
  const loading = snapshots.some((item) => item.status === "loading");
  const unsupported = snapshots.every((item) => item.status === "unsupported");

  if (unsupported) {
    return "unsupported";
  }

  if (available >= requiredAvailable) {
    return "available";
  }

  if (available > 0) {
    return "partial";
  }

  if (loading) {
    return "loading";
  }

  return "unavailable";
}

export function overallAvailability(
  sections: readonly Availability[],
): Availability {
  if (sections.every((item) => item === "unsupported")) {
    return "unsupported";
  }

  if (sections.every((item) => item === "unavailable")) {
    return "unavailable";
  }

  if (sections.every((item) => item === "loading")) {
    return "loading";
  }

  if (sections.every((item) => item === "available")) {
    return "available";
  }

  return "partial";
}

export function providerObservedAt<T>(
  snapshot: ProviderSnapshot<T>,
): number | null {
  return snapshot.status === "available" ? snapshot.observedAt : null;
}
