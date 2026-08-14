import { configureCore } from "@/core/config/runtimeConfig";

export function bootstrapCore() {
  const dataApiKey = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY;

  if (!dataApiKey) {
    throw new Error(
      "EXPO_PUBLIC_ALCHEMY_API_KEY is missing: add it to .env before starting the app",
    );
  }

  configureCore({ dataApiKey });
}
