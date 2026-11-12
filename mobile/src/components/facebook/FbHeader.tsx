import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fb } from "@/constants/theme";
import { useToast } from "@/lib/toast";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
export type HeaderAction = "create" | "search" | "messenger" | "more" | "assistant";

type Props = {
  /** omit for the home wordmark */
  title?: string;
  actions: HeaderAction[];
  dark?: boolean;
  onCreate?: () => void;
  onMore?: () => void;
};

const ICONS: Record<HeaderAction, IconName> = {
  create: "plus-box-outline",
  search: "magnify",
  messenger: "facebook-messenger",
  more: "dots-horizontal-circle-outline",
  assistant: "creation-outline",
};

// the one mobile facebook header. home shows the wordmark, every other tab a big bold title.
export function FbHeader({ title, actions, dark = false, onCreate, onMore }: Props) {
  const router = useRouter();
  const toast = useToast();
  const ink = dark ? "#fff" : fb.text;

  function press(a: HeaderAction) {
    if (a === "messenger") router.push("/messages");
    else if (a === "search") router.push("/search");
    else if (a === "create") onCreate?.();
    else if (a === "more") (onMore ?? (() => toast("Settings for this tab are mocked in the prototype.")))();
    else toast("Your assistant has no new ideas right now. Mock data.");
  }

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => router.push("/menu")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Menu" style={styles.menu}>
        <MaterialCommunityIcons name="menu" size={30} color={ink} />
      </Pressable>
      {title ? <Text style={[styles.title, { color: ink }]}>{title}</Text> : <Text style={styles.wordmark}>facebook</Text>}
      <View style={{ flex: 1 }} />
      {actions.map((a) => (
        <Pressable key={a} onPress={() => press(a)} hitSlop={8} accessibilityRole="button" accessibilityLabel={a} style={styles.action}>
          <MaterialCommunityIcons name={ICONS[a]} size={a === "create" ? 29 : 30} color={ink} />
          {a === "messenger" && (
            <View style={[styles.badge, { borderColor: dark ? "#000" : "#fff" }]}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 52, flexDirection: "row", alignItems: "center", paddingLeft: 12, paddingRight: 10 },
  menu: { marginRight: 6 },
  wordmark: { color: fb.blue, fontSize: 31, fontWeight: "800", letterSpacing: -1.6, marginTop: -3 },
  title: { fontSize: 27, fontWeight: "800", letterSpacing: -0.6 },
  action: { marginLeft: 16 },
  badge: { position: "absolute", top: -5, right: -7, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: fb.badge, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 1.5 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
