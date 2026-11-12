import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { fb, museGradient } from "@/constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type Props = { label: string; onPress?: () => void; disabled?: boolean; busy?: boolean; icon?: IconName; style?: ViewStyle; big?: boolean };

// the musing. primary action. gradient pill.
export function GradientButton({ label, onPress, disabled = false, busy = false, icon, style, big = false }: Props) {
  const off = disabled || busy;
  return (
    <Pressable onPress={off ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: off }} style={({ pressed }) => [style, pressed && !off && { opacity: 0.85 }]}>
      <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, big && styles.big, off && { opacity: 0.45 }]}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : icon ? <Ionicons name={icon} size={big ? 20 : 17} color="#fff" /> : null}
        <Text style={[styles.text, big && { fontSize: 17 }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function QuietButton({ label, onPress, disabled = false, style }: { label: string; onPress?: () => void; disabled?: boolean; style?: ViewStyle }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.quiet, style, pressed && { backgroundColor: fb.divider }, disabled && { opacity: 0.45 }]}>
      <Text style={styles.quietText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, paddingHorizontal: 16, height: 40 },
  big: { height: 50 },
  text: { color: "#fff", fontWeight: "700", fontSize: 15 },
  quiet: { height: 40, borderRadius: 999, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#e4e6eb" },
  quietText: { color: fb.text, fontWeight: "600", fontSize: 15 },
});
