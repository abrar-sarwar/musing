import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { SubScreen } from "@/components/shell/SubScreen";
import { fb } from "@/constants/theme";

// the plan card. filled in with the mix step.
export default function PlanScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  return (
    <SubScreen title="plan">
      <Text style={styles.text}>plan {planId}</Text>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  text: { padding: 16, color: fb.muted },
});
