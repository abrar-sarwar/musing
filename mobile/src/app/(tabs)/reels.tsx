import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FbHeader } from "@/components/facebook/FbHeader";
import { OverlapCard } from "@/components/reels/OverlapCard";
import { Avatar } from "@/components/ui/Avatar";
import { TAB_BAR_SPACE } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useQuery } from "@/lib/use-query";
import { reelPoster } from "@/mock/media";
import { hash } from "@/shared/hash";
import type { Overlap, User } from "@/shared/types";

type Reel = { id: string; topic: string; user: User; caption: string; poster: ImageSource; headline: string };
type Row = { user_id: string; topic: string; score: number; user: User };

const CAPTIONS: Record<string, [headline: string, caption: string]> = {
  thrifting: ["Thrift with me: $20 challenge", "$6 jacket. don't ask me where."],
  vinyl: ["Crate digging, Sunday edition", "three records, zero regrets"],
  coffee: ["The pour, in slow motion", "third cup, no regrets"],
  sewing: ["Curtains to shirt in 60 seconds", "turned curtains into a shirt"],
  baking: ["Sourdough, day 14", "it finally has ears"],
  film: ["35mm, overcast, perfect", "one roll, one afternoon"],
  ramen: ["Rating every bowl in town", "broth over everything"],
  brunch: ["The hollandaise was a journey", "worth the 40 minute wait"],
  climbing: ["Sent it. Legs disagree.", "V5 after three weeks"],
  hiking: ["The view was worth the 5am", "trail was empty the whole way up"],
  pottery: ["Wheel 1, me 0", "it was supposed to be a mug"],
  running: ["Run club, 7am, sort of alive", "we ran. allegedly."],
  pickleball: ["The dink is undefeated", "new paddle, same backhand"],
  "board games": ["This game ended a friendship", "rules explained twice"],
  photography: ["Golden hour did the work", "no filter, i promise"],
  plants: ["Repotted everything", "the pothos is thriving, at least"],
  cooking: ["Dinner for eight, invited four", "market haul to plate"],
  concerts: ["Front row, ears ringing", "they played the old stuff"],
  bookstores: ["Left with six books", "came in for one"],
  cycling: ["40k before breakfast", "legs are a rumor now"],
};

function describe(topic: string): [string, string] {
  return CAPTIONS[topic] ?? [`${topic[0]?.toUpperCase()}${topic.slice(1)}, but make it a weekend`, `${topic} again. no notes.`];
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { userId } = useActingUser();
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState(false);

  // the count comes from sql on the server: opted-in friends only, null below 3.
  const overlap = useQuery(() => apiGet<{ overlap: Overlap }>("/api/overlap", userId).then((r) => r.overlap), [userId]);

  const rows = useQuery(async () => {
    const { data, error } = await supabase.from("reels_topics").select("*, user:users!reels_topics_user_id_fkey(*)").order("score", { ascending: false }).limit(40);
    if (error) throw new Error(error.message);
    return data as unknown as Row[];
  });

  const reels = useMemo<Reel[]>(() => {
    // one reel per topic so every reel has its own media; other people's reels only
    const seen = new Set<string>();
    const out: Reel[] = [];
    for (const r of rows.data ?? []) {
      if (r.user_id === userId || seen.has(r.topic)) continue;
      seen.add(r.topic);
      const [headline, caption] = describe(r.topic);
      out.push({ id: `${r.user_id}:${r.topic}`, topic: r.topic, user: r.user, caption, headline, poster: reelPoster(r.topic) });
    }
    // lead with something neutral so the overlap reel is discovered, not the first thing shown
    const t = overlap.data?.topic;
    const i = out.findIndex((r) => r.topic === t);
    if (i >= 0 && i !== 1 && out.length > 2) {
      const [hit] = out.splice(i, 1);
      out.splice(1, 0, hit);
    }
    return out.slice(0, 14);
  }, [rows.data, userId, overlap.data?.topic]);

  return (
    <View style={styles.fill} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && (
        <FlatList
          data={reels}
          keyExtractor={(r) => r.id}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.y / height))}
          ListEmptyComponent={<Text style={styles.empty}>{rows.error ?? (rows.loading ? "Loading…" : "No reels yet.")}</Text>}
          renderItem={({ item, index: i }) => {
            const likes = 900 + (hash(item.id) % 140000);
            const showOverlap = overlap.data && item.topic === overlap.data.topic && i === index && !dismissed;
            return (
              <View style={{ height }}>
                <Image source={item.poster} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={["rgba(0,0,0,0.75)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.9)"]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
                <Text style={[styles.headline, { top: insets.top + 78 }]}>{item.headline}</Text>

                <View style={[styles.rail, { bottom: TAB_BAR_SPACE + 20 }]}>
                  <Rail icon={liked[item.id] ? "thumb-up" : "thumb-up-outline"} label={compact(likes + (liked[item.id] ? 1 : 0))} onPress={() => setLiked((s) => ({ ...s, [item.id]: !s[item.id] }))} />
                  <Rail icon="comment-outline" label={compact(40 + (hash(item.id + "c") % 900))} onPress={() => toast("Comments are mocked in this prototype.")} />
                  <Rail icon="share-outline" label={compact(10 + (hash(item.id + "s") % 5000))} onPress={() => toast("Sharing is mocked in this prototype.")} />
                  <Rail icon={saved[item.id] ? "bookmark" : "bookmark-outline"} label={saved[item.id] ? "Saved" : compact(20 + (hash(item.id + "b") % 19000))} onPress={() => setSaved((s) => ({ ...s, [item.id]: !s[item.id] }))} />
                  <Rail icon="dots-horizontal" label="" onPress={() => toast("More options are mocked in this prototype.")} />
                </View>

                <View style={[styles.bottom, { bottom: TAB_BAR_SPACE + 8 }]}>
                  {showOverlap && overlap.data && <OverlapCard overlap={overlap.data} onDismiss={() => setDismissed(true)} />}
                  <View style={styles.creator}>
                    <Avatar seed={item.user.avatar_seed} name={item.user.name} size={38} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.creatorName}>{item.user.name}</Text>
                        <MaterialCommunityIcons name="earth" size={14} color="#fff" />
                      </View>
                      <View style={styles.nameRow}>
                        <MaterialCommunityIcons name="music-note" size={14} color="#fff" />
                        <Text style={styles.audio} numberOfLines={1}>
                          {item.user.name.split(" ")[0]} · Original audio
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.caption} numberOfLines={2}>
                    {item.caption} <Text style={styles.topic}>#{item.topic.replace(/\s+/g, "")}</Text>
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
      <View style={[styles.header, { paddingTop: insets.top }]} pointerEvents="box-none">
        <FbHeader title="Reels" dark actions={["more", "search", "messenger"]} />
      </View>
    </View>
  );
}

function Rail({ icon, label, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.railItem} hitSlop={6} accessibilityRole="button" accessibilityLabel={icon}>
      <MaterialCommunityIcons name={icon} size={31} color="#fff" />
      {label ? <Text style={styles.railText}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  header: { position: "absolute", top: 0, left: 0, right: 0 },
  headline: { position: "absolute", left: 24, right: 24, color: "#fff", fontSize: 19, fontStyle: "italic", fontWeight: "600", textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  rail: { position: "absolute", right: 10, gap: 18, alignItems: "center" },
  railItem: { alignItems: "center", gap: 3 },
  railText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  bottom: { position: "absolute", left: 14, right: 70 },
  creator: { flexDirection: "row", alignItems: "center", gap: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  creatorName: { color: "#fff", fontWeight: "700", fontSize: 15.5 },
  audio: { color: "#fff", fontSize: 13.5, flexShrink: 1 },
  caption: { color: "#fff", fontSize: 15, lineHeight: 20, marginTop: 8 },
  topic: { fontWeight: "700" },
  empty: { color: "#aaa", textAlign: "center", padding: 24, marginTop: 160 },
});
