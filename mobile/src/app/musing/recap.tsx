import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GradientButton } from "@/components/musing/GradientButton";
import { SubScreen } from "@/components/shell/SubScreen";
import { Avatar, MuseAvatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { fb, muse, museGradient } from "@/constants/theme";
import { usePrefs } from "@/lib/prefs";
import { COPY } from "@/shared/copy";

const CREW = ["Maya Okafor", "Alex Rivera", "Jo Lindqvist"];

// recap post. a static preview of what lands in feed after a plan, with "run it back".
export default function RecapPreview() {
  const router = useRouter();
  const { setHandoff } = usePrefs();
  return (
    <SubScreen title="recap post">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.note}>static preview of the feed post muse drafts after a plan. it only posts if everyone in it says yes.</Text>
        <Card>
          <View style={styles.header}>
            <MuseAvatar size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>Maya Okafor is with Alex Rivera and Jo Lindqvist</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>2h · </Text>
                <Ionicons name="people" size={12} color={fb.muted} />
                <Text style={styles.meta}> · made with musing.</Text>
              </View>
            </View>
          </View>
          <Text style={styles.body}>thrift run happened. three people, two shops, one very good jacket.</Text>
          <LinearGradient colors={[...museGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.photo}>
            <Ionicons name="shirt-outline" size={56} color="rgba(255,255,255,0.9)" />
            <Text style={styles.photoText}>photos the group picked go here</Text>
          </LinearGradient>
          <View style={styles.crew}>
            {CREW.map((n, i) => (
              <Avatar key={n} seed={n} name={n} size={28} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: "#fff" }} />
            ))}
            <Text style={styles.crewText}>started as one vague thought</Text>
          </View>
          <View style={styles.cta}>
            <GradientButton
              label={COPY.runItBack}
              icon="refresh"
              onPress={() => {
                setHandoff("thrift run again sometime soon");
                router.navigate("/musing");
              }}
            />
          </View>
        </Card>
      </ScrollView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, color: fb.muted, lineHeight: 18, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  name: { fontSize: 15, fontWeight: "600", color: fb.text, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { fontSize: 13, color: fb.muted },
  body: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, lineHeight: 20, color: fb.text },
  photo: { aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center", gap: 8 },
  photoText: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  crew: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12 },
  crewText: { marginLeft: 8, fontSize: 13, color: muse.text, fontWeight: "600" },
  cta: { padding: 12, alignItems: "flex-start" },
});
