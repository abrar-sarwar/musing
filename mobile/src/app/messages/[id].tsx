import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, type ComponentRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PlanMessageCard, type PlanCardPayload } from "@/components/messenger/PlanMessageCard";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar, MuseAvatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import type { Message, Thread } from "@/shared/types";

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, users } = useActingUser();
  const byId = new Map(users.map((u) => [u.id, u]));
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const q = useQuery(async () => {
    const [{ data: t, error }, { data: ms, error: e2 }] = await Promise.all([
      supabase.from("threads").select("*").eq("id", id).maybeSingle(),
      supabase.from("messages").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    if (e2) throw new Error(e2.message);
    return { thread: t as Thread | null, messages: (ms ?? []) as Message[] };
  }, [id]);

  // new messages land live (the plan card arrives this way on quorum)
  useEffect(() => {
    const ch = supabase
      .channel(`thread-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${id}` }, () => void q.reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(t);
  }, [q.data?.messages.length]);

  return (
    <SubScreen title={q.data?.thread?.title ?? "Chat"}>
      <ScrollView ref={scrollRef} style={{ backgroundColor: "#fff" }} contentContainerStyle={styles.list}>
        {q.error && <Text style={styles.empty}>{q.error}</Text>}
        {(q.data?.messages ?? []).map((m) => {
          const mine = m.sender_id === userId;
          const sender = m.sender_id ? byId.get(m.sender_id) : null;
          const card = m.card as PlanCardPayload | null;
          return (
            <View key={m.id} style={[styles.row, mine && styles.rowMine]}>
              {!mine && (sender ? <Avatar seed={sender.avatar_seed} name={sender.name} size={28} /> : <MuseAvatar size={28} />)}
              {card?.type === "plan" ? (
                <PlanMessageCard card={card} />
              ) : (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={[styles.text, mine && { color: "#fff" }]}>{m.body}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <View style={styles.input}>
          <Text style={{ color: fb.muted }}>Aa</Text>
        </View>
        <Ionicons name="thumbs-up" size={24} color={fb.blue} />
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 6, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "75%", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: fb.blue },
  bubbleOther: { backgroundColor: fb.input },
  text: { fontSize: 16, color: fb.text },
  composer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fb.divider, backgroundColor: "#fff" },
  input: { flex: 1, height: 38, borderRadius: 19, backgroundColor: fb.input, justifyContent: "center", paddingHorizontal: 14 },
  empty: { color: fb.muted, textAlign: "center", padding: 24 },
});
