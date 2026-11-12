import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";
import { fb } from "@/constants/theme";

type Props = {
  name: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
  size?: number;
  label: string;
};

export function IconCircle({ name, onPress, size = 36, label }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.circle, { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={name} size={Math.round(size * 0.55)} color={fb.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: fb.input, alignItems: "center", justifyContent: "center" },
});
