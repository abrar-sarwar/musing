import { StyleSheet, Text, View } from "react-native";
import { fb } from "@/constants/theme";
import { usePrefs } from "@/lib/prefs";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { useTableChanges } from "@/lib/use-realtime";
import type { MuseTrace } from "@/shared/types";

const COLORS: Record<string, string> = { understand: "#0ea5e9", match: "#7c3aed", coordinate: "#ec4899", create: "#16a34a", suggest: "#f59e0b" };

// what muse actually did, step by step. live from the muse_trace table.
// summaries are written server side and never contain a private limit.
export function TracePanel({ planId }: { planId?: string }) {
  const { traceOn } = usePrefs();
  const q = useQuery(async () => {
    if (!traceOn) return [] as MuseTrace[];
    const { data, error } = await supabase.from("muse_trace").select("*").order("id", { ascending: false }).limit(planId ? 40 : 8);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as MuseTrace[];
    return planId ? rows.filter((r) => r.plan_id === planId || r.plan_id === null).slice(0, 8) : rows;
  }, [traceOn, planId]);
  useTableChanges("muse_trace", () => void q.reload());
  if (!traceOn) return null;
  const rows = q.data ?? [];

  return (
    <View style={styles.panel} accessibilityLabel="muse trace">
      <Text style={styles.title}>muse trace</Text>
      {rows.length === 0 && <Text style={styles.empty}>no muse calls yet.</Text>}
      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={[styles.job, { backgroundColor: COLORS[r.job] ?? fb.muted }]}>
            <Text style={styles.jobText}>{r.job}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summary, !r.ok && { color: "#fca5a5" }]} numberOfLines={2}>
              {r.summary}
            </Text>
            <Text style={styles.meta}>
              {r.model === "cache" ? "replayed from cache" : `${r.model} · ${(r.latency_ms / 1000).toFixed(1)}s`}
              {r.ok ? "" : " · failed"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { margin: 12, borderRadius: 14, backgroundColor: "#16131f", padding: 12, gap: 8 },
  title: { color: "#c4b5fd", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  empty: { color: "#9ca3af", fontSize: 13 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  job: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 78, alignItems: "center" },
  jobText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  summary: { color: "#f3f4f6", fontSize: 13, lineHeight: 17 },
  meta: { color: "#9ca3af", fontSize: 11 },
});
