import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";
import { useToast } from "@/lib/toast";
import { hash } from "@/shared/hash";
import { timeAgo } from "@/shared/time";
import type { User } from "@/shared/types";

export type FeedItem = { id: string; author: User; body: string; created_at: string; image?: ImageSource; ratio?: number; context?: string; follow?: boolean };

// a facebook feed post: header, caption, edge-to-edge media, reactions, actions.
export function FeedPost({ post, onHide }: { post: FeedItem; onHide?: () => void }) {
  const toast = useToast();
  const [liked, setLiked] = useState(false);
  const base = 4 + (hash(post.id) % 60);
  const comments = hash(post.id + "c") % 14;
  const shares = hash(post.id + "s") % 5;

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <Avatar seed={post.author.avatar_seed} name={post.author.name} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.nameLine}>
            <Text style={styles.name}>{post.author.name}</Text>
            {post.context ? <Text style={styles.context}> {post.context}</Text> : null}
            {post.follow ? <Text style={styles.follow}> · Follow</Text> : null}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{timeAgo(post.created_at)} · </Text>
            <MaterialCommunityIcons name="earth" size={13} color={fb.muted} />
          </View>
        </View>
        <Pressable hitSlop={8} onPress={() => toast("Post options are mocked in this prototype.")} accessibilityLabel="Post options">
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={fb.muted} />
        </Pressable>
        {onHide && (
          <Pressable hitSlop={8} onPress={onHide} accessibilityLabel="Hide post" style={{ marginLeft: 12 }}>
            <MaterialCommunityIcons name="close" size={24} color={fb.muted} />
          </Pressable>
        )}
      </View>
      <Text style={styles.body}>{post.body}</Text>
      {post.image && <Image source={post.image} style={{ width: "100%", aspectRatio: post.ratio ?? 1 }} contentFit="cover" />}
      <View style={styles.stats}>
        <View style={styles.likeBubble}>
          <MaterialCommunityIcons name="thumb-up" size={11} color="#fff" />
        </View>
        <Text style={styles.statText}>{base + (liked ? 1 : 0)}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.statText}>{[comments > 0 ? `${comments} comments` : null, shares > 0 ? `${shares} shares` : null].filter(Boolean).join(" · ")}</Text>
      </View>
      <View style={styles.actions}>
        <Action icon={liked ? "thumb-up" : "thumb-up-outline"} label="Like" active={liked} onPress={() => setLiked((v) => !v)} />
        <Action icon="comment-outline" label="Comment" onPress={() => toast("Comments are mocked in this prototype.")} />
        <Action icon="share-outline" label="Share" onPress={() => toast("Sharing is mocked in this prototype.")} />
      </View>
    </View>
  );
}

function Action({ icon, label, onPress, active = false }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: fb.hover }]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }}>
      <MaterialCommunityIcons name={icon} size={21} color={active ? fb.blue : fb.muted} />
      <Text style={[styles.actionText, active && { color: fb.blue }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  post: { backgroundColor: fb.bg, paddingTop: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14 },
  nameLine: { fontSize: 15.5, lineHeight: 20, color: fb.text },
  name: { fontWeight: "700" },
  context: { fontWeight: "400" },
  follow: { color: fb.blue, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 1 },
  meta: { fontSize: 13, color: fb.muted },
  body: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, fontSize: 16, lineHeight: 21, color: fb.text },
  stats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9, gap: 6 },
  likeBubble: { width: 19, height: 19, borderRadius: 10, backgroundColor: fb.blue, alignItems: "center", justifyContent: "center" },
  statText: { fontSize: 14, color: fb.muted },
  actions: { flexDirection: "row", marginHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: fb.divider, paddingVertical: 2 },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 6 },
  actionText: { fontSize: 14.5, fontWeight: "600", color: fb.muted },
});
