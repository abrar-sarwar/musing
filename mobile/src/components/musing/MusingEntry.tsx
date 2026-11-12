import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MuseAvatar } from "@/components/ui/Avatar";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useQuery } from "@/lib/use-query";
import { useTableChanges } from "@/lib/use-realtime";
import { COPY } from "@/shared/copy";
import { firstName } from "@/shared/time";
import type { MusingHome, Overlap } from "@/shared/types";

// the composer action on home: "✦ what's the move?" opens the musing. signal composer.
export function MoveChip() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/musing")} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={COPY.composerPlaceholder}>
      <MaterialCommunityIcons name="creation" size={15} color={muse.text} />
      <Text style={styles.chipText}>{COPY.composerPlaceholder}</Text>
    </Pressable>
  );
}

type Unit = { title: string; sub: string; action: string; go: () => void };

// one musing. unit in feed, styled like a suggested post. it is driven by real state:
// an ask that reached you, a plan you floated, or a friends overlap. nothing private.
export function MusingFeedUnit() {
  const { userId } = useActingUser();
  const { setHandoff, settings } = usePrefs();
  const router = useRouter();
  const home = useQuery(() => apiGet<MusingHome>("/api/musing/home", userId), [userId]);
  const overlap = useQuery(() => apiGet<{ overlap: Overlap }>("/api/overlap", userId).then((r) => r.overlap), [userId]);
  useTableChanges("plans", () => void home.reload());
  if (!settings.muse_on) return null;

  const toPlan = (id: string) => () => router.push({ pathname: "/musing/[planId]", params: { planId: id } });
  const ask = home.data?.asks.find((p) => p.state === "proposing" && p.me?.status === "pending");
  const mine = home.data?.mine.find((p) => p.state === "draft" || p.state === "proposing" || p.state === "happening");

  let unit: Unit | null = null;
  if (ask) unit = { title: `${firstName(ask.starter.name).toLowerCase()}'s thinking about ${ask.activity}`, sub: `${ask.when ?? "sometime soon"}. muse thought of you. your answer stays private.`, action: "see the ask", go: toPlan(ask.id) };
  else if (mine?.state === "happening") unit = { title: `your ${mine.activity} is happening`, sub: `${mine.when ?? ""}. the chat and the event are ready.`, action: "open the plan", go: toPlan(mine.id) };
  else if (mine) unit = { title: `you're thinking about ${mine.activity}`, sub: `muse found a possible move with ${mine.invited} friends.`, action: "see the mix", go: toPlan(mine.id) };
  else if (overlap.data)
    unit = {
      title: `${overlap.data.count} of your friends are into ${overlap.data.topic} lately`,
      sub: "want muse to make it a thing? nobody finds out who.",
      action: "make a move",
      go: () => {
        setHandoff(`${overlap.data?.topic} with whoever's into it`);
        router.push("/musing");
      },
    };
  if (!unit) return null;

  return (
    <View style={styles.unit}>
      <View style={styles.head}>
        <MuseAvatar size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{COPY.brand}</Text>
          <Text style={styles.meta}>Suggested for you · only you can see this</Text>
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.title}>{unit.title}</Text>
        <Text style={styles.sub}>{unit.sub}</Text>
        <Pressable onPress={unit.go} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={unit.action}>
          <Text style={styles.btnText}>{unit.action}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: muse.soft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 14, fontWeight: "600", color: muse.text },
  unit: { backgroundColor: fb.bg, paddingTop: 12, paddingBottom: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  name: { fontSize: 15.5, fontWeight: "700", color: fb.text },
  meta: { fontSize: 13, color: fb.muted },
  panel: { marginHorizontal: 14, marginTop: 10, borderRadius: 14, backgroundColor: muse.softer, borderWidth: 1, borderColor: muse.line, padding: 14, gap: 4 },
  title: { fontSize: 18, fontWeight: "700", color: fb.text, lineHeight: 23 },
  sub: { fontSize: 15, color: fb.muted, lineHeight: 20 },
  btn: { marginTop: 8, height: 38, borderRadius: 8, backgroundColor: muse.soft, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "700", color: muse.text },
});
