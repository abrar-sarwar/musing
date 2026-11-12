import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { UserSwitcherSheet } from "@/components/shell/UserSwitcherSheet";
import { ActingUserProvider } from "@/lib/acting-user";
import { PrefsProvider } from "@/lib/prefs";

export default function RootLayout() {
  return (
    <ActingUserProvider>
      <PrefsProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fff" } }} />
        <UserSwitcherSheet />
      </PrefsProvider>
    </ActingUserProvider>
  );
}
