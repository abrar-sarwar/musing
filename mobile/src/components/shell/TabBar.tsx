import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fb, muse, museGradient } from "@/constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
// the slice of react-navigation's tab bar props this bar uses. structural on purpose:
// expo-router doesn't re-export BottomTabBarProps from its root.
type BottomTabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  emitter: { emit(e: { type: "tabPress"; target: string; canPreventDefault: true }): { defaultPrevented: boolean } };
  navigateToTab(routeKey: string): void;
};

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName; muse?: boolean }> = {
  index: { label: "Home", icon: "home-outline", iconActive: "home" },
  reels: { label: "Reels", icon: "play-circle-outline", iconActive: "play-circle" },
  musing: { label: "musing.", icon: "sparkles-outline", iconActive: "sparkles", muse: true },
  events: { label: "Events", icon: "calendar-outline", iconActive: "calendar" },
  menu: { label: "Menu", icon: "menu-outline", iconActive: "menu" },
};

// facebook-style bottom tabs with a top indicator. musing gets the gradient.
export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {state.routes.map((route, i) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const color = meta.muse ? (focused ? muse.text : fb.muted) : focused ? fb.blue : fb.muted;
        const onPress = () => {
          const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label}>
            {focused &&
              (meta.muse ? (
                <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.indicator} />
              ) : (
                <View style={[styles.indicator, { backgroundColor: fb.blue }]} />
              ))}
            {meta.muse ? (
              <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.museIcon, !focused && { opacity: 0.75 }]}>
                <Ionicons name="sparkles" size={15} color="#fff" />
              </LinearGradient>
            ) : (
              <Ionicons name={focused ? meta.iconActive : meta.icon} size={26} color={color} />
            )}
            <Text style={[styles.label, { color }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: fb.divider,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 2 },
  indicator: { position: "absolute", top: -6, left: 16, right: 16, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  museIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10 },
});
