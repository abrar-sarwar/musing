import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { useTableChanges } from "@/lib/use-realtime";
import { timeAgo } from "@/shared/time";
import type { Message, Thread, User } from "@/shared/types";

type Row = Thread & { last: Message | null };

export default function MessagesScreen() {
  const { userId, users } = useActingUser();
  const router = useRouter();
  const byId = new Map(users.map((u) => [u.id, u]));

  const threads = useQuery(async () => {
    const { data: ts, error } = await supabase.from("threads").select("*").contains("member_ids", [userId]);
    if (error) throw new Error(error.message);
    const list = (ts ?? []) as Thread[];
    if (list.length === 0) return [] as Row[];
    const { data: ms, error: e2 } = await supabase
      .from("messages")
      .select("*")
      .in("thread_id", list.map((t) => t.id))
      .order("created_at", { ascending: false });
    if (e2) throw new Error(e2.message);
    const msgs = (ms ?? []) as Message[];
    return list
      .map<Row>((t) => ({ ...t, last: msgs.find((m) => m.thread_id === t.id) ?? null }))
      .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
  }, [userId]);

  useTableChanges("messages", () => void threads.reload());

  return (
    <SubScreen title="Chats">
      <FlatList
        data={threads.data ?? []}
        keyExtractor={(t) => t.id}
        style={{ backgroundColor: "#fff" }}
        renderItem={({ item: t }) => {
          const others = t.member_ids.filter((id) => id !== userId).map((id) => byId.get(id)).filter(Boolean) as User[];
          const senderName = t.last?.sender_id === userId ? "You" : t.last?.sender_id ? (byId.get(t.last.sender_id)?.name.split(" ")[0] ?? "") : "muse";
          return (
            <Pressable onPress={() => router.push({ pathname: "/messages/[id]", params: { id: t.id } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: fb.hover }]}>
              <View style={styles.stack}>
                {others[0] && <Avatar seed={others[0].avatar_seed} name={others[0].name} size={36} style={styles.a1} />}
                {others[1] && <Avatar seed={others[1].avatar_seed} name={others[1].name} size={36} style={styles.a2} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t.title}</Text>
                {t.last && (
                  <Text style={styles.preview} numberOfLines={1}>
                    {senderName}: {t.last.body ?? "sent a plan"} · {timeAgo(t.last.created_at)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{threads.error ?? (threads.loading ? "Loading…" : "No chats yet.")}</Text>}
      />
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  stack: { width: 56, height: 56 },
  a1: { position: "absolute", left: 0, top: 0 },
  a2: { position: "absolute", right: 0, bottom: 0, borderWidth: 2, borderColor: "#fff" },
  title: { fontSize: 16, fontWeight: "600", color: fb.text },
  preview: { fontSize: 14, color: fb.muted, marginTop: 2 },
  empty: { color: fb.muted, textAlign: "center", padding: 24 },
});
