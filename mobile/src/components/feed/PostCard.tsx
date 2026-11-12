import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { fb } from "@/constants/theme";
import { hash } from "@/shared/hash";
import { timeAgo } from "@/shared/time";
import type { FeedPost } from "./types";

export function PostCard({ post }: { post: FeedPost }) {
  const likes = 3 + (hash(post.id) % 40);
  const comments = hash(post.id + "c") % 9;
  return (
    <Card>
      <View style={styles.header}>
        <Avatar seed={post.author.avatar_seed} name={post.author.name} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{post.author.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{timeAgo(post.created_at)} · </Text>
            <Ionicons name="earth" size={12} color={fb.muted} />
          </View>
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color={fb.muted} />
      </View>
      <Text style={styles.body}>{post.body}</Text>
      <View style={styles.stats}>
        <View style={styles.likeBubble}>
          <Ionicons name="thumbs-up" size={10} color="#fff" />
        </View>
        <Text style={styles.statText}>{likes}</Text>
        <View style={{ flex: 1 }} />
        {comments > 0 && <Text style={styles.statText}>{comments} comments</Text>}
      </View>
      <View style={styles.actions}>
        <Action icon="thumbs-up-outline" label="Like" />
        <Action icon="chatbubble-outline" label="Comment" />
        <Action icon="arrow-redo-outline" label="Share" />
      </View>
    </Card>
  );
}

function Action({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={styles.action}>
      <Ionicons name={icon} size={20} color={fb.muted} />
      <Text style={styles.actionText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  name: { fontSize: 15, fontWeight: "600", color: fb.text },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { fontSize: 13, color: fb.muted },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, fontSize: 15, lineHeight: 20, color: fb.text },
  stats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  likeBubble: { width: 18, height: 18, borderRadius: 9, backgroundColor: fb.blue, alignItems: "center", justifyContent: "center" },
  statText: { fontSize: 14, color: fb.muted },
  actions: { flexDirection: "row", marginHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fb.divider, paddingVertical: 4 },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  actionText: { fontSize: 14, fontWeight: "600", color: fb.muted },
});
