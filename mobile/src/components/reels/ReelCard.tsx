import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { hash } from "@/shared/hash";
import type { User } from "@/shared/types";

export type Reel = { id: string; topic: string; user: User; caption: string };

const CAPTIONS: Record<string, string> = {
  thrifting: "$6 jacket. don't ask me where.",
  vinyl: "crate digging sunday",
  coffee: "third cup, no regrets",
  sewing: "turned curtains into a shirt",
  baking: "sourdough, day 14",
  film: "35mm, overcast, perfect",
  ramen: "broth over everything",
  brunch: "the hollandaise was a journey",
  yoga: "sunrise flow, mostly stretching",
  climbing: "sent it. legs disagree.",
  hiking: "the view was worth the 5am",
  gadgets: "unboxing a thing i didn't need",
  museums: "quiet tuesday at the museum",
  karaoke: "note: i can't sing. anyway.",
  concerts: "front row, ears ringing",
  pottery: "wheel 1, me 0",
  bookstores: "left with six books",
  running: "run club, 7am, sort of alive",
  pickleball: "the dink is undefeated",
  "board games": "catan ended a friendship",
  anime: "rewatching the whole thing",
  photography: "golden hour did the work",
  plants: "repotted everything",
  cooking: "dinner for eight, invited four",
  cycling: "40k before breakfast",
  trivia: "we lost on a technicality",
  "dim sum": "ordered too much. correct.",
  smoothies: "it's green but it's good",
};

export function captionFor(topic: string): string {
  return CAPTIONS[topic] ?? `${topic}, but make it a weekend`;
}

// placeholder reel: full-height gradient tinted by topic, creator, caption, right rail.
export function ReelCard({ reel, height }: { reel: Reel; height: number }) {
  const h = hash(reel.topic) % 360;
  const likes = 120 + (hash(reel.id) % 4000);
  return (
    <LinearGradient colors={[`hsl(${h}, 55%, 28%)`, `hsl(${(h + 40) % 360}, 60%, 10%)`]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[styles.card, { height }]}>
      <View style={styles.topicPill}>
        <Text style={styles.topicText}>{reel.topic}</Text>
      </View>
      <View style={styles.rail}>
        <Rail icon="heart-outline" label={String(likes)} />
        <Rail icon="chatbubble-outline" label={String(hash(reel.id + "c") % 90)} />
        <Rail icon="arrow-redo-outline" label="Share" />
      </View>
      <View style={styles.bottom}>
        <View style={styles.creator}>
          <Avatar seed={reel.user.avatar_seed} name={reel.user.name} size={36} />
          <Text style={styles.creatorName}>{reel.user.name}</Text>
        </View>
        <Text style={styles.caption}>{reel.caption}</Text>
      </View>
    </LinearGradient>
  );
}

function Rail({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }) {
  return (
    <View style={styles.railItem}>
      <Ionicons name={icon} size={28} color="#fff" />
      <Text style={styles.railText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", justifyContent: "flex-end" },
  topicPill: { position: "absolute", top: 16, left: 16, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  topicText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  rail: { position: "absolute", right: 12, bottom: 110, gap: 18, alignItems: "center" },
  railItem: { alignItems: "center", gap: 2 },
  railText: { color: "#fff", fontSize: 12 },
  bottom: { padding: 16, paddingRight: 72, gap: 8 },
  creator: { flexDirection: "row", alignItems: "center", gap: 8 },
  creatorName: { color: "#fff", fontWeight: "600", fontSize: 15 },
  caption: { color: "#fff", fontSize: 15, lineHeight: 20 },
});
