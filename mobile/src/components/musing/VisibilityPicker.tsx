import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fb, muse } from "@/constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const OPTIONS: Array<{ key: string; label: string; sub: string; icon: IconName; ready: boolean }> = [
  { key: "just_friends", label: "just friends", sub: "muse picks from your friends. only the few it asks ever know.", icon: "people-outline", ready: true },
  { key: "close_friends", label: "close friends", sub: "a shorter list you choose. soon.", icon: "heart-outline", ready: false },
  { key: "friends_of_friends", label: "friends of friends", sub: "one hop out, for bigger plans. soon.", icon: "git-network-outline", ready: false },
];

// who muse may ask. only "just friends" is wired in this prototype.
export function VisibilityPicker() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.chip} accessibilityRole="button" accessibilityLabel="who muse can ask: just friends">
        <Ionicons name="people-outline" size={14} color={fb.muted} />
        <Text style={styles.chipText}>just friends</Text>
        <Ionicons name="chevron-down" size={12} color={fb.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>who can muse ask?</Text>
            {OPTIONS.map((o) => (
              <Pressable key={o.key} onPress={o.ready ? () => setOpen(false) : undefined} style={[styles.row, !o.ready && { opacity: 0.45 }]} accessibilityState={{ disabled: !o.ready, selected: o.ready }}>
                <View style={styles.icon}>
                  <Ionicons name={o.icon} size={18} color={o.ready ? muse.text : fb.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{o.label}</Text>
                  <Text style={styles.sub}>{o.sub}</Text>
                </View>
                {o.ready && <Ionicons name="checkmark-circle" size={22} color={muse.text} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: fb.input, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: 13, color: fb.muted },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 6 },
  title: { fontSize: 18, fontWeight: "700", color: fb.text, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: muse.soft, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 16, fontWeight: "600", color: fb.text },
  sub: { fontSize: 13, color: fb.muted, lineHeight: 17 },
});
