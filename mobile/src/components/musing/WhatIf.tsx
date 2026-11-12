import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiStream, type SseEvent } from "@/lib/api";
import { COPY } from "@/shared/copy";
import { GradientButton, QuietButton } from "./GradientButton";
import { MuseBubble } from "./MuseBubble";

type Props = { planId: string; existingLimit: string | null; onDone: () => void; onClose: () => void };

// "what if..." is the open counteroffer. "just between us" is the private limit:
// muse plans around it and never repeats it. either one triggers a live re-solve.
export function WhatIf({ planId, existingLimit, onDone, onClose }: Props) {
  const { userId } = useActingUser();
  const [offer, setOffer] = useState("");
  const [limit, setLimit] = useState(existingLimit ?? "");
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState("");
  const [error, setError] = useState<string | null>(null);

  const limitChanged = limit.trim() !== (existingLimit ?? "");
  const canSend = !busy && (offer.trim().length > 1 || (limitChanged && limit.trim().length > 1));

  async function send() {
    setBusy(true);
    setStream("");
    setError(null);
    let streamError: string | null = null;
    try {
      await apiStream("/api/plans/" + planId + "/whatif", userId, { counteroffer: offer.trim() || null, privateLimit: limitChanged ? limit.trim() || null : null }, (ev: SseEvent) => {
        if (ev.event === "delta") setStream((s) => s + String((ev.data as { text: string }).text));
        else if (ev.event === "restart") setStream("");
        else if (ev.event === "done") setStream(String((ev.data as { note: string }).note));
        else if (ev.event === "error") streamError = String((ev.data as { message: string }).message);
      });
      if (streamError) throw new Error(streamError);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{COPY.whatIf}</Text>
      <TextInput value={offer} onChangeText={setOffer} placeholder="sunday instead? somewhere closer?" placeholderTextColor={fb.muted} style={styles.input} editable={!busy} autoCapitalize="none" maxLength={200} multiline accessibilityLabel={COPY.whatIf} />

      <View style={styles.privateHead}>
        <Ionicons name="lock-closed" size={13} color={muse.text} />
        <Text style={[styles.label, { color: muse.text }]}>{COPY.privateLimit}</Text>
      </View>
      <TextInput
        value={limit}
        onChangeText={setLimit}
        placeholder="anything muse should quietly work around"
        placeholderTextColor={fb.muted}
        style={[styles.input, styles.privateInput]}
        editable={!busy}
        autoCapitalize="none"
        maxLength={200}
        multiline
        accessibilityLabel={COPY.privateLimit}
      />
      <Text style={styles.hint}>{COPY.privateNote}</Text>

      {(busy || stream.length > 0) && <MuseBubble text={stream} thinking={busy} label={busy ? COPY.solving : undefined} />}
      {error && <Text style={styles.error}>muse couldn&apos;t rework it ({error}). the plan stays as it was.</Text>}

      <View style={styles.row}>
        <QuietButton label="never mind" onPress={onClose} disabled={busy} />
        <GradientButton label={busy ? "reworking" : "ask muse"} onPress={send} disabled={!canSend} busy={busy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingTop: 4 },
  label: { fontSize: 14, fontWeight: "700", color: fb.text },
  input: { minHeight: 44, borderRadius: 12, backgroundColor: fb.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: fb.text },
  privateHead: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  privateInput: { backgroundColor: muse.soft },
  hint: { fontSize: 12, color: fb.muted, lineHeight: 16 },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
  error: { fontSize: 14, color: fb.red, lineHeight: 19 },
});
