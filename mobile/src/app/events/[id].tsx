import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { formatEventDate, type EventRow } from "@/components/events/EventCard";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { fb, museGradient } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(async () => {
    const { data, error } = await supabase.from("events").select("*, host:users!events_host_id_fkey(*)").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as EventRow | null;
  }, [id]);
  const ev = q.data;

  return (
    <SubScreen title="Event">
      {ev ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {ev.poster_url ? (
            <Image source={{ uri: ev.poster_url }} style={styles.poster} contentFit="cover" />
          ) : (
            <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.poster, styles.center]}>
              <Ionicons name="calendar" size={48} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          )}
          <Card style={styles.block}>
            <Text style={styles.when}>{formatEventDate(ev.starts_at)}</Text>
            <Text style={styles.title}>{ev.title}</Text>
            <View style={styles.row}>
              <Ionicons name="location-outline" size={18} color={fb.muted} />
              <Text style={styles.meta}>{ev.location ?? "Location to be announced"}</Text>
            </View>
            <View style={styles.row}>
              <Avatar seed={ev.host.avatar_seed} name={ev.host.name} size={24} />
              <Text style={styles.meta}>Hosted by {ev.host.name}</Text>
            </View>
            <View style={styles.buttons}>
              <View style={[styles.btn, styles.btnPrimary]}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Going</Text>
              </View>
              <View style={styles.btn}>
                <Ionicons name="star-outline" size={18} color={fb.text} />
                <Text style={styles.btnText}>Interested</Text>
              </View>
              <View style={styles.btn}>
                <Ionicons name="arrow-redo-outline" size={18} color={fb.text} />
                <Text style={styles.btnText}>Share</Text>
              </View>
            </View>
          </Card>
          {ev.description && (
            <Card style={[styles.block, { marginTop: 8 }]}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.body}>{ev.description}</Text>
            </Card>
          )}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>{q.error ?? (q.loading ? "Loading…" : "Event not found.")}</Text>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  poster: { width: "100%", aspectRatio: 16 / 9 },
  center: { alignItems: "center", justifyContent: "center" },
  block: { padding: 16, gap: 8 },
  when: { color: fb.red, fontWeight: "700", fontSize: 13, textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: "700", color: fb.text },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  meta: { fontSize: 15, color: fb.muted },
  buttons: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 38, borderRadius: 8, backgroundColor: fb.input },
  btnPrimary: { backgroundColor: fb.blue },
  btnText: { fontWeight: "600", color: fb.text, fontSize: 14 },
  btnPrimaryText: { fontWeight: "600", color: "#fff", fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: fb.text },
  body: { fontSize: 15, lineHeight: 21, color: fb.text },
  empty: { color: fb.muted, textAlign: "center", padding: 24 },
});
