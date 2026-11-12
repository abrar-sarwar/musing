import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fb } from "@/constants/theme";

// tab screen frame: safe top, then whatever header the screen renders itself.
// content scrolls under the floating tab bar, so lists add TAB_BAR_SPACE at the bottom.
export function FbScreen({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, dark && { backgroundColor: "#000" }]}>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: fb.bg },
  body: { flex: 1 },
});
