import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FbHeader } from "@/components/facebook/FbHeader";
import { FbScreen } from "@/components/facebook/FbScreen";
import { FeedPost, type FeedItem } from "@/components/facebook/FeedPost";
import { StoryCard } from "@/components/facebook/StoryCard";
import { MoveChip, MusingFeedUnit } from "@/components/musing/MusingEntry";
import { Avatar } from "@/components/ui/Avatar";
import { fb, TAB_BAR_SPACE } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useQuery } from "@/lib/use-query";
import { EXTRA_POSTS, POST_EXTRAS, STORY_MEDIA } from "@/mock/data";
import { COVER } from "@/mock/media";
import type { Post, User } from "@/shared/types";

type Row = { kind: "post"; post: FeedItem } | { kind: "musing" };

export default function HomeScreen() {
  const { me, users, userId } = useActingUser();
  const toast = useToast();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [mine, setMine] = useState<FeedItem[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [story, setStory] = useState<{ user: User; media: ImageSource } | null>(null);

  const posts = useQuery(async () => {
    const { data, error } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Post[];
  });

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const rows = useMemo<Row[]>(() => {
    const seeded: FeedItem[] = (posts.data ?? []).flatMap((p) => {
      const author = byId.get(p.author_id);
      return author ? [{ id: p.id, author, body: p.body, created_at: p.created_at, ...POST_EXTRAS[p.author_id] }] : [];
    });
    const extra: FeedItem[] = EXTRA_POSTS.flatMap((p) => {
      const author = byId.get(p.author_id);
      return author ? [{ id: p.id, author, body: p.body, created_at: new Date(Date.now() - p.hoursAgo * 3600_000).toISOString(), image: p.image, ratio: p.ratio, context: p.context }] : [];
    });
    const all = [...seeded, ...extra].filter((p) => !hidden.includes(p.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const list: Row[] = [...mine, ...all].map((post) => ({ kind: "post", post }));
    // the musing. unit sits one post down, like any suggested unit
    list.splice(Math.min(1, list.length), 0, { kind: "musing" });
    return list;
  }, [posts.data, byId, mine, hidden]);

  const storyUsers = useMemo(() => users.filter((u) => u.id !== userId && STORY_MEDIA[u.id]).slice(0, 9), [users, userId]);

  function publish() {
    if (!me || draft.trim().length === 0) return;
    setMine((m) => [{ id: `local-${Date.now()}`, author: me, body: draft.trim(), created_at: new Date().toISOString() }, ...m]);
    setDraft("");
    setComposing(false);
    toast("Posted. Local to this device, it resets with the demo.");
  }

  const header = (
    <View>
      <View style={styles.composer}>
        {me ? <Avatar seed={me.avatar_seed} name={me.name} size={42} /> : <View style={styles.ghost} />}
        <Pressable style={{ flex: 1 }} onPress={() => setComposing(true)} accessibilityRole="button" accessibilityLabel="Create a post">
          <Text style={styles.mind}>What&apos;s on your mind?</Text>
        </Pressable>
        <Pressable onPress={() => setComposing(true)} hitSlop={8} accessibilityLabel="Add a photo">
          <MaterialCommunityIcons name="image" size={26} color={fb.muted} />
        </Pressable>
      </View>
      <View style={styles.moveRow}>
        <MoveChip />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
        {me && <StoryCard user={me} media={STORY_MEDIA[me.id] ?? COVER.hills} label="Your story" seen onPress={() => setStory({ user: me, media: STORY_MEDIA[me.id] ?? COVER.hills })} />}
        {storyUsers.map((u) => (
          <StoryCard key={u.id} user={u} media={STORY_MEDIA[u.id]} label={u.name} onPress={() => setStory({ user: u, media: STORY_MEDIA[u.id] })} />
        ))}
      </ScrollView>
      <View style={styles.band} />
    </View>
  );

  return (
    <FbScreen>
      <FbHeader actions={["create", "search", "messenger"]} onCreate={() => setComposing(true)} />
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === "post" ? r.post.id : "musing")}
        renderItem={({ item }) => (item.kind === "post" ? <FeedPost post={item.post} onHide={() => setHidden((h) => [...h, item.post.id])} /> : <MusingFeedUnit />)}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Band}
        ListEmptyComponent={<Text style={styles.empty}>{posts.error ? `Couldn't load the feed: ${posts.error}` : "Loading…"}</Text>}
        refreshing={false}
        onRefresh={posts.reload}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        showsVerticalScrollIndicator={false}
      />

      {/* facebook-style post composer sheet */}
      <Modal visible={composing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposing(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetBar}>
            <Pressable onPress={() => setComposing(false)} hitSlop={10} accessibilityLabel="Close">
              <MaterialCommunityIcons name="close" size={26} color={fb.text} />
            </Pressable>
            <Text style={styles.sheetTitle}>Create post</Text>
            <Pressable onPress={publish} disabled={draft.trim().length === 0} style={[styles.postBtn, draft.trim().length === 0 && { backgroundColor: fb.button }]} accessibilityRole="button" accessibilityLabel="Post">
              <Text style={[styles.postBtnText, draft.trim().length === 0 && { color: fb.muted }]}>Post</Text>
            </Pressable>
          </View>
          <View style={styles.sheetWho}>
            {me && <Avatar seed={me.avatar_seed} name={me.name} size={44} />}
            <View>
              <Text style={styles.sheetName}>{me?.name}</Text>
              <View style={styles.audience}>
                <MaterialCommunityIcons name="account-multiple" size={13} color={fb.text} />
                <Text style={styles.audienceText}>Friends</Text>
              </View>
            </View>
          </View>
          <TextInput value={draft} onChangeText={setDraft} placeholder="What's on your mind?" placeholderTextColor={fb.muted} multiline autoFocus style={styles.sheetInput} />
        </View>
      </Modal>

      {/* story viewer */}
      <Modal visible={story !== null} animationType="fade" onRequestClose={() => setStory(null)}>
        <Pressable style={styles.viewer} onPress={() => setStory(null)} accessibilityLabel="Close story">
          {story && <Image source={story.media} style={StyleSheet.absoluteFill} contentFit="cover" />}
          <SafeAreaView edges={["top"]}>
            <View style={styles.progress} />
            {story && (
              <View style={styles.viewerHead}>
                <Avatar seed={story.user.avatar_seed} name={story.user.name} size={38} />
                <Text style={styles.viewerName}>{story.user.name}</Text>
                <Text style={styles.viewerAge}>3h</Text>
                <View style={{ flex: 1 }} />
                <MaterialCommunityIcons name="close" size={28} color="#fff" />
              </View>
            )}
          </SafeAreaView>
        </Pressable>
      </Modal>
    </FbScreen>
  );
}

const Band = () => <View style={styles.band} />;

const styles = StyleSheet.create({
  composer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 },
  ghost: { width: 42, height: 42, borderRadius: 21, backgroundColor: fb.input },
  mind: { fontSize: 17, color: fb.text },
  moveRow: { paddingLeft: 68, paddingBottom: 10 },
  stories: { paddingHorizontal: 10, gap: 6, paddingBottom: 12 },
  band: { height: 5, backgroundColor: "#c9ccd1" },
  empty: { color: fb.muted, textAlign: "center", padding: 24 },
  sheet: { flex: 1, backgroundColor: "#fff" },
  sheetBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, height: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: fb.text },
  postBtn: { backgroundColor: fb.blue, borderRadius: 8, paddingHorizontal: 14, height: 34, alignItems: "center", justifyContent: "center" },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sheetWho: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  sheetName: { fontSize: 16, fontWeight: "700", color: fb.text },
  audience: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: fb.button, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginTop: 2 },
  audienceText: { fontSize: 12, fontWeight: "600", color: fb.text },
  sheetInput: { flex: 1, paddingHorizontal: 14, fontSize: 22, color: fb.text, textAlignVertical: "top" },
  viewer: { flex: 1, backgroundColor: "#000" },
  progress: { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.85)", marginHorizontal: 10, marginTop: 6 },
  viewerHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  viewerName: { color: "#fff", fontWeight: "700", fontSize: 16 },
  viewerAge: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
});
