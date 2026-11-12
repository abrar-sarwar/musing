import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useQuery } from "@/lib/use-query";
import type { Suggestion } from "@/shared/types";
import { QuietButton } from "./GradientButton";

// muse suggests: one thought the person could send with a tap. cached per person,
// so opening this tab does not cost a muse call every time.
export function SuggestCard() {
  const { userId } = useActingUser();
  const { setHandoff } = usePrefs();
  const [hidden, setHidden] = useState(false);
  const [fresh, setFresh] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery(() => apiGet<Suggestion>("/api/muse/suggest", userId), [userId]);
  const s = fresh ?? q.data;
  if (hidden || !s) return null;

  async function another() {
    setBusy(true);
    try {
      setFresh(await apiGet<Suggestion>("/api/muse/suggest?fresh=1", userId));
    } catch {
      /* keep the one we have */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={14} color={muse.text} />
        <Text style={styles.kicker}>muse suggests</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setHidden(true)} hitSlop={10} accessibilityLabel="dismiss suggestion">
          <Ionicons name="close" size={18} color={fb.muted} />
        </Pressable>
      </View>
      <Text style={styles.suggestion}>&ldquo;{s.suggestion}&rdquo;</Text>
      <Text style={styles.why}>{s.why}</Text>
      <View style={styles.row}>
        <QuietButton label="use this" onPress={() => setHandoff(s.suggestion)} />
        <QuietButton label={busy ? "thinking" : "another"} onPress={another} disabled={busy} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginTop: 10, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1, borderColor: muse.soft },
  head: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: { fontSize: 12, fontWeight: "700", color: muse.text },
  suggestion: { fontSize: 17, fontWeight: "600", color: fb.text },
  why: { fontSize: 14, color: fb.muted, lineHeight: 19 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
});
