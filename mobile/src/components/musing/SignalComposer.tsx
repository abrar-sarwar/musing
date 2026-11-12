import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { fb, muse, museGradient } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiStream } from "@/lib/api";
import { COPY } from "@/shared/copy";
import type { Understood } from "@/shared/types";
import { MuseBubble } from "./MuseBubble";

type Phase = "idle" | "sending" | "done" | "error";

export type UnderstoodResult = { museId: string; understood: Understood; source: "live" | "cache"; latencyMs: number };

type Props = {
  onUnderstood?: (r: UnderstoodResult) => void;
  prefill?: string;
};

// "what's the move?" one vague thought in, muse's read of it streamed back.
export function SignalComposer({ onUnderstood, prefill }: Props) {
  const { userId } = useActingUser();
  const [text, setText] = useState(prefill ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reply, setReply] = useState("");
  const [result, setResult] = useState<UnderstoodResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const canSend = text.trim().length >= 2 && phase !== "sending";

  async function send() {
    if (!canSend) return;
    setPhase("sending");
    setReply("");
    setResult(null);
    setError(null);
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      await apiStream(
        "/api/muse/understand",
        userId,
        { text: text.trim() },
        (ev) => {
          if (ev.event === "delta") setReply((r) => r + String((ev.data as { text: string }).text));
          else if (ev.event === "done") {
            const r = ev.data as UnderstoodResult;
            setReply(r.understood.reply);
            setResult(r);
            setPhase("done");
            onUnderstood?.(r);
          } else if (ev.event === "error") {
            throw new Error(String((ev.data as { message: string }).message));
          }
        },
        abort.current.signal,
      );
      setPhase((p) => (p === "sending" ? "done" : p));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function reset() {
    setText("");
    setReply("");
    setResult(null);
    setError(null);
    setPhase("idle");
  }

  const u = result?.understood;

  return (
    <Card style={styles.card}>
      <View style={styles.inputWrap}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={COPY.composerPlaceholder}
          placeholderTextColor={fb.muted}
          multiline
          maxLength={280}
          editable={phase !== "sending"}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={send}
        />
      </View>
      <View style={styles.row}>
        <View style={styles.chip}>
          <Ionicons name="people-outline" size={14} color={fb.muted} />
          <Text style={styles.chipText}>just friends</Text>
        </View>
        <View style={{ flex: 1 }} />
        {phase === "done" || phase === "error" ? (
          <Pressable onPress={reset} hitSlop={8} style={styles.ghostBtn}>
            <Text style={styles.ghostText}>start over</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={send} disabled={!canSend} accessibilityRole="button" accessibilityLabel="send to muse">
          <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.sendBtn, !canSend && { opacity: 0.45 }]}>
            {phase === "sending" ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={18} color="#fff" />}
            <Text style={styles.sendText}>{phase === "sending" ? "muse is reading" : "send it"}</Text>
          </LinearGradient>
        </Pressable>
      </View>
      <Text style={styles.hint}>nobody sees this but you and muse.</Text>

      {(phase === "sending" || phase === "done") && (
        <View style={styles.replyWrap}>
          <MuseBubble text={reply} thinking={phase === "sending"} />
          {u && (
            <View style={styles.tags}>
              <Tag>{u.activity}</Tag>
              {u.time_hint !== "unspecified" && <Tag>{u.time_hint}</Tag>}
              <Tag>{u.vibe}</Tag>
              {result?.source === "cache" && <Tag muted>cached</Tag>}
            </View>
          )}
          {u?.clarifying_question && <Text style={styles.question}>{u.clarifying_question}</Text>}
        </View>
      )}
      {phase === "error" && <Text style={styles.error}>muse couldn&apos;t read that: {error}. try again in a sec.</Text>}
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
  inputWrap: { minHeight: 72 },
  input: { fontSize: 18, lineHeight: 24, color: fb.text, textAlignVertical: "top", paddingTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: fb.input, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, color: fb.muted },
  ghostBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  ghostText: { fontSize: 14, color: fb.muted },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, height: 38 },
  sendText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  hint: { fontSize: 12, color: fb.muted },
  replyWrap: { gap: 10, paddingTop: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 40 },
  tag: { backgroundColor: muse.soft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, color: muse.text, fontWeight: "600" },
  question: { paddingLeft: 40, fontSize: 15, color: fb.text },
  error: { fontSize: 14, color: fb.red },
});
