import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { museGradient } from "@/constants/theme";
import { usePrefs } from "@/lib/prefs";
import type { Overlap } from "@/shared/types";

// friends overlap: slides in over reels when 3 or more opted-in friends are into the
// same thing lately. it says how many, never who.
export function OverlapCard({ overlap, onDismiss }: { overlap: NonNullable<Overlap>; onDismiss: () => void }) {
  const router = useRouter();
  const { setHandoff } = usePrefs();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 9, tension: 60 }).start();
  }, [slide]);

  function makeItAThing() {
    setHandoff(`${overlap.topic} with whoever's into it`);
    onDismiss();
    router.navigate("/musing");
  }

  return (
    <Animated.View style={[styles.wrap, { opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [140, 0] }) }] }]}>
      <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.head}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <Text style={styles.kicker}>musing.</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="dismiss">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.title}>
          {overlap.count} of your friends are into {overlap.topic} lately.
        </Text>
        <Text style={styles.sub}>want muse to make it a thing? nobody finds out who.</Text>
        <Pressable onPress={makeItAThing} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={styles.btnText}>make it a thing</Text>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, bottom: 16 },
  card: { borderRadius: 18, padding: 16, gap: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  head: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: { color: "#fff", fontSize: 12, fontWeight: "800" },
  title: { color: "#fff", fontSize: 19, fontWeight: "800", lineHeight: 24 },
  sub: { color: "rgba(255,255,255,0.9)", fontSize: 14 },
  btn: { marginTop: 6, backgroundColor: "#fff", borderRadius: 999, height: 40, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#7c3aed", fontWeight: "700", fontSize: 15 },
});
