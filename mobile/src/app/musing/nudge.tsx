import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { SubScreen } from "@/components/shell/SubScreen";
import { MuseAvatar } from "@/components/ui/Avatar";
import { fb } from "@/constants/theme";

// day-of nudge. a static preview of the one notification musing. sends.
export default function NudgePreview() {
  return (
    <SubScreen title="day-of nudge">
      <LinearGradient colors={["#1f1147", "#4c1d95", "#9d174d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lock}>
        <Text style={styles.date}>Sunday, November 15</Text>
        <Text style={styles.clock}>10:30</Text>
        <View style={styles.notif}>
          <MuseAvatar size={38} />
          <View style={{ flex: 1 }}>
            <View style={styles.notifHead}>
              <Text style={styles.app}>musing.</Text>
              <Text style={styles.time}>now</Text>
            </View>
            <Text style={styles.title}>thrift run is today</Text>
            <Text style={styles.body}>around 1, downtown. three of you are in. no need to reply.</Text>
          </View>
        </View>
      </LinearGradient>
      <View style={styles.notes}>
        <Text style={styles.note}>one nudge, the morning of. it never asks you to confirm again and never follows up.</Text>
        <Text style={styles.note}>static preview. notifications aren&apos;t sent in this prototype.</Text>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  lock: { margin: 12, borderRadius: 28, paddingTop: 36, paddingHorizontal: 14, paddingBottom: 150, alignItems: "center" },
  date: { color: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: "600" },
  clock: { color: "#fff", fontSize: 84, fontWeight: "700", letterSpacing: -2, marginBottom: 28 },
  notif: { flexDirection: "row", gap: 10, backgroundColor: "rgba(255,255,255,0.88)", borderRadius: 22, padding: 12, alignSelf: "stretch", alignItems: "center" },
  notifHead: { flexDirection: "row", justifyContent: "space-between" },
  app: { fontSize: 13, fontWeight: "600", color: "#3c3c43" },
  time: { fontSize: 13, color: "#6b6b70" },
  title: { fontSize: 15, fontWeight: "700", color: "#000" },
  body: { fontSize: 15, color: "#000", lineHeight: 20 },
  notes: { paddingHorizontal: 16, gap: 6 },
  note: { fontSize: 13, color: fb.muted, lineHeight: 18 },
});
