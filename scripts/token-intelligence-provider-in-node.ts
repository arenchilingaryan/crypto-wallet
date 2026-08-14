import { runTokenIntelligenceAdapterSemanticTests } from "@/platform/react-native/token-intelligence/tokenIntelligenceAdapters.test";

export async function main(): Promise<void> {
  await runTokenIntelligenceAdapterSemanticTests();

  console.log("ok   token intelligence provider semantic tests");
}
