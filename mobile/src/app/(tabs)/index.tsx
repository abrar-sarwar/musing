import { FlatList, StyleSheet, Text, View } from "react-native";
import { Composer } from "@/components/feed/Composer";
import { PostCard } from "@/components/feed/PostCard";
import type { FeedPost } from "@/components/feed/types";
import { Screen } from "@/components/shell/Screen";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";

export default function FeedScreen() {
  const { me } = useActingUser();
  const posts = useQuery(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*, author:users!posts_author_id_fkey(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as FeedPost[];
  });

  return (
    <Screen>
      <FlatList
        data={posts.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={me ? <Composer me={me} /> : undefined}
        ListHeaderComponentStyle={{ marginBottom: 8 }}
        ItemSeparatorComponent={Gap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{posts.error ? `Couldn't load the feed: ${posts.error}` : posts.loading ? "Loading…" : "Nothing here yet."}</Text>
          </View>
        }
        refreshing={posts.loading}
        onRefresh={posts.reload}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </Screen>
  );
}

const Gap = () => <View style={{ height: 8 }} />;

const styles = StyleSheet.create({
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: fb.muted, textAlign: "center" },
});
