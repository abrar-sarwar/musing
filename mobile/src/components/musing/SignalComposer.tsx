import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiPost, apiStream, type SseEvent } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { COPY } from "@/shared/copy";
import type { Understood } from "@/shared/types";
import { GradientButton, QuietButton } from "./GradientButton";
import { MuseBubble } from "./MuseBubble";
import { VisibilityPicker } from "./VisibilityPicker";

// idle -> reading (understand) -> [asking: muse has one question] -> mixing (match) -> plan
type Phase = "idle" | "reading" | "asking" | "mixing" | "error";

type UnderstoodResult = { museId: string; understood: Understood; source: "live" | "cache" };

type Props = { onPlan: (planId: string) => void; autoFocus?: boolean };

// "what's the move?" one vague thought in. muse reads it, then drafts the plan.
// nothing leaves this screen until the starter taps "send it" on the draft.
export function SignalComposer({ onPlan, autoFocus = false }: Props) {
  const { userId } = useActingUser();
  const { settings, handoff, setHandoff } = usePrefs();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reply, setReply] = useState("");
  const [pitch, setPitch] = useState("");
  const [read, setRead] = useState<UnderstoodResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // a thought handed over from the reels card, a recap or muse's suggestion
  useEffect(() => {
    if (handoff && phase === "idle") {
      setText(handoff);
      setHandoff(null);
    }
  }, [handoff, phase, setHandoff]);

  useEffect(() => () => abort.current?.abort(), []);

  const busy = phase === "reading" || phase === "mixing";
  const canSend = text.trim().length >= 2 && !busy;

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
    setPhase("error");
  }

  async function mix(museId: string) {
    setPhase("mixing");
    setPitch("");
    let planId: string | null = null;
    let streamError: string | null = null;
    await apiStream(
      "/api/muse/match",
      userId,
      { museId },
      (ev: SseEvent) => {
        if (ev.event === "delta") setPitch((p) => p + String((ev.data as { text: string }).text));
        else if (ev.event === "restart") setPitch("");
        else if (ev.event === "done") planId = (ev.data as { planId: string }).planId;
        else if (ev.event === "error") streamError = String((ev.data as { message: string }).message);
      },
      abort.current?.signal,
    );
    if (streamError) throw new Error(streamError);
    if (!planId) throw new Error("muse didn't finish the plan");
    reset();
    onPlan(planId);
  }

  async function send() {
    if (!canSend) return;
    setError(null);
    setReply("");
    setRead(null);
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      if (!settings.muse_on) {
        // muse off: what's left is a plain poll to the first few friends
        setPhase("mixing");
        const r = await apiPost<{ planId: string }>("/api/plans", userId, { text: text.trim() });
        reset();
        onPlan(r.planId);
        return;
      }
      setPhase("reading");
      let result: UnderstoodResult | null = null;
      let streamError: string | null = null;
      await apiStream(
        "/api/muse/understand",
        userId,
        { text: text.trim() },
        (ev: SseEvent) => {
          if (ev.event === "delta") setReply((r) => r + String((ev.data as { text: string }).text));
          else if (ev.event === "restart") setReply("");
          else if (ev.event === "done") result = ev.data as UnderstoodResult;
          else if (ev.event === "error") streamError = String((ev.data as { message: string }).message);
        },
        abort.current.signal,
      );
      if (streamError) throw new Error(streamError);
      const r = result as UnderstoodResult | null;
      if (!r) throw new Error("muse didn't answer");
      setReply(r.understood.reply);
      setRead(r);
      if (r.understood.clarifying_question) {
        setPhase("asking"); // muse has one question. the person can answer or skip it.
        return;
      }
      await mix(r.museId);
    } catch (e) {
      fail(e);
    }
  }

  async function goAnyway() {
    if (!read) return;
    try {
      await mix(read.museId);
    } catch (e) {
      fail(e);
    }
  }

  function reset() {
    abort.current?.abort();
    setText("");
    setReply("");
    setPitch("");
    setRead(null);
    setError(null);
    setPhase("idle");
  }

  const u = read?.understood;

  return (
    <Card style={styles.card}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={COPY.composerPlaceholder}
        placeholderTextColor={fb.muted}
        multiline
        maxLength={280}
        editable={!busy}
        autoFocus={autoFocus}
        style={styles.input}
        autoCapitalize="none"
        accessibilityLabel={COPY.composerPlaceholder}
      />
      <View style={styles.row}>
        {settings.muse_on ? <VisibilityPicker /> : <Text style={styles.offChip}>muse is off · plain poll</Text>}
        <View style={{ flex: 1 }} />
        {(phase === "error" || phase === "asking") && <QuietButton label="start over" onPress={reset} />}
        <GradientButton
          label={phase === "reading" ? "muse is reading" : phase === "mixing" ? (settings.muse_on ? "finding your people" : "sending") : settings.muse_on ? "send it to muse" : "ask the poll"}
          icon="arrow-up"
          onPress={send}
          disabled={!canSend}
          busy={busy}
        />
      </View>
      <Text style={styles.hint}>{settings.muse_on ? "only you and muse see this. nothing goes to anyone until you say so." : "without muse this goes out as typed, to the first few friends on your list."}</Text>

      {settings.muse_on && phase !== "idle" && phase !== "error" && (
        <View style={styles.replyWrap}>
          <MuseBubble text={reply} thinking={phase === "reading"} />
          {u && (
            <View style={styles.tags}>
              <Tag>{u.activity}</Tag>
              {u.time_hint !== "unspecified" && <Tag>{u.time_hint}</Tag>}
              <Tag>{u.vibe}</Tag>
              {read?.source === "cache" && <Tag muted>replayed</Tag>}
            </View>
          )}
          {phase === "asking" && u?.clarifying_question && (
            <>
              <MuseBubble text={u.clarifying_question} />
              <View style={styles.askRow}>
                <Text style={styles.askHint}>add a little more above and send again, or</Text>
                <QuietButton label="go with it" onPress={goAnyway} />
              </View>
            </>
          )}
          {phase === "mixing" && <MuseBubble text={pitch} thinking label={COPY.pitchLead} />}
        </View>
      )}
      {phase === "error" && <Text style={styles.error}>that didn&apos;t go through ({error}). your thought is still here. try again in a sec.</Text>}
    </Card>
  );
}

function Tag({ children, muted = false }: { children: string; muted?: boolean }) {
  return (
    <View style={[styles.tag, muted && { backgroundColor: fb.input }]}>
      <Text style={[styles.tagText, muted && { color: fb.muted }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, borderRadius: 16, padding: 14, gap: 10 },
  input: { minHeight: 64, fontSize: 19, lineHeight: 25, color: fb.text, textAlignVertical: "top", paddingTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  offChip: { fontSize: 13, color: fb.muted },
  hint: { fontSize: 12, color: fb.muted, lineHeight: 16 },
  replyWrap: { gap: 10, paddingTop: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 40 },
  tag: { backgroundColor: muse.soft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, color: muse.text, fontWeight: "600" },
  askRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 40 },
  askHint: { flex: 1, fontSize: 13, color: fb.muted },
  error: { fontSize: 14, color: fb.red, lineHeight: 19 },
});
