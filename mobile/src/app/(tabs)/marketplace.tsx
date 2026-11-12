import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FbHeader } from "@/components/facebook/FbHeader";
import { FbScreen } from "@/components/facebook/FbScreen";
import { fb, TAB_BAR_SPACE } from "@/constants/theme";
import { useToast } from "@/lib/toast";
import { JOBS, LISTINGS, MARKET_TABS, SERVICES, type Listing } from "@/mock/data";

type Tab = (typeof MARKET_TABS)[number];
const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function MarketplaceScreen() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Explore");

  const items = tab === "Local" ? LISTINGS.filter((l) => l.nearby) : tab === "More" ? [...LISTINGS].reverse() : LISTINGS;
  const rows = tab === "Jobs" ? JOBS : tab === "Services" ? SERVICES : null;

  return (
    <FbScreen>
      <FbHeader title="Marketplace" actions={["messenger", "search", "more"]} />
      <View style={styles.tabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {MARKET_TABS.map((t) => (
            <Pressable key={t} onPress={() => (t === "Sell" ? toast("Listing an item is mocked in this prototype.") : setTab(t))} style={[styles.tab, tab === t && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text style={[styles.tabText, tab === t && { color: fb.blue }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable onPress={() => toast("Atlanta, Georgia · within 40 miles. Mock location.")} hitSlop={8} style={styles.pin} accessibilityLabel="Location">
          <MaterialCommunityIcons name="map-marker" size={26} color={fb.text} />
        </Pressable>
      </View>

      {rows ? (
        <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
          {rows.map((r) => (
            <Pressable key={r.id} onPress={() => toast("Mock listing. Nothing to apply to or book.")} style={({ pressed }) => [styles.row, pressed && { backgroundColor: fb.hover }]}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={tab === "Jobs" ? "briefcase-outline" : "hammer-wrench"} size={22} color={fb.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowSub}>
                  {r.who} · {r.pay}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          key={tab}
          data={items}
          numColumns={2}
          keyExtractor={(l) => l.id}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <Tile item={item} onPress={() => router.push({ pathname: "/marketplace/[id]", params: { id: item.id } })} />}
        />
      )}
    </FbScreen>
  );
}

// dense two-column tile: near-square image, then "price · title" on one line.
function Tile({ item, onPress }: { item: Listing; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tile} accessibilityRole="button" accessibilityLabel={`${item.title}, ${money(item.price)}`}>
      <View>
        <Image source={item.image} style={styles.image} contentFit="cover" />
        {item.nearby && (
          <View style={styles.nearby}>
            <Text style={styles.nearbyText}>Nearby</Text>
          </View>
        )}
      </View>
      <Text style={styles.caption} numberOfLines={1}>
        <Text style={styles.price}>{money(item.price)}</Text>
        {item.was ? <Text style={styles.was}> {money(item.was)}</Text> : null}
        <Text> · {item.title}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabsRow: { flexDirection: "row", alignItems: "center", paddingBottom: 8 },
  tabs: { paddingHorizontal: 10, gap: 2, alignItems: "center" },
  tab: { paddingHorizontal: 14, height: 38, borderRadius: 19, justifyContent: "center" },
  tabOn: { backgroundColor: fb.blueSoft },
  tabText: { fontSize: 16, fontWeight: "600", color: fb.text },
  pin: { paddingHorizontal: 12 },
  tile: { flex: 1, maxWidth: "50%", paddingBottom: 10 },
  image: { width: "100%", aspectRatio: 1 },
  nearby: { position: "absolute", top: 8, left: 8, backgroundColor: "#fff", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  nearbyText: { fontSize: 12.5, fontWeight: "500", color: fb.text },
  caption: { fontSize: 15.5, color: fb.text, paddingHorizontal: 8, paddingTop: 8 },
  price: { fontWeight: "500" },
  was: { color: fb.muted, textDecorationLine: "line-through" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: fb.input, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 16, fontWeight: "600", color: fb.text },
  rowSub: { fontSize: 14, color: fb.muted, marginTop: 1 },
});
