import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fb } from "@/constants/theme";
import { TopBar } from "./TopBar";

// tab screen frame: safe top, facebook header, gray content area
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <TopBar />
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  body: { flex: 1, backgroundColor: fb.bg },
});
