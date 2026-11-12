import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { LISTINGS } from "@/mock/data";

// search over the mock data: seeded people and marketplace listings.
export default function SearchScreen() {
  const router = useRouter();
  const { users } = useActingUser();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const people = users.filter((u) => term === "" || u.name.toLowerCase().includes(term) || u.interests.some((i) => i.includes(term))).slice(0, term ? 12 : 6);
  const listings = term ? LISTINGS.filter((l) => l.title.toLowerCase().includes(term) || l.category.toLowerCase().includes(term)).slice(0, 8) : [];

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <MaterialCommunityIcons name="chevron-left" size={34} color={fb.text} />
        </Pressable>
        <View style={styles.field}>
          <MaterialCommunityIcons name="magnify" size={20} color={fb.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search Facebook" placeholderTextColor={fb.muted} autoFocus style={styles.input} autoCapitalize="none" returnKeyType="search" />
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.section}>{term ? "People" : "Suggested"}</Text>
        {people.map((u) => (
          <Pressable key={u.id} onPress={() => router.push({ pathname: "/people/[id]", params: { id: u.id } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: fb.hover }]}>
            <Avatar seed={u.avatar_seed} name={u.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{u.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {u.bio}
              </Text>
            </View>
          </Pressable>
        ))}
        {people.length === 0 && <Text style={styles.none}>No people match. This searches mock data only.</Text>}
        {listings.length > 0 && <Text style={styles.section}>Marketplace</Text>}
        {listings.map((l) => (
          <Pressable key={l.id} onPress={() => router.push({ pathname: "/marketplace/[id]", params: { id: l.id } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: fb.hover }]}>
            <Image source={l.image} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{l.title}</Text>
              <Text style={styles.sub}>
                ${l.price.toLocaleString("en-US")} · {l.place}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  bar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingBottom: 8 },
  field: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: fb.input, borderRadius: 20, paddingHorizontal: 12, height: 40, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: fb.text },
  section: { fontSize: 17, fontWeight: "700", color: fb.text, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  name: { fontSize: 16, fontWeight: "600", color: fb.text },
  sub: { fontSize: 13.5, color: fb.muted },
  none: { color: fb.muted, padding: 14 },
});
