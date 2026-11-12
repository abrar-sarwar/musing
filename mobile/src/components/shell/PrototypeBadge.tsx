import { StyleSheet, Text, View } from "react-native";
import { fb } from "@/constants/theme";

export function PrototypeBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>hackathon prototype · mock data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: fb.divider,
    backgroundColor: fb.input,
  },
  text: { fontSize: 10, color: fb.muted, fontWeight: "500" },
});
