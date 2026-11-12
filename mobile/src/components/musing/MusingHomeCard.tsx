import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useTableChanges } from "@/lib/use-realtime";
import { COPY } from "@/shared/copy";
import { firstName } from "@/shared/time";
import type { MusingHome } from "@/shared/types";

const CHIPS: Array<[label: string, thought: string]> = [
  ["thrifting", "lowkey wanna go thrifting"],
  ["food run", "anyone down for food later?"],
  ["weekend plans", "need something to do this weekend"],
];

type State = { headline: string; sub: string; action: string; planId: string } | null;

// pick the single most useful thing to say, from data the server already shaped for
// this person. counts only before a plan is on. never who answered, never a limit.
function pick(home: MusingHome | null): State {
  if (!home) return null;
  const ask = home.asks.find((p) => p.state === "proposing" && p.me?.status === "pending");
  if (ask) return { headline: `${firstName(ask.starter.name).toLowerCase()} has a move you might be into.`, sub: `${ask.activity}, ${ask.when ?? "soon"}. your answer stays private.`, action: "see the ask", planId: ask.id };
  const on = home.mine.find((p) => p.state === "happening");
  if (on) return { headline: `your ${on.activity} is happening.`, sub: `${on.when ?? "soon"}. the chat and the event are ready.`, action: "check the plan", planId: on.id };
  const open = home.mine.find((p) => p.state === "proposing");
  if (open) return { headline: `your ${open.activity} plan is coming together.`, sub: `${open.downCount} of ${open.quorum} in so far. names show once it's on.`, action: "check the plan", planId: open.id };
  const draft = home.mine.find((p) => p.state === "draft");
  if (draft) return { headline: `still thinking about ${draft.activity}?`, sub: "muse might've found a move with your friends.", action: "see the mix", planId: draft.id };
  return null;
}

// the musing. entry point on facebook home, directly under the composer. one tap
// opens the signal composer with the keyboard up. it is always there, never a pop-up.
export function MusingHomeCard() {
  const router = useRouter();
  const { userId, version } = useActingUser();
  const { setHandoff, settings } = usePrefs();
  const [home, setHome] = useState<MusingHome | null>(null);

  // paint from the last good answer for this person, then refresh in the background.
  // this endpoint is database only, so opening home never costs a muse call.
  useEffect(() => {
    let live = true;
    const key = `musing_home_${userId}`;
    setHome(null);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (live && raw) setHome((h) => h ?? (JSON.parse(raw) as MusingHome));
      })
      .catch(() => {});
    const load = () =>
      apiGet<MusingHome>("/api/musing/home", userId)
        .then((h) => {
          if (!live) return;
          setHome(h);
          void AsyncStorage.setItem(key, JSON.stringify(h));
        })
        .catch(() => {});
    void load();
    return () => {
      live = false;
    };
  }, [userId, version]);
  useTableChanges("plans", () => {
    apiGet<MusingHome>("/api/musing/home", userId)
      .then(setHome)
      .catch(() => {});
  });

  const compose = (thought?: string) => {
    if (thought) setHandoff(thought);
    router.push({ pathname: "/musing", params: { compose: "1" } });
  };
  const state = pick(home);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <MaterialCommunityIcons name="creation" size={15} color={muse.start} />
        <Text style={styles.brand}>{COPY.brand}</Text>
        {!settings.muse_on && <Text style={styles.off}>muse is off · plain poll</Text>}
      </View>

      {state ? (
        <>
          <Text style={styles.headline} numberOfLines={2}>
            {state.headline}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            {state.sub}
          </Text>
          <View style={styles.row}>
            <Cta label={state.action} onPress={() => router.push({ pathname: "/musing/[planId]", params: { planId: state.planId } })} />
            <Pressable onPress={() => compose()} hitSlop={8} accessibilityRole="button" accessibilityLabel="start a new thought">
              <Text style={styles.link}>new thought</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.headline}>{COPY.composerPlaceholder}</Text>
          <Text style={styles.sub}>that random thought? let&apos;s make it happen with friends.</Text>
          <View style={styles.row}>
            <Pressable onPress={() => compose()} style={styles.input} accessibilityRole="button" accessibilityLabel="type a thought for muse">
              <Text style={styles.placeholder} numberOfLines={1}>
                lowkey wanna do something this weekend...
              </Text>
            </Pressable>
            <Cta label="make a move" onPress={() => compose()} />
          </View>
          <View style={styles.chips}>
            {CHIPS.map(([label, thought]) => (
              <Pressable key={label} onPress={() => compose(thought)} style={({ pressed }) => [styles.chip, pressed && { backgroundColor: muse.soft }]} accessibilityRole="button" accessibilityLabel={`start with ${label}`}>
                <Text style={styles.chipText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function Cta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      <LinearGradient colors={[fb.blue, muse.start]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
        <Text style={styles.ctaText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginBottom: 12, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e6eb", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 4 },
  brand: { fontSize: 13.5, fontWeight: "800", color: muse.start, letterSpacing: -0.2 },
  off: { fontSize: 12, color: fb.muted, marginLeft: 6 },
  headline: { fontSize: 19, fontWeight: "800", color: fb.text, letterSpacing: -0.3, marginTop: 3, lineHeight: 24 },
  sub: { fontSize: 14, color: fb.muted, lineHeight: 19, marginTop: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  input: { flex: 1, height: 38, borderRadius: 19, backgroundColor: fb.input, justifyContent: "center", paddingHorizontal: 14 },
  placeholder: { fontSize: 14.5, color: fb.muted },
  cta: { height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  link: { fontSize: 14.5, fontWeight: "600", color: fb.blue, paddingHorizontal: 6 },
  chips: { flexDirection: "row", gap: 6, marginTop: 9 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "#e4e6eb", paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { fontSize: 13, fontWeight: "600", color: fb.text },
});
