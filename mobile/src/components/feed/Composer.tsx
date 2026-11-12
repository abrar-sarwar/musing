import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { fb } from "@/constants/theme";
import { firstName } from "@/shared/time";
import type { User } from "@/shared/types";

// static facebook composer. the musing composer is its own surface.
export function Composer({ me }: { me: User }) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar seed={me.avatar_seed} name={me.name} size={40} />
        <View style={styles.input}>
          <Text style={styles.placeholder}>What&apos;s on your mind, {firstName(me.name)}?</Text>
        </View>
        <Ionicons name="images-outline" size={26} color={fb.green} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: fb.divider, justifyContent: "center", paddingHorizontal: 14 },
  placeholder: { color: fb.muted, fontSize: 16 },
});
