import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MuseAvatar } from "@/components/ui/Avatar";
import { fb, muse } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { usePrefs } from "@/lib/prefs";
import { useQuery } from "@/lib/use-query";
import { COPY } from "@/shared/copy";
import type { Overlap } from "@/shared/types";

type Unit = { title: string; sub: string; action: string; go: () => void };

// one musing. unit in feed, styled like a suggested post. it is driven by real state:
// an ask that reached you, a plan you floated, or a friends overlap. nothing private.
export function MusingFeedUnit() {
  const { userId } = useActingUser();
  const { setHandoff, settings } = usePrefs();
  const router = useRouter();
  const overlap = useQuery(() => apiGet<{ overlap: Overlap }>("/api/overlap", userId).then((r) => r.overlap), [userId]);
  if (!settings.muse_on) return null;

  // asks and plans surface in the home card. this unit is the friends overlap only.
  const unit: Unit | null = overlap.data
    ? {
        title: `${overlap.data.count} of your friends are into ${overlap.data.topic} lately`,
        sub: "want muse to make it a thing? nobody finds out who.",
        action: "make a move",
        go: () => {
          setHandoff(`${overlap.data?.topic} with whoever's into it`);
          router.push({ pathname: "/musing", params: { compose: "1" } });
        },
      }
    : null;
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
