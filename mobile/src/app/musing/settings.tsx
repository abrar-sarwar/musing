import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SubScreen } from "@/components/shell/SubScreen";
import { Card } from "@/components/ui/Card";
import { fb, muse } from "@/constants/theme";

const TOGGLES = [
  { key: "reels", label: "let muse notice what i'm into", sub: "uses your reels topics to find overlap. friends only ever see a count, never your name.", on: true },
  { key: "asks", label: "let friends' thoughts reach me", sub: "muse can ask you when a friend floats something you'd likely enjoy.", on: true },
  { key: "nudge", label: "day-of nudge", sub: "one quiet heads up the morning of a plan. never a second one.", on: true },
  { key: "recap", label: "offer a recap after", sub: "muse drafts a post for the group. nothing is shared unless everyone in it says yes.", on: false },
  { key: "pause", label: "quiet week", sub: "pause every ask for seven days. nobody is told.", on: false },
] as const;

// musing. settings. a static preview: the toggles move but nothing is saved yet.
export default function MusingSettings() {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(Object.fromEntries(TOGGLES.map((t) => [t.key, t.on])));
  return (
    <SubScreen title="musing. settings">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.banner}>
          <Ionicons name="construct-outline" size={16} color={muse.text} />
          <Text style={styles.bannerText}>preview. these switches show what you&apos;d control. they don&apos;t save in this prototype.</Text>
        </View>
        <Card>
          {TOGGLES.map((t, i) => (
            <View key={t.key} style={[styles.row, i < TOGGLES.length - 1 && styles.border]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t.label}</Text>
                <Text style={styles.sub}>{t.sub}</Text>
              </View>
              <Switch value={state[t.key]} onValueChange={(v) => setState((s) => ({ ...s, [t.key]: v }))} trackColor={{ true: muse.start }} accessibilityLabel={t.label} />
            </View>
          ))}
        </Card>

        <Text style={styles.section}>what comes after a plan</Text>
        <Card>
          <Link icon="notifications-outline" label="day-of nudge" sub="what the heads up looks like" onPress={() => router.push("/musing/nudge")} />
          <Link icon="images-outline" label="recap post" sub="what lands in feed afterwards" onPress={() => router.push("/musing/recap")} last />
        </Card>

        <Text style={styles.section}>what muse never does</Text>
        <Card style={styles.promises}>
          {["tells anyone you passed on a plan", "repeats something you said was just between us", "says who is behind a friends overlap", "asks someone on your behalf before you tap send"].map((line) => (
            <View key={line} style={styles.promise}>
              <Ionicons name="close-circle" size={18} color={muse.end} />
              <Text style={styles.promiseText}>{line}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SubScreen>
  );
}

function Link({ icon, label, sub, onPress, last = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.border, pressed && { backgroundColor: fb.hover }]} accessibilityRole="button">
      <View style={styles.icon}>
        <Ionicons name={icon} size={18} color={muse.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={fb.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 8, margin: 12, padding: 12, borderRadius: 12, backgroundColor: muse.soft, alignItems: "flex-start" },
  bannerText: { flex: 1, color: muse.text, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  label: { fontSize: 16, fontWeight: "600", color: fb.text },
  sub: { fontSize: 13, color: fb.muted, lineHeight: 18, marginTop: 1 },
  section: { fontSize: 13, fontWeight: "700", color: fb.muted, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: muse.soft, alignItems: "center", justifyContent: "center" },
  promises: { padding: 16, gap: 10 },
  promise: { flexDirection: "row", alignItems: "center", gap: 8 },
  promiseText: { flex: 1, fontSize: 15, color: fb.text },
});
