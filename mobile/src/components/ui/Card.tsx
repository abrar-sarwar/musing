import { StyleSheet, View, type ViewProps } from "react-native";
import { fb } from "@/constants/theme";

// white card, edge to edge like the facebook ios feed
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: fb.card },
});
