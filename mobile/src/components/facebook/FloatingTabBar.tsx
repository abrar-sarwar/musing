import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/Avatar";
import { fb, TAB_BAR_HEIGHT } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
// the slice of react-navigation's tab bar props this bar uses. structural on purpose:
// expo-router doesn't re-export BottomTabBarProps from its root.
type BottomTabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  emitter: { emit(e: { type: "tabPress"; target: string; canPreventDefault: true }): { defaultPrevented: boolean } };
  navigateToTab(routeKey: string): void;
};

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName; badge?: number }> = {
  index: { label: "Home", icon: "home-variant-outline", iconActive: "home-variant" },
  reels: { label: "Reels", icon: "movie-open-play-outline", iconActive: "movie-open-play", badge: 1 },
  marketplace: { label: "Marketplace", icon: "storefront-outline", iconActive: "storefront" },
  dating: { label: "Dating", icon: "heart-multiple-outline", iconActive: "heart-multiple" },
  notifications: { label: "Notifications", icon: "bell-outline", iconActive: "bell" },
  profile: { label: "Profile", icon: "home-variant-outline", iconActive: "home-variant" },
};

// facebook's floating bottom navigation: a white capsule above the safe area with
// six items. the selected one sits in a soft blue highlight. on reels it goes dark.
export function FloatingTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { me } = useActingUser();
  const dark = state.routes[state.index]?.name === "reels";

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 14, 10) }]}>
      <View style={[styles.pill, dark ? styles.pillDark : styles.pillLight]}>
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          const color = dark ? "#fff" : focused ? fb.blue : fb.text;
          const onPress = () => {
            const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label} hitSlop={4}>
              <View style={[styles.highlight, focused && { backgroundColor: dark ? "rgba(255,255,255,0.2)" : fb.blueSoft }]}>
                {route.name === "profile" ? (
                  me ? (
                    <View style={[styles.avatarRing, focused && { borderColor: dark ? "#fff" : fb.blue }]}>
                      <Avatar seed={me.avatar_seed} name={me.name} size={27} />
                    </View>
                  ) : (
                    <View style={styles.avatarGhost} />
                  )
                ) : (
                  <MaterialCommunityIcons name={focused ? meta.iconActive : meta.icon} size={29} color={color} />
                )}
                {meta.badge && !focused ? (
                  <View style={[styles.badge, { borderColor: dark ? "#222" : "#fff" }]}>
                    <Text style={styles.badgeText}>{meta.badge}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
  pill: { height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 },
  pillLight: { backgroundColor: "rgba(255,255,255,0.97)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,0.14)", shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  pillDark: { backgroundColor: "rgba(38,38,40,0.88)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.22)" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: TAB_BAR_HEIGHT },
  highlight: { width: "92%", maxWidth: 76, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarRing: { borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.25)", padding: 1 },
  avatarGhost: { width: 29, height: 29, borderRadius: 15, backgroundColor: fb.input },
  badge: { position: "absolute", top: 3, right: 12, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: fb.badge, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
