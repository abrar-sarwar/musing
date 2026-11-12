import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/facebook/FloatingTabBar";

// facebook's six bottom tabs. musing. is not one of them: it is reached from the
// home composer, feed, reels, notifications, messenger and the menu.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="reels" options={{ title: "Reels" }} />
      <Tabs.Screen name="marketplace" options={{ title: "Marketplace" }} />
      <Tabs.Screen name="dating" options={{ title: "Dating" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
