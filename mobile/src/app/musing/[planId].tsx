import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { GradientButton, QuietButton } from "@/components/musing/GradientButton";
import { MuseBubble } from "@/components/musing/MuseBubble";
import { TracePanel } from "@/components/musing/TracePanel";
import { WhatIf } from "@/components/musing/WhatIf";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { fb, muse, museGradient } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useQuery } from "@/lib/use-query";
import { useTableChanges } from "@/lib/use-realtime";
import { COPY } from "@/shared/copy";
import { firstName } from "@/shared/time";
import type { Person, PlanView } from "@/shared/types";

// one plan, as this person is allowed to see it. the starter sees the mix and the
// count. a friend sees their own ask and the count. names appear only once it's on.
export default function PlanScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { userId } = useActingUser();
  const { setHandoff } = usePrefs();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  const q = useQuery(() => apiGet<PlanView>(`/api/plans/${planId}`, userId), [planId, userId]);
  // live: the other phone's answer or a re-solve shows up here within a second or two
  useTableChanges("plans", () => void q.reload(), `id=eq.${planId}`);
  const p = q.data;

  async function act(name: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(name);
    setError(null);
    try {
      await fn();
      await q.reload();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const answer = (status: "down" | "out") => act(status, () => apiPost(`/api/plans/${planId}/respond`, userId, { status }));
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/musing"));

  if (!p) {
    return (
      <SubScreen title="plan">
        <Text style={styles.empty}>{q.loading ? "one sec" : "this plan isn't here anymore."}</Text>
      </SubScreen>
    );
  }

  const starter = p.role === "starter";
  const need = Math.max(0, p.quorum - p.downCount);
  const open = p.state === "proposing";
  const myStatus = p.me?.status;

  return (
    <SubScreen title={COPY.brand}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={60}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* the plan itself */}
          <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.kicker}>
              {p.state === "draft" ? "draft · only you can see this" : p.state === "happening" ? COPY.happening : p.state === "faded" ? "didn't land" : starter ? "out with your people" : `from ${firstName(p.starter.name).toLowerCase()}, via muse`}
            </Text>
            <Text style={styles.activity}>{p.activity}</Text>
            {p.when && (
              <View style={styles.heroRow}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.heroMeta}>{p.when}</Text>
              </View>
            )}
            {p.where && (
              <View style={styles.heroRow}>
                <Ionicons name="location-outline" size={16} color="#fff" />
                <Text style={styles.heroMeta}>{p.where}</Text>
              </View>
            )}
          </LinearGradient>

          {p.solving && (
            <View style={styles.solving}>
              <ActivityIndicator color={muse.text} size="small" />
              <Text style={styles.solvingText}>{COPY.solving}</Text>
            </View>
          )}

          <Card style={styles.block}>
            {/* muse's voice: the pitch for a draft, the personal ask for a friend, the note after a re-solve */}
            {starter && p.state === "draft" && p.pitch && <MuseBubble text={p.pitch} label={COPY.pitchLead} />}
            {!starter && open && myStatus === "pending" && p.museOn && p.me?.personalAsk && <MuseBubble text={p.me.personalAsk} />}
            {!p.museOn && p.rawText && (
              <Text style={styles.plain}>
                {starter ? "you asked" : `${firstName(p.starter.name).toLowerCase()} asked`}: &ldquo;{p.rawText}&rdquo;
              </Text>
            )}
            {p.note && p.state !== "draft" && <MuseBubble text={p.note} label={p.version > 1 ? "small update" : undefined} />}

            {/* the count. no names until it's on. */}
            {(open || p.state === "happening") && (
              <View style={styles.meter}>
                <View style={styles.dots}>
                  {Array.from({ length: p.quorum }).map((_, i) => (
                    <View key={i} style={[styles.dot, i < p.downCount && styles.dotOn]} />
                  ))}
                </View>
                <Text style={styles.meterText}>
                  {p.state === "happening" ? `${p.downCount} in, plus ${starter ? "you" : firstName(p.starter.name).toLowerCase()}` : need > 0 ? `${p.downCount} of ${p.quorum} in. ${need} more and it's on.` : "that's enough. making it real."}
                </Text>
              </View>
            )}
            {open && <Text style={styles.fine}>{starter ? "you'll see who's in once it's on. you never see who passed, and neither does anyone else." : "your answer stays between you and muse until it's on."}</Text>}

            {p.state === "faded" && <Text style={styles.plain}>{COPY.faded}</Text>}

            {p.going && (
              <View style={styles.people}>
                {p.going.map((u) => (
                  <PersonChip key={u.id} user={u} />
                ))}
              </View>
            )}
          </Card>

          {/* the mix: starter only */}
          {starter && p.picks && p.state !== "happening" && p.state !== "faded" && (
            <>
              <Text style={styles.section}>{p.state === "draft" ? "who muse would ask" : "who muse asked"}</Text>
              <Card>
                {p.picks.map((pick, i, arr) => (
                  <View key={pick.user.id} style={[styles.pick, i < arr.length - 1 && styles.border]}>
                    <Avatar seed={pick.user.avatar_seed} name={pick.user.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{pick.user.name}</Text>
                      {pick.reason && <Text style={styles.pickReason}>{pick.reason}</Text>}
                    </View>
                  </View>
                ))}
              </Card>
              {p.state === "draft" && <Text style={styles.footnote}>each of them gets their own quiet ask from muse. none of them sees who else was asked.</Text>}
            </>
          )}

          {/* actions */}
          <View style={styles.actions}>
            {error && <Text style={styles.error}>{error}</Text>}

            {starter && p.state === "draft" && (
              <>
                <GradientButton big label={COPY.sendIt} icon="paper-plane" busy={busy === "send"} onPress={() => act("send", () => apiPost(`/api/plans/${planId}/send`, userId))} />
                <QuietButton label={COPY.notThis} onPress={() => act("cancel", () => apiDelete(`/api/plans/${planId}`, userId).then(leave))} />
              </>
            )}

            {!starter && open && !whatIfOpen && (
              <>
                {myStatus !== "down" && <GradientButton big label={COPY.down} icon="checkmark" busy={busy === "down"} disabled={p.solving} onPress={() => answer("down")} />}
                {myStatus === "down" && <Text style={styles.youIn}>you&apos;re in.</Text>}
                {p.museOn && <QuietButton label={COPY.whatIf} onPress={() => setWhatIfOpen(true)} disabled={p.solving} />}
                {myStatus !== "out" ? <QuietButton label={myStatus === "down" ? "actually, not this time" : COPY.pass} onPress={() => answer("out")} disabled={busy !== null} /> : <Text style={styles.fine}>you passed. nobody was told.</Text>}
              </>
            )}
            {!starter && p.state === "happening" && myStatus !== "down" && <GradientButton big label={COPY.down} icon="checkmark" busy={busy === "down"} onPress={() => answer("down")} />}

            {starter && open && !whatIfOpen && (
              <>
                {p.museOn && <QuietButton label={COPY.whatIf} onPress={() => setWhatIfOpen(true)} disabled={p.solving} />}
                <QuietButton label="call it off quietly" onPress={() => act("cancel", () => apiDelete(`/api/plans/${planId}`, userId).then(leave))} />
              </>
            )}

            {open && whatIfOpen && (
              <Card style={styles.whatIf}>
                <WhatIf planId={p.id} existingLimit={p.me?.privateLimit ?? null} onClose={() => setWhatIfOpen(false)} onDone={() => void q.reload().then(() => setWhatIfOpen(false))} />
              </Card>
            )}
            {open && !p.museOn && <Text style={styles.fine}>muse is off for this one, so there&apos;s no &ldquo;what if&rdquo; and no quiet re-solve. it&apos;s a yes or a no.</Text>}

            {p.state === "happening" && (
              <>
                {p.threadId ? (
                  <GradientButton big label="open the chat" icon="chatbubbles" onPress={() => router.push({ pathname: "/messages/[id]", params: { id: p.threadId as string } })} />
                ) : p.museOn ? (
                  <Text style={styles.fine}>muse is setting up the chat and the event.</Text>
                ) : (
                  <Text style={styles.fine}>enough people said yes. without muse there&apos;s no chat or event made for you. that part is on you.</Text>
                )}
                {p.eventId && <QuietButton label="see the event" onPress={() => router.push({ pathname: "/events/[id]", params: { id: p.eventId as string } })} />}
              </>
            )}

            {starter && p.state === "faded" && (
              <>
                <GradientButton
                  big
                  label={COPY.runItBack}
                  icon="refresh"
                  onPress={() => {
                    setHandoff(p.rawText ?? p.activity ?? "");
                    void apiDelete(`/api/plans/${planId}`, userId).finally(leave);
                  }}
                />
                <QuietButton label="let it go" onPress={() => act("cancel", () => apiDelete(`/api/plans/${planId}`, userId).then(leave))} />
              </>
            )}
          </View>

          <TracePanel planId={p.id} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SubScreen>
  );
}

function PersonChip({ user }: { user: Person }) {
  return (
    <View style={styles.chip}>
      <Avatar seed={user.avatar_seed} name={user.name} size={26} />
      <Text style={styles.chipText}>{firstName(user.name).toLowerCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 24, color: fb.muted, textAlign: "center" },
  hero: { margin: 12, borderRadius: 18, padding: 18, gap: 6 },
  kicker: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700" },
  activity: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroMeta: { color: "#fff", fontSize: 16, flex: 1 },
  solving: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 8, backgroundColor: muse.soft, borderRadius: 12, padding: 10 },
  solvingText: { color: muse.text, fontWeight: "600", fontSize: 14 },
  block: { marginHorizontal: 12, borderRadius: 16, padding: 14, gap: 12 },
  plain: { fontSize: 16, color: fb.text, lineHeight: 22 },
  meter: { flexDirection: "row", alignItems: "center", gap: 10 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: muse.start },
  dotOn: { backgroundColor: muse.start },
  meterText: { fontSize: 15, fontWeight: "600", color: fb.text, flex: 1 },
  fine: { fontSize: 13, color: fb.muted, lineHeight: 18 },
  people: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: fb.input, borderRadius: 999, paddingRight: 12, padding: 3 },
  chipText: { fontSize: 14, fontWeight: "600", color: fb.text },
  section: { fontSize: 13, fontWeight: "700", color: fb.muted, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  pick: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  pickName: { fontSize: 15, fontWeight: "600", color: fb.text },
  pickReason: { fontSize: 13, color: fb.muted, lineHeight: 18 },
  footnote: { fontSize: 12, color: fb.muted, paddingHorizontal: 16, paddingTop: 8, lineHeight: 16 },
  actions: { padding: 12, gap: 10 },
  youIn: { fontSize: 17, fontWeight: "700", color: muse.text, textAlign: "center", paddingVertical: 6 },
  whatIf: { borderRadius: 16, padding: 14 },
  error: { fontSize: 14, color: fb.red },
});
