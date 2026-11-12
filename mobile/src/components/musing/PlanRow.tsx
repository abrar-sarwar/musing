import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { fb, muse, museGradient } from "@/constants/theme";
import { COPY } from "@/shared/copy";
import { firstName } from "@/shared/time";
import type { PlanView } from "@/shared/types";

export function statusLine(p: PlanView): string {
  if (p.solving) return COPY.solving;
  if (p.state === "draft") return "draft · only you can see this";
  if (p.state === "happening") return COPY.happening;
  if (p.state === "faded") return "didn't land this time";
  const need = Math.max(0, p.quorum - p.downCount);
  if (p.role === "member" && p.me?.status === "down") return need > 0 ? `you're in · ${need} more and it's on` : "you're in";
  return `${p.downCount} of ${p.quorum} in so far`;
}

// one plan in a list. for a friend it leads with the ask, for the starter with the status.
export function PlanRow({ plan }: { plan: PlanView }) {
  const router = useRouter();
  const mine = plan.role === "starter";
  const waitingOnMe = !mine && plan.me?.status === "pending" && plan.state === "proposing";
  return (
    <Pressable onPress={() => router.push({ pathname: "/musing/[planId]", params: { planId: plan.id } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: fb.hover }]} accessibilityRole="button">
      {plan.state === "happening" ? (
        <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </LinearGradient>
      ) : mine ? (
        <View style={[styles.icon, { backgroundColor: muse.soft }]}>
          <Ionicons name="sparkles" size={18} color={muse.text} />
        </View>
      ) : (
        <Avatar seed={plan.starter.avatar_seed} name={plan.starter.name} size={40} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={1}>
          {mine ? plan.activity : `${firstName(plan.starter.name).toLowerCase()} · ${plan.activity}`}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[plan.when, statusLine(plan)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {waitingOnMe ? <View style={styles.dot} /> : <Ionicons name="chevron-forward" size={18} color={fb.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "600", color: fb.text },
  meta: { fontSize: 13, color: fb.muted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: muse.end },
});
