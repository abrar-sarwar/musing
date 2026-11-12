import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fb, muse, museGradient } from "@/constants/theme";

// the finished plan, as a card in a messenger thread. payload comes from the create job.
export type PlanCardPayload = {
  type: "plan";
  plan_id: string;
  title: string;
  when: string;
  where: string;
  line: string; // one lowercase line from muse
};

export function PlanMessageCard({ card }: { card: PlanCardPayload }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push({ pathname: "/musing/[planId]", params: { planId: card.plan_id } })}>
      <View style={styles.card}>
        <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.strip} />
        <View style={styles.body}>
          <View style={styles.head}>
            <Ionicons name="sparkles" size={14} color={muse.text} />
            <Text style={styles.kicker}>it&apos;s happening</Text>
          </View>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.meta}>{card.when} · {card.where}</Text>
          <Text style={styles.line}>{card.line}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 260, borderRadius: 14, backgroundColor: "#fff", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: fb.divider },
  strip: { height: 4 },
  body: { padding: 12, gap: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 4 },
  kicker: { color: muse.text, fontSize: 12, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "700", color: fb.text },
  meta: { fontSize: 13, color: fb.muted },
  line: { fontSize: 14, color: fb.text, marginTop: 4 },
});
