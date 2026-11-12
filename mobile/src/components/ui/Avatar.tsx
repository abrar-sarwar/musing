import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hash } from "@/shared/hash";
import { fb, museGradient } from "@/constants/theme";

const PALETTE = ["#1877f2", "#e4405f", "#f7b928", "#45bd62", "#a033ff", "#f02849", "#5b21b6", "#0ea5e9", "#f97316", "#14b8a6"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

type Props = { seed: string; name: string; size?: number; online?: boolean; style?: ViewStyle };

// placeholder avatar: initials on a deterministic color. no real photos anywhere.
export function Avatar({ seed, name, size = 40, online = false, style }: Props) {
  const color = PALETTE[hash(seed) % PALETTE.length];
  const dot = Math.max(10, Math.round(size * 0.3));
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, styles.center, style]}>
      <Text style={{ color: "#fff", fontWeight: "600", fontSize: Math.round(size * 0.38) }}>{initials(name)}</Text>
      {online && (
        <View
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: fb.green,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        />
      )}
    </View>
  );
}

// muse's own avatar: the gradient sparkle
export function MuseAvatar({ size = 40, style }: { size?: number; style?: ViewStyle }) {
  return (
    <LinearGradient
      colors={[...museGradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styles.center, style]}
    >
      <Ionicons name="sparkles" size={Math.round(size * 0.5)} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
