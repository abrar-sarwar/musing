import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { IconCircle } from "@/components/ui/IconCircle";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { PrototypeBadge } from "./PrototypeBadge";

// facebook-style header. logo spot, badge, search, messenger, and the user switcher avatar.
export function TopBar() {
  const { me, openSwitcher } = useActingUser();
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>f</Text>
      </View>
      <View style={{ flex: 1 }} />
      <PrototypeBadge />
      <IconCircle name="search" label="Search" />
      <IconCircle name="chatbubble-ellipses" label="Messenger" onPress={() => router.push("/messages")} />
      <Pressable onPress={openSwitcher} accessibilityLabel="Switch user" accessibilityRole="button" hitSlop={6}>
        {me ? <Avatar seed={me.avatar_seed} name={me.name} size={36} /> : <View style={styles.avatarGhost} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fb.divider,
  },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: fb.blue, alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 24, fontWeight: "700", lineHeight: 28, marginTop: -2 },
  avatarGhost: { width: 36, height: 36, borderRadius: 18, backgroundColor: fb.input },
});
