import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { captionFor, ReelCard, type Reel } from "@/components/reels/ReelCard";
import { Screen } from "@/components/shell/Screen";
import { fb } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import type { User } from "@/shared/types";

type Row = { user_id: string; topic: string; score: number; user: User };

export default function ReelsScreen() {
  const [height, setHeight] = useState(0);
  const reels = useQuery(async () => {
    const { data, error } = await supabase
      .from("reels_topics")
      .select("*, user:users!reels_topics_user_id_fkey(*)")
      .order("score", { ascending: false })
      .limit(24);
    if (error) throw new Error(error.message);
    return (data as unknown as Row[]).map<Reel>((r) => ({ id: `${r.user_id}:${r.topic}`, topic: r.topic, user: r.user, caption: captionFor(r.topic) }));
  });

  return (
    <Screen>
      <View style={styles.fill} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 && (
          <FlatList
            data={reels.data ?? []}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => <ReelCard reel={item} height={height} />}
            pagingEnabled
            snapToInterval={height}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            ListEmptyComponent={<Text style={styles.empty}>{reels.error ?? (reels.loading ? "Loading…" : "No reels yet.")}</Text>}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  empty: { color: fb.muted, textAlign: "center", padding: 24 },
});
