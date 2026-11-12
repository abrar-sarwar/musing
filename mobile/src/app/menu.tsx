import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar } from "@/components/ui/Avatar";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { usePrefs } from "@/lib/prefs";
import { useToast } from "@/lib/toast";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// the hamburger menu: facebook shortcuts (musing. among them), then the prototype
// disclaimer and developer controls, so they stay out of the main headers.
export default function MenuScreen() {
  const { me, openSwitcher, resetDemo } = useActingUser();
  const { settings, setSetting, traceOn, setTraceOn } = usePrefs();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const shortcuts: Array<{ icon: IconName; label: string; color: string; onPress: () => void }> = [
    { icon: "account-multiple", label: "Friends", color: fb.blue, onPress: () => router.push("/search") },
    { icon: "account-group", label: "Groups", color: fb.blue, onPress: () => toast("Groups are mocked in this prototype.") },
    { icon: "calendar-star", label: "Events", color: fb.red, onPress: () => router.push("/events") },
    { icon: "clock-outline", label: "Memories", color: fb.blue, onPress: () => router.navigate("/profile") },
    { icon: "bookmark", label: "Saved", color: "#a033ff", onPress: () => toast("Nothing saved yet. Save a reel or a listing.") },
    { icon: "creation", label: "musing.", color: muse.start, onPress: () => router.push("/musing") },
  ];

  async function onReset() {
    setBusy(true);
    try {
      await resetDemo();
      toast("Demo data restored.");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SubScreen title="Menu">
      <ScrollView style={{ backgroundColor: fb.bg2 }} contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 40 }}>
        <Pressable onPress={() => router.navigate("/profile")} style={styles.profile}>
          {me && <Avatar seed={me.avatar_seed} name={me.name} size={44} />}
          <Text style={styles.name}>{me?.name ?? "…"}</Text>
          <Pressable onPress={openSwitcher} hitSlop={8} style={styles.switch} accessibilityLabel="Switch user">
            <MaterialCommunityIcons name="swap-horizontal" size={22} color={fb.text} />
          </Pressable>
        </Pressable>

        <Text style={styles.section}>Your shortcuts</Text>
        <View style={styles.grid}>
          {shortcuts.map((s) => (
            <Pressable key={s.label} onPress={s.onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={s.label}>
              <MaterialCommunityIcons name={s.icon} size={28} color={s.color} />
              <Text style={styles.tileLabel}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Prototype</Text>
        <View style={styles.card}>
          <Row icon="swap-horizontal" label="Switch user" onPress={openSwitcher} />
          <Row icon="facebook-messenger" label="Messenger" onPress={() => router.push("/messages")} />
          <Row icon="cog-outline" label="musing. settings" onPress={() => router.push("/musing/settings")} />
          <Row icon="refresh" label={busy ? "Resetting…" : "Reset demo data"} onPress={busy ? undefined : onReset} last />
        </View>

        <Text style={styles.section}>Demo controls</Text>
        <View style={styles.card}>
          <SwitchRow label="Muse" sub={settings.muse_on ? "On. Muse reads, picks and re-solves." : "Off. What's left is a plain poll."} value={settings.muse_on} onChange={(v) => void setSetting("muse_on", v)} />
          <SwitchRow label="Muse trace" sub="Show each Muse step and how long it took, inside musing." value={traceOn} onChange={setTraceOn} />
          <SwitchRow label="Replay cached Muse" sub="Serve the last good Muse responses instead of calling the API. For when the network dies mid-demo." value={settings.muse_replay} onChange={(v) => void setSetting("muse_replay", v)} />
          <SwitchRow label="Invite posters" sub="Generate a Muse Image poster when a plan becomes real. About 45 seconds, and the priciest call." value={settings.posters_on} onChange={(v) => void setSetting("posters_on", v)} last />
        </View>

        <Text style={styles.footer}>Hackathon prototype · mock data · invented people · no real accounts · no Facebook or Graph API. Photos are CC0, avatars are generated illustrations.</Text>
      </ScrollView>
    </SubScreen>
  );
}

function Row({ icon, label, onPress, last = false }: { icon: IconName; label: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { backgroundColor: fb.hover }]} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} size={21} color={fb.text} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={fb.muted} />
    </Pressable>
  );
}

function SwitchRow({ label, sub, value, onChange, last = false }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "#fff" },
  name: { flex: 1, fontSize: 18, fontWeight: "700", color: fb.text },
  switch: { width: 38, height: 38, borderRadius: 19, backgroundColor: fb.button, alignItems: "center", justifyContent: "center" },
  section: { fontSize: 17, fontWeight: "700", color: fb.text, marginTop: 6, paddingHorizontal: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.8%", borderRadius: 12, padding: 14, gap: 8, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tileLabel: { fontSize: 16, fontWeight: "600", color: fb.text },
  card: { borderRadius: 12, backgroundColor: "#fff", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: fb.input, alignItems: "center", justifyContent: "center" },
  rowLabel: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: "600", color: fb.text },
  sub: { fontSize: 13, color: fb.muted, lineHeight: 17, marginTop: 1 },
  footer: { color: fb.muted, fontSize: 12.5, textAlign: "center", marginTop: 8, lineHeight: 17 },
});
