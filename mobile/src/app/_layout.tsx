import { Stack, useGlobalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { LaunchIntro } from "@/components/musing/LaunchIntro";
import { UserSwitcherSheet } from "@/components/shell/UserSwitcherSheet";
import { ActingUserProvider, useActingUser } from "@/lib/acting-user";
import { PrefsProvider } from "@/lib/prefs";
import { ToastProvider } from "@/lib/toast";
import { SafeAreaProvider } from "react-native-safe-area-context";

// demo affordance: any link with ?as=<userId> switches the acting user first,
// so a qr code or deep link can open a second phone straight into a friend's view.
function ActAsFromLink() {
  const { as } = useGlobalSearchParams<{ as?: string }>();
  const { userId, users, switchTo } = useActingUser();
  useEffect(() => {
    if (as && as !== userId && users.some((u) => u.id === as)) switchTo(as);
  }, [as, userId, users, switchTo]);
  return null;
}

export default function RootLayout() {
  return (
    <ActingUserProvider>
      <PrefsProvider>
        <SafeAreaProvider>
          <ToastProvider>
            <ActAsFromLink />
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#fff" } }} />
            <UserSwitcherSheet />
            <LaunchIntro />
          </ToastProvider>
        </SafeAreaProvider>
      </PrefsProvider>
    </ActingUserProvider>
  );
}
