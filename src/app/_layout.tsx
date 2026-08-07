import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Wallet",
        }}
      />

      <Stack.Screen
        name="explore"
        options={{
          title: "Explore",
        }}
      />
    </Stack>
  );
}
