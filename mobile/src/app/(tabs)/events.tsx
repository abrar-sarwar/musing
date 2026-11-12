import { FlatList, StyleSheet, Text, View } from "react-native";
import { EventCard, type EventRow } from "@/components/events/EventCard";
import { Screen } from "@/components/shell/Screen";
import { fb } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";

export default function EventsScreen() {
  const events = useQuery(async () => {
    const { data, error } = await supabase.from("events").select("*, host:users!events_host_id_fkey(*)").order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data as unknown as EventRow[];
  });
  return (
    <Screen>
      <FlatList
        data={events.data ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventCard event={item} />}
        ListHeaderComponent={<Text style={styles.heading}>Upcoming</Text>}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={styles.empty}>{events.error ?? (events.loading ? "Loading…" : "No events yet.")}</Text>}
        refreshing={events.loading}
        onRefresh={events.reload}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "700", color: fb.text, paddingHorizontal: 12, paddingVertical: 12 },
  empty: { color: fb.muted, textAlign: "center", padding: 24 },
});
