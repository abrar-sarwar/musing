import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { muse } from "@/constants/theme";
import { usePrefs } from "@/lib/prefs";
import type { Overlap } from "@/shared/types";

// friends overlap: a small contextual card on a reel about something 3 or more
// opted-in friends are also into. it gives a count and never says who.
export function OverlapCard({ overlap, onDismiss }: { overlap: NonNullable<Overlap>; onDismiss: () => void }) {
  const router = useRouter();
  const { setHandoff } = usePrefs();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 9, tension: 60, delay: 500 }).start();
  }, [slide]);

  function makeAMove() {
    setHandoff(`${overlap.topic} with whoever's into it`);
    onDismiss();
    router.push("/musing");
  }

  return (
    <Animated.View style={[styles.card, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
      <View style={styles.spark}>
        <MaterialCommunityIcons name="creation" size={16} color={muse.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          wait... {overlap.count} of your friends are into {overlap.topic} too
        </Text>
        <Pressable onPress={makeAMove} hitSlop={6} accessibilityRole="button" accessibilityLabel="make a move">
          <Text style={styles.action}>make a move</Text>
        </Pressable>
      </View>
      <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="dismiss">
        <MaterialCommunityIcons name="close" size={18} color="#6b6b70" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(250,247,255,0.96)", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  spark: { width: 30, height: 30, borderRadius: 15, backgroundColor: muse.soft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14.5, fontWeight: "600", color: "#1c1e21", lineHeight: 19 },
  action: { fontSize: 14.5, fontWeight: "700", color: muse.text, marginTop: 2 },
});
