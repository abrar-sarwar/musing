import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fb } from "@/constants/theme";

// pushed screens (messages, event detail, plan): back arrow + title
export function SubScreen({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" accessibilityRole="button" style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={fb.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  bar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: fb.divider,
    backgroundColor: "#fff",
  },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 17, fontWeight: "600", color: fb.text },
  right: { minWidth: 36, alignItems: "flex-end" },
  body: { flex: 1, backgroundColor: fb.bg },
});
