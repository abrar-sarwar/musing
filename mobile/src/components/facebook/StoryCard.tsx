import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import type { User } from "@/shared/types";

export const STORY_W = 118;
export const STORY_H = 200;

// one tall story tile: media, ringed avatar top left, name over a dark gradient.
export function StoryCard({ user, media, label, seen = false, onPress }: { user: User; media: ImageSource; label: string; seen?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={`${label} story`}>
      <Image source={media} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(0,0,0,0.25)", "transparent", "rgba(0,0,0,0.6)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.ring, seen && { borderColor: "rgba(255,255,255,0.7)" }]}>
        <Avatar seed={user.avatar_seed} name={user.name} size={34} />
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: STORY_W, height: STORY_H, borderRadius: 14, overflow: "hidden", backgroundColor: "#ddd", justifyContent: "space-between", padding: 8 },
  ring: { alignSelf: "flex-start", borderRadius: 22, borderWidth: 3, borderColor: "#0866ff", padding: 1.5, backgroundColor: "rgba(255,255,255,0.9)" },
  name: { color: "#fff", fontSize: 13.5, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 3 },
});
