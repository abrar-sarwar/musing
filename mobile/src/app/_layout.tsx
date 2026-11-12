import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { UserSwitcherSheet } from "@/components/shell/UserSwitcherSheet";
import { ActingUserProvider } from "@/lib/acting-user";

export default function RootLayout() {
  return (
    <ActingUserProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fff" } }} />
      <UserSwitcherSheet />
    </ActingUserProvider>
  );
}
