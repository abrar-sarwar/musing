import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";

// act as any seeded user. no login, no passwords. also the one-tap demo reset.
export function UserSwitcherSheet() {
  const { users, userId, switcherOpen, closeSwitcher, switchTo, resetDemo } = useActingUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReset() {
    setBusy(true);
    setError(null);
    try {
      await resetDemo();
      closeSwitcher();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={switcherOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSwitcher}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Acting as</Text>
          <Pressable onPress={closeSwitcher} hitSlop={10} accessibilityLabel="Close" accessibilityRole="button">
            <Ionicons name="close" size={26} color={fb.text} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Prototype only. Pick anyone to see the app as them. No login.</Text>
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item: u }) => {
            const active = u.id === userId;
            return (
              <Pressable onPress={() => switchTo(u.id)} style={({ pressed }) => [styles.row, (pressed || active) && { backgroundColor: fb.hover }]}>
                <Avatar seed={u.avatar_seed} name={u.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{u.name}</Text>
                  <Text style={styles.handle}>@{u.id}</Text>
                </View>
                {active && <Ionicons name="checkmark" size={22} color={fb.blue} />}
              </Pressable>
            );
          }}
          ListFooterComponent={
            <View style={styles.footer}>
              <Pressable onPress={onReset} disabled={busy} style={({ pressed }) => [styles.reset, pressed && { opacity: 0.7 }]}>
                <Ionicons name="refresh" size={20} color={fb.text} />
                <Text style={styles.resetText}>{busy ? "Resetting…" : "Reset demo data"}</Text>
              </Pressable>
              {error && <Text style={styles.error}>{error}</Text>}
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: "700", color: fb.text },
  hint: { paddingHorizontal: 16, paddingBottom: 8, color: fb.muted, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 16, fontWeight: "600", color: fb.text },
  handle: { fontSize: 13, color: fb.muted },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fb.divider, marginTop: 8 },
  reset: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: fb.input, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  resetText: { fontSize: 16, fontWeight: "600", color: fb.text },
  error: { color: fb.red, marginTop: 8, fontSize: 13 },
});
