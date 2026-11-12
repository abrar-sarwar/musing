import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { useToast } from "@/lib/toast";
import { LISTINGS } from "@/mock/data";

// lightweight product detail. mock data, no payments, no real sellers.
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { users } = useActingUser();
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const item = LISTINGS.find((l) => l.id === id);
  const seller = users.find((u) => u.id === item?.seller);

  if (!item) {
    return (
      <SubScreen title="Marketplace">
        <Text style={styles.gone}>This listing isn&apos;t available.</Text>
      </SubScreen>
    );
  }
  const more = LISTINGS.filter((l) => l.category === item.category && l.id !== item.id).slice(0, 4);

  return (
    <SubScreen title="Marketplace">
      <ScrollView style={{ backgroundColor: "#fff" }} contentContainerStyle={{ paddingBottom: 40 }}>
        <Image source={item.image} style={styles.hero} contentFit="cover" />
        <View style={styles.pad}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>
            ${item.price.toLocaleString("en-US")}
            {item.was ? <Text style={styles.was}>  ${item.was.toLocaleString("en-US")}</Text> : null}
          </Text>
          <Text style={styles.meta}>
            Listed in {item.place} · {item.category}
          </Text>
          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.primary]} onPress={() => toast("Message sent to the seller. Mock only.")} accessibilityRole="button">
              <MaterialCommunityIcons name="facebook-messenger" size={19} color="#fff" />
              <Text style={styles.primaryText}>Message</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setSaved((s) => !s)} accessibilityRole="button" accessibilityState={{ selected: saved }}>
              <MaterialCommunityIcons name={saved ? "bookmark" : "bookmark-outline"} size={19} color={fb.text} />
              <Text style={styles.btnText}>{saved ? "Saved" : "Save"}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => toast("Sharing is mocked in this prototype.")} accessibilityRole="button">
              <MaterialCommunityIcons name="share-outline" size={19} color={fb.text} />
              <Text style={styles.btnText}>Share</Text>
            </Pressable>
          </View>
          <Text style={styles.h}>Description</Text>
          <Text style={styles.body}>{item.about}</Text>
          <Text style={styles.h}>Seller information</Text>
          {seller && (
            <Pressable style={styles.seller} onPress={() => router.push({ pathname: "/people/[id]", params: { id: seller.id } })}>
              <Avatar seed={seller.avatar_seed} name={seller.name} size={48} />
              <View>
                <Text style={styles.sellerName}>{seller.name}</Text>
                <Text style={styles.meta}>Joined Facebook in 2019 · mock profile</Text>
              </View>
            </Pressable>
          )}
          {more.length > 0 && <Text style={styles.h}>More like this</Text>}
        </View>
        <View style={styles.more}>
          {more.map((m) => (
            <Pressable key={m.id} style={styles.moreTile} onPress={() => router.replace({ pathname: "/marketplace/[id]", params: { id: m.id } })}>
              <Image source={m.image} style={styles.moreImage} contentFit="cover" />
              <Text style={styles.moreText} numberOfLines={1}>
                ${m.price.toLocaleString("en-US")} · {m.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  gone: { padding: 24, color: fb.muted, textAlign: "center" },
  hero: { width: "100%", aspectRatio: 1 },
  pad: { padding: 14, gap: 4 },
  title: { fontSize: 22, fontWeight: "700", color: fb.text },
  price: { fontSize: 19, fontWeight: "600", color: fb.text },
  was: { color: fb.muted, textDecorationLine: "line-through", fontWeight: "400" },
  meta: { fontSize: 14, color: fb.muted },
  buttons: { flexDirection: "row", gap: 8, marginVertical: 10 },
  btn: { flex: 1, height: 40, borderRadius: 8, backgroundColor: fb.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  primary: { backgroundColor: fb.blue, flex: 1.4 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnText: { color: fb.text, fontWeight: "600", fontSize: 15 },
  h: { fontSize: 18, fontWeight: "700", color: fb.text, marginTop: 12, marginBottom: 2 },
  body: { fontSize: 16, lineHeight: 22, color: fb.text },
  seller: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  sellerName: { fontSize: 16, fontWeight: "600", color: fb.text },
  more: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  moreTile: { width: "49.4%" },
  moreImage: { width: "100%", aspectRatio: 1 },
  moreText: { fontSize: 14.5, color: fb.text, padding: 8 },
});
