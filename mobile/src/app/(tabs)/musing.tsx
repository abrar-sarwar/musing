import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SignalComposer } from "@/components/musing/SignalComposer";
import { Screen } from "@/components/shell/Screen";
import { Card } from "@/components/ui/Card";
import { fb, museGradient } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { COPY } from "@/shared/copy";
import { timeAgo } from "@/shared/time";
import type { Muse } from "@/shared/types";

// the musing. surface: hero, signal composer, past musings.
export default function MusingScreen() {
  const { userId } = useActingUser();
  const [composerKey, setComposerKey] = useState(0);
  const [prefill, setPrefill] = useState<string | undefined>(undefined);

  const muses = useQuery(async () => {
    const { data, error } = await supabase.from("muses").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []) as Muse[];
  }, [userId]);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.brand}>{COPY.brand}</Text>
            <Text style={styles.tagline}>one vague thought. a real plan with friends. nobody has to ask.</Text>
          </LinearGradient>

          <SignalComposer key={composerKey} prefill={prefill} onUnderstood={() => void muses.reload()} />

          <Text style={styles.section}>your musings</Text>
          <Card>
            {(muses.data ?? []).map((m, i, arr) => (
              <Pressable
                key={m.id}
                onPress={() => {
                  setPrefill(m.raw_text);
                  setComposerKey((k) => k + 1);
                }}
                style={({ pressed }) => [styles.museRow, i < arr.length - 1 && styles.museBorder, pressed && { backgroundColor: fb.hover }]}
              >
                <Text style={styles.museText}>{m.raw_text}</Text>
                <Text style={styles.museMeta}>
                  {timeAgo(m.created_at).toLowerCase()}
                  {m.understood ? ` · ${m.understood.activity}` : ""}
                </Text>
              </Pressable>
            ))}
            {!muses.loading && (muses.data?.length ?? 0) === 0 && <Text style={styles.empty}>nothing yet. that&apos;s fine.</Text>}
          </Card>
          <View style={{ height: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { margin: 12, borderRadius: 16, padding: 20, gap: 6 },
  brand: { color: "#fff", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { color: "rgba(255,255,255,0.92)", fontSize: 15, lineHeight: 20 },
  section: { fontSize: 15, fontWeight: "600", color: fb.muted, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  museRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  museBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  museText: { fontSize: 15, color: fb.text },
  museMeta: { fontSize: 12, color: fb.muted },
  empty: { padding: 16, color: fb.muted },
});
