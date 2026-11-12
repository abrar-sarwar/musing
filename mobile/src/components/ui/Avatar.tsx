import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { fb, museGradient } from "@/constants/theme";
import { avatarFor } from "@/mock/media";
import { hash } from "@/shared/hash";

const PALETTE = ["#1877f2", "#e4405f", "#f7b928", "#45bd62", "#a033ff", "#f02849", "#5b21b6", "#0ea5e9", "#f97316", "#14b8a6"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

type Props = { seed: string; name: string; size?: number; online?: boolean; ring?: boolean; style?: ViewStyle };

// mock avatar: an illustrated face bundled with the app (never a real photo),
// falling back to initials on a deterministic color.
export function Avatar({ seed, name, size = 40, online = false, ring = false, style }: Props) {
  const src = avatarFor(name);
  const color = PALETTE[hash(seed) % PALETTE.length];
  const dot = Math.max(10, Math.round(size * 0.28));
  const inner = (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, overflow: "hidden" }, styles.center]}>
      {src ? <Image source={src} style={{ width: size, height: size }} contentFit="cover" /> : <Text style={{ color: "#fff", fontWeight: "600", fontSize: Math.round(size * 0.38) }}>{initials(name)}</Text>}
    </View>
  );
  return (
    <View style={style}>
      {ring ? <View style={[styles.ring, { borderRadius: size / 2 + 5 }]}>{inner}</View> : inner}
      {online && <View style={{ position: "absolute", right: -1, bottom: -1, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: fb.green, borderWidth: 2, borderColor: "#fff" }} />}
    </View>
  );
}

// muse's own avatar: a small lavender spark. used only inside musing. surfaces.
export function MuseAvatar({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  return (
    <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ width: size, height: size, borderRadius: size / 2 }, styles.center, style]}>
      <MaterialCommunityIcons name="creation" size={Math.round(size * 0.56)} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  ring: { padding: 2, borderWidth: 3, borderColor: fb.blue },
});
