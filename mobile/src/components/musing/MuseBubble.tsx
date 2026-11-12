import { StyleSheet, Text, View } from "react-native";
import { MuseAvatar } from "@/components/ui/Avatar";
import { fb, muse } from "@/constants/theme";

// muse speaking. text streams in; a soft caret shows while it's still writing.
export function MuseBubble({ text, thinking = false, label }: { text: string; thinking?: boolean; label?: string }) {
  return (
    <View style={styles.row}>
      <MuseAvatar size={32} />
      <View style={styles.bubble}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.text}>
          {text.length === 0 && thinking ? "…" : text}
          {thinking && text.length > 0 ? <Text style={styles.caret}>▍</Text> : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubble: { flex: 1, backgroundColor: muse.soft, borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  label: { fontSize: 12, color: muse.text, fontWeight: "600" },
  text: { fontSize: 16, lineHeight: 22, color: fb.text },
  caret: { color: muse.text },
});
