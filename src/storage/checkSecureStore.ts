import * as SecureStore from "expo-secure-store";

const TEST_KEY = "__wallet_secure_store_test__";

export async function checkSecureStore() {
  const existingValue = await SecureStore.getItemAsync(TEST_KEY);

  if (existingValue) {
    console.log("[SecureStore] Existing value:", existingValue);
    return;
  }

  const value = `test-${Date.now()}`;

  await SecureStore.setItemAsync(TEST_KEY, value);

  const loadedValue = await SecureStore.getItemAsync(TEST_KEY);

  console.log("[SecureStore] Written:", value);
  console.log("[SecureStore] Read:", loadedValue);
  console.log("[SecureStore] OK:", value === loadedValue);
}
