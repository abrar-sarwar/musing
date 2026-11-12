import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { PlanRow } from "@/components/musing/PlanRow";
import { SignalComposer } from "@/components/musing/SignalComposer";
import { SuggestCard } from "@/components/musing/SuggestCard";
import { TracePanel } from "@/components/musing/TracePanel";
import { Screen } from "@/components/shell/Screen";
import { Card } from "@/components/ui/Card";
import { fb, muse, museGradient } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useQuery } from "@/lib/use-query";
import { useTableChanges } from "@/lib/use-realtime";
import { COPY } from "@/shared/copy";
import { timeAgo } from "@/shared/time";
import type { MusingHome } from "@/shared/types";

// the musing. surface: asks that reached you, the composer, your plans, your past thoughts.
export default function MusingScreen() {
  const { userId } = useActingUser();
  const { settings, setSetting, traceOn, setTraceOn, setHandoff } = usePrefs();
  const router = useRouter();

  const home = useQuery(() => apiGet<MusingHome>("/api/musing/home", userId), [userId]);
  // any plan change anywhere: refetch. the server decides what this person may see.
  useTableChanges("plans", () => void home.reload());

  const asks = home.data?.asks ?? [];
  const mine = home.data?.mine ?? [];
  const muses = home.data?.muses ?? [];

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => void home.reload()} />}>
          <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.brand}>{COPY.brand}</Text>
            <Text style={styles.tagline}>one vague thought. a real plan with friends. nobody has to ask.</Text>
          </LinearGradient>

          {asks.length > 0 && (
            <>
              <Text style={styles.section}>for you</Text>
              <Card>
                {asks.map((p) => (
                  <PlanRow key={p.id} plan={p} />
                ))}
              </Card>
              <View style={{ height: 12 }} />
            </>
          )}

          <SignalComposer onPlan={(planId) => router.push({ pathname: "/musing/[planId]", params: { planId } })} />
          {settings.muse_on && <SuggestCard />}

          {mine.length > 0 && (
            <>
              <Text style={styles.section}>your plans</Text>
              <Card>
                {mine.map((p) => (
                  <PlanRow key={p.id} plan={p} />
                ))}
              </Card>
            </>
          )}

          <Text style={styles.section}>things you floated</Text>
          <Card>
            {muses.map((m, i, arr) => (
              <Pressable key={m.id} onPress={() => setHandoff(m.raw_text)} style={({ pressed }) => [styles.museRow, i < arr.length - 1 && styles.museBorder, pressed && { backgroundColor: fb.hover }]}>
                <Text style={styles.museText}>{m.raw_text}</Text>
                <Text style={styles.museMeta}>
                  {timeAgo(m.created_at).toLowerCase()}
                  {m.understood ? ` · ${m.understood.activity}` : ""} · tap to {COPY.runItBack}
                </Text>
              </Pressable>
            ))}
            {!home.loading && muses.length === 0 && <Text style={styles.empty}>{home.error ? `couldn't load (${home.error})` : "nothing yet. that's fine."}</Text>}
          </Card>

          <Text style={styles.section}>demo controls</Text>
          <Card>
            <Toggle label="muse" sub={settings.muse_on ? "on. muse reads, picks, re-solves." : "off. what's left is a plain poll."} value={settings.muse_on} onChange={(v) => void setSetting("muse_on", v)} />
            <Toggle label="muse trace" sub="show each muse step and how long it took." value={traceOn} onChange={setTraceOn} last />
          </Card>
          <TracePanel />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Toggle({ label, sub, value, onChange, last = false }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={[styles.toggle, !last && styles.museBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.museMeta}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: muse.start }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { margin: 12, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, gap: 4 },
  brand: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 19 },
  section: { fontSize: 13, fontWeight: "700", color: fb.muted, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  museRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  museBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  museText: { fontSize: 15, color: fb.text },
  museMeta: { fontSize: 12, color: fb.muted },
  empty: { padding: 16, color: fb.muted },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  toggleLabel: { fontSize: 16, fontWeight: "600", color: fb.text },
});
