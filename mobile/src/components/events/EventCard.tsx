import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { fb } from "@/constants/theme";
import type { Event, User } from "@/shared/types";

export type EventRow = Event & { host: User };

export function formatEventDate(iso: string | null): string {
  if (!iso) return "Date to be announced";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function EventCard({ event }: { event: EventRow }) {
  const router = useRouter();
  const d = event.starts_at ? new Date(event.starts_at) : null;
  return (
    <Pressable onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}>
      <Card style={styles.card}>
        <View style={styles.date}>
          <Text style={styles.month}>{d ? d.toLocaleDateString(undefined, { month: "short" }).toUpperCase() : "TBA"}</Text>
          <Text style={styles.day}>{d ? d.getDate() : "–"}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.meta}>{formatEventDate(event.starts_at)}</Text>
          {event.location && (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={14} color={fb.muted} />
              <Text style={styles.meta} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          )}
          <Text style={styles.meta}>Hosted by {event.host.name}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={fb.muted} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  date: { width: 52, height: 56, borderRadius: 8, backgroundColor: fb.input, alignItems: "center", justifyContent: "center" },
  month: { fontSize: 11, fontWeight: "700", color: fb.red },
  day: { fontSize: 22, fontWeight: "700", color: fb.text, lineHeight: 26 },
  title: { fontSize: 16, fontWeight: "600", color: fb.text },
  meta: { fontSize: 13, color: fb.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
});
