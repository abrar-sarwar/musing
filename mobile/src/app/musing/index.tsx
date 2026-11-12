import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { PlanRow } from "@/components/musing/PlanRow";
import { SignalComposer } from "@/components/musing/SignalComposer";
import { SuggestCard } from "@/components/musing/SuggestCard";
import { TracePanel } from "@/components/musing/TracePanel";
import { SubScreen } from "@/components/shell/SubScreen";
import { Card } from "@/components/ui/Card";
import { fb, muse } from "@/constants/theme";
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
  const { settings, setHandoff } = usePrefs();
  const router = useRouter();
  const { compose } = useLocalSearchParams<{ compose?: string }>();

  const home = useQuery(() => apiGet<MusingHome>("/api/musing/home", userId), [userId]);
  // any plan change anywhere: refetch. the server decides what this person may see.
  useTableChanges("plans", () => void home.reload());

  const asks = home.data?.asks ?? [];
  const mine = home.data?.mine ?? [];
  const muses = home.data?.muses ?? [];

  return (
    <SubScreen title={COPY.brand}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={60}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => void home.reload()} />}>
          <View style={styles.intro}>
            <Text style={styles.tagline}>one vague thought. a real plan with friends. nobody has to ask.</Text>
          </View>

          <SignalComposer autoFocus={compose === "1"} onPlan={(planId) => router.push({ pathname: "/musing/[planId]", params: { planId } })} />
          {settings.muse_on && <SuggestCard />}

          {asks.length > 0 && (
            <>
              <Text style={styles.section}>for you</Text>
              <Card>
                {asks.map((p) => (
                  <PlanRow key={p.id} plan={p} />
                ))}
              </Card>
            </>
          )}


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

          <TracePanel />
        </ScrollView>
      </KeyboardAvoidingView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  tagline: { color: muse.text, fontSize: 15, lineHeight: 20, fontWeight: "500" },
  section: { fontSize: 13, fontWeight: "700", color: fb.muted, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  museRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  museBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  museText: { fontSize: 15, color: fb.text },
  museMeta: { fontSize: 12, color: fb.muted },
  empty: { padding: 16, color: fb.muted },
});
