export type CoreConfig = {
  dataApiKey: string;
};

let config: CoreConfig | null = null;

export function configureCore(next: CoreConfig) {
  config = next;
}

export function getCoreConfig(): CoreConfig {
  if (!config) {
    throw new Error(
      "Core is not configured: call configureCore() from the platform entry point",
    );
  }

  return config;
}

export function getDataApiKey(): string {
  const { dataApiKey } = getCoreConfig();

  if (!dataApiKey) {
    throw new Error("Data provider API key is missing");
  }

  return dataApiKey;
}

export function resetCoreConfig() {
  config = null;
}
