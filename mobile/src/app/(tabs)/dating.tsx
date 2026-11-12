import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FbHeader } from "@/components/facebook/FbHeader";
import { FbScreen } from "@/components/facebook/FbScreen";
import { fb, muse, TAB_BAR_SPACE } from "@/constants/theme";
import { useToast } from "@/lib/toast";
import { DATING_PROFILES, DATING_QUESTIONS, DATING_TABS } from "@/mock/data";

type Tab = (typeof DATING_TABS)[number];
const DOTS: Tab[] = ["Friendship", "Matches", "Explore"];

// facebook dating shell. fictional profiles, local interactions only. not connected to musing.
export default function DatingScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Explore");
  const [banner, setBanner] = useState(true);
  const [at, setAt] = useState<Record<Tab, number>>({ "Liked you": 0, Friendship: 0, Matches: 0, Explore: 0 });
  const [answer, setAnswer] = useState<number | null>(null);

  const pool = useMemo(() => DATING_PROFILES.filter((p) => p.tags.includes(tab)), [tab]);
  const profile = pool[at[tab] % Math.max(pool.length, 1)];

  function next(liked: boolean) {
    if (!profile) return;
    if (liked) toast(`You liked ${profile.name}. Mock only, no one is notified.`);
    setAt((s) => ({ ...s, [tab]: s[tab] + 1 }));
  }

  return (
    <FbScreen>
      <FbHeader title="Dating" actions={["assistant", "more"]} />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {DATING_TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.pill, tab === t && styles.pillOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text style={[styles.pillText, tab === t && { color: muse.dating }]}>{t}</Text>
              {DOTS.includes(t) && <View style={styles.dot} />}
            </Pressable>
          ))}
        </ScrollView>

        {banner && (
          <View style={styles.banner}>
            <Image source={DATING_PROFILES[1].image} style={styles.bannerAvatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerText}>Your dating assistant has a new idea for you and your match Jordan.</Text>
              <Pressable onPress={() => toast("A bowling alley with a jukebox, apparently. Mock data.")} hitSlop={6}>
                <Text style={styles.bannerLink}>See more updates</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setBanner(false)} hitSlop={10} accessibilityLabel="Dismiss">
              <MaterialCommunityIcons name="close" size={22} color={fb.text} />
            </Pressable>
          </View>
        )}

        {profile ? (
          <View style={styles.card}>
            <Image source={profile.image} style={styles.photo} contentFit="cover" />
            <View style={styles.fabRow}>
              <Pressable onPress={() => next(false)} style={[styles.fab, styles.fabLight]} accessibilityRole="button" accessibilityLabel="Pass">
                <MaterialCommunityIcons name="close" size={34} color={muse.dating} />
              </Pressable>
              <Pressable onPress={() => next(true)} style={[styles.fab, styles.fabPurple]} accessibilityRole="button" accessibilityLabel="Like">
                <MaterialCommunityIcons name="heart" size={34} color="#fff" />
              </Pressable>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>
                {profile.name}, {profile.age}
              </Text>
              <Text style={styles.line}>{profile.line}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>No one here right now. Mock data.</Text>
        )}

        <View style={styles.askHead}>
          <View style={styles.askIcon}>
            <MaterialCommunityIcons name="creation" size={15} color={muse.dating} />
          </View>
          <Text style={styles.askTitle}>Ask your dating assistant</Text>
        </View>
        <View style={styles.grid}>
          {DATING_QUESTIONS.map((q, i) => (
            <Pressable key={q.q} onPress={() => setAnswer(answer === i ? null : i)} style={[styles.q, answer === i && { borderColor: muse.dating }]} accessibilityRole="button">
              <Text style={styles.qEmoji}>{q.emoji}</Text>
              <Text style={styles.qText}>{q.q}</Text>
            </Pressable>
          ))}
        </View>
        {answer !== null && (
          <View style={styles.answer}>
            <Text style={styles.answerText}>{DATING_QUESTIONS[answer].a}</Text>
            <Text style={styles.answerNote}>Canned mock answer. No AI call is made here.</Text>
          </View>
        )}
      </ScrollView>
    </FbScreen>
  );
}

const styles = StyleSheet.create({
  pills: { paddingHorizontal: 12, gap: 8, paddingBottom: 12 },
  pill: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: fb.button, justifyContent: "center" },
  pillOn: { backgroundColor: muse.soft },
  pillText: { fontSize: 15.5, fontWeight: "600", color: fb.text },
  dot: { position: "absolute", top: 4, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#7c4dff" },
  banner: { flexDirection: "row", gap: 10, marginHorizontal: 12, marginBottom: 14, padding: 10, borderRadius: 12, backgroundColor: muse.soft, alignItems: "flex-start" },
  bannerAvatar: { width: 40, height: 40, borderRadius: 20 },
  bannerText: { fontSize: 15.5, lineHeight: 20, color: fb.text, fontWeight: "500" },
  bannerLink: { fontSize: 15, color: muse.dating, marginTop: 4 },
  card: { marginHorizontal: 12, borderRadius: 12, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  photo: { width: "100%", aspectRatio: 1.02, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  fabRow: { position: "absolute", right: 16, flexDirection: "row", gap: 14, top: "100%", marginTop: -148 },
  fab: { width: 66, height: 66, borderRadius: 33, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  fabLight: { backgroundColor: "#fff" },
  fabPurple: { backgroundColor: muse.dating },
  info: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, minHeight: 104 },
  name: { fontSize: 23, fontWeight: "700", color: fb.text },
  line: { fontSize: 16, lineHeight: 21, color: fb.text, marginTop: 2 },
  empty: { textAlign: "center", color: fb.muted, padding: 40 },
  askHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 10 },
  askIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: muse.soft, alignItems: "center", justifyContent: "center" },
  askTitle: { fontSize: 17, fontWeight: "700", color: fb.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12 },
  q: { width: "48.6%", borderWidth: 1, borderColor: fb.divider, borderRadius: 12, padding: 12, gap: 6 },
  qEmoji: { fontSize: 18 },
  qText: { fontSize: 15, fontWeight: "500", color: fb.text, lineHeight: 19 },
  answer: { marginHorizontal: 12, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: muse.soft },
  answerText: { fontSize: 15.5, lineHeight: 21, color: fb.text },
  answerNote: { fontSize: 12, color: fb.muted, marginTop: 6 },
});
