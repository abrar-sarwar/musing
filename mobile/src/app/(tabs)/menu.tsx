import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Screen } from "@/components/shell/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { usePrefs } from "@/lib/prefs";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const SHORTCUTS: Array<{ icon: IconName; label: string; color: string }> = [
  { icon: "people", label: "Friends", color: fb.blue },
  { icon: "people-circle", label: "Groups", color: fb.blue },
  { icon: "play-circle", label: "Reels", color: fb.red },
  { icon: "calendar", label: "Events", color: fb.red },
  { icon: "bookmark", label: "Saved", color: "#a033ff" },
  { icon: "time", label: "Memories", color: fb.blue },
];

export default function MenuScreen() {
  const { me, openSwitcher, resetDemo } = useActingUser();
  const router = useRouter();
  const { settings, setSetting } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onReset() {
    setBusy(true);
    setMsg(null);
    try {
      await resetDemo();
      setMsg("Demo data restored.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}>
        <Text style={styles.heading}>Menu</Text>
        <Pressable onPress={openSwitcher}>
          <Card style={styles.profile}>
            {me && <Avatar seed={me.avatar_seed} name={me.name} size={48} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{me?.name ?? "…"}</Text>
              <Text style={styles.sub}>Acting as · tap to switch</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={fb.muted} />
          </Card>
        </Pressable>

        <View style={styles.grid}>
          {SHORTCUTS.map((s) => (
            <Card key={s.label} style={styles.tile}>
              <Ionicons name={s.icon} size={26} color={s.color} />
              <Text style={styles.tileLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <Text style={styles.section}>musing.</Text>
        <Card>
          <Row icon="sparkles" label="musing. settings" onPress={() => router.push("/musing/settings")} last />
        </Card>

        <Text style={styles.section}>Prototype</Text>
        <Card>
          <Row icon="swap-horizontal" label="Switch user" onPress={openSwitcher} />
          <Row icon="chatbubble-ellipses" label="Messenger" onPress={() => router.push("/messages")} />
          <Row icon="refresh" label={busy ? "Resetting…" : "Reset demo data"} onPress={busy ? undefined : onReset} last />
        </Card>
        {msg && <Text style={styles.msg}>{msg}</Text>}

        <Text style={styles.section}>Stage safety</Text>
        <Card>
          <SwitchRow label="Replay cached Muse" sub="Serve the last good Muse responses instead of calling the API. For when the network dies mid-demo." value={settings.muse_replay} onChange={(v) => void setSetting("muse_replay", v)} />
          <SwitchRow label="Invite posters" sub="Generate a Muse Image poster when a plan becomes real. Takes about 45 seconds and is the priciest call." value={settings.posters_on} onChange={(v) => void setSetting("posters_on", v)} last />
        </Card>
        <Text style={styles.footer}>hackathon prototype · mock data · no real accounts · no real facebook api</Text>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, label, onPress, last = false }: { icon: IconName; label: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { backgroundColor: fb.hover }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={fb.text} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={fb.muted} />
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
  heading: { fontSize: 24, fontWeight: "700", color: fb.text },
  profile: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10 },
  name: { fontSize: 17, fontWeight: "600", color: fb.text },
  sub: { fontSize: 13, color: fb.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.5%", borderRadius: 10, padding: 12, gap: 6 },
  tileLabel: { fontSize: 15, fontWeight: "600", color: fb.text },
  section: { fontSize: 17, fontWeight: "700", color: fb.text, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: fb.input, alignItems: "center", justifyContent: "center" },
  rowLabel: { flexGrow: 1, flexShrink: 1, fontSize: 16, fontWeight: "500", color: fb.text },
  msg: { color: fb.muted, fontSize: 13, paddingHorizontal: 4 },
  footer: { color: fb.muted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
