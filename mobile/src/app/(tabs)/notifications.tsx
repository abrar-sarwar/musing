import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { FbHeader } from "@/components/facebook/FbHeader";
import { FbScreen } from "@/components/facebook/FbScreen";
import { Avatar, MuseAvatar } from "@/components/ui/Avatar";
import { fb, muse, TAB_BAR_SPACE } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useQuery } from "@/lib/use-query";
import { useTableChanges } from "@/lib/use-realtime";
import { DATING_PROFILES, NOTIFICATIONS, type MockNotification } from "@/mock/data";
import { firstName } from "@/shared/time";
import type { MusingHome, Person, PlanView } from "@/shared/types";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];
type Part = { t: string; b?: boolean };
type Row = { id: string; parts: Part[]; age: string; unread: boolean; go: () => void; badge: { icon: IconName; color: string }; who: { person: Person } | { muse: true } | { facebook: true } | { image: ImageSource }; thumb?: ImageSource };

const BADGES: Record<MockNotification["kind"], { icon: IconName; color: string }> = {
  love: { icon: "heart", color: "#f3425f" },
  post: { icon: "comment-text", color: fb.blue },
  comment: { icon: "comment", color: "#31a24c" },
  market: { icon: "storefront", color: "#0aa5a5" },
  dating: { icon: "heart-multiple", color: "#7c4dff" },
  security: { icon: "shield-check", color: fb.blue },
  friend: { icon: "calendar-star", color: "#f3425f" },
};
const MUSE_BADGE = { icon: "creation" as IconName, color: muse.start };

function names(people: Person[]): string {
  const n = people.map((p) => firstName(p.name).toLowerCase());
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

// musing. rows, built from what this person is allowed to see. before a plan is
// happening they carry a count, never names.
function musingRows(home: MusingHome | null, meId: string, toPlan: (id: string) => () => void): Row[] {
  if (!home) return [];
  const rows: Row[] = [];
  const add = (p: PlanView, key: string, parts: Part[], who: Row["who"], unread = true) => rows.push({ id: `m-${p.id}-${key}`, parts, age: "now", unread, go: toPlan(p.id), badge: MUSE_BADGE, who });
  for (const p of home.asks) {
    const starter = firstName(p.starter.name).toLowerCase();
    if (p.state === "proposing" && p.me?.status === "pending") add(p, "ask", [{ t: starter, b: true }, { t: " is thinking about " }, { t: p.activity ?? "something", b: true }, { t: `, ${p.when ?? "soon"}. muse thought of you. your answer stays private.` }], { person: p.starter });
    else if (p.state === "happening" && p.me?.status === "down") add(p, "on", [{ t: `${p.activity} with ` }, { t: starter, b: true }, { t: ` is happening. ${p.when ?? ""}.` }], { person: p.starter });
  }
  for (const p of home.mine) {
    if (p.state === "happening") {
      const others = (p.going ?? []).filter((g) => g.id !== meId);
      add(p, "real", [{ t: names(others), b: true }, { t: ` ${others.length === 1 ? "is" : "are"} down for your ` }, { t: p.activity ?? "plan", b: true }, { t: ". it's happening." }], others[0] ? { person: others[0] } : { muse: true });
    } else if (p.state === "proposing") {
      if (p.note && p.version > 1) add(p, `v${p.version}`, [{ t: "muse found a new time that works for everyone: " }, { t: p.when ?? "", b: true }, { t: "." }], { muse: true });
      if (p.downCount > 0) add(p, `c${p.downCount}`, [{ t: `${p.downCount} of ${p.quorum}`, b: true }, { t: ` are in for your ${p.activity} so far. names show once it's on.` }], { muse: true });
    } else if (p.state === "draft") add(p, "draft", [{ t: "muse drafted a plan for " }, { t: p.activity ?? "your thought", b: true }, { t: ". nothing has been sent yet." }], { muse: true }, false);
  }
  return rows;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { userId, users } = useActingUser();
  const [read, setRead] = useState<Record<string, boolean>>({});

  const home = useQuery(() => apiGet<MusingHome>("/api/musing/home", userId), [userId]);
  useTableChanges("plans", () => void home.reload());

  const rows = useMemo<Row[]>(() => {
    const live = musingRows(home.data, userId, (id) => () => router.push({ pathname: "/musing/[planId]", params: { planId: id } }));
    const mock = NOTIFICATIONS.filter((n) => n.from !== userId).map<Row>((n) => {
      const u = users.find((x) => x.id === n.from);
      const date = DATING_PROFILES.find((d) => d.id === n.from);
      return { id: n.id, parts: n.text, age: n.age, unread: n.unread, go: () => router.navigate(n.to), badge: BADGES[n.kind], who: u ? { person: u } : date ? { image: date.image } : { facebook: true }, thumb: n.thumb };
    });
    return [...live, ...mock];
  }, [home.data, userId, users, router]);

  return (
    <FbScreen>
      <FbHeader title="Notifications" actions={["messenger", "search", "more"]} onMore={() => setRead(Object.fromEntries(rows.map((r) => [r.id, true])))} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={<Text style={styles.section}>New</Text>}
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const unread = item.unread && !read[item.id];
          return (
            <Pressable
              onPress={() => {
                setRead((s) => ({ ...s, [item.id]: true }));
                item.go();
              }}
              style={[styles.row, unread && { backgroundColor: fb.unread }]}
              accessibilityRole="button"
            >
              <View>
                {"person" in item.who ? (
                  <Avatar seed={item.who.person.avatar_seed} name={item.who.person.name} size={62} />
                ) : "muse" in item.who ? (
                  <MuseAvatar size={62} />
                ) : "image" in item.who ? (
                  <Image source={item.who.image} style={styles.round} contentFit="cover" />
                ) : (
                  <View style={[styles.round, styles.fbLogo]}>
                    <Text style={styles.fbF}>f</Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: item.badge.color }]}>
                  <MaterialCommunityIcons name={item.badge.icon} size={15} color="#fff" />
                </View>
              </View>
              <Text style={styles.text} numberOfLines={4}>
                {item.parts.map((p, i) => (
                  <Text key={i} style={p.b ? styles.bold : undefined}>
                    {p.t}
                  </Text>
                ))}
                <Text style={styles.age}> {item.age}</Text>
              </Text>
              {item.thumb && <Image source={item.thumb} style={styles.thumb} contentFit="cover" />}
              <Pressable onPress={() => toast("Notification options are mocked in this prototype.")} hitSlop={10} accessibilityLabel="Options" style={styles.more}>
                <MaterialCommunityIcons name="dots-horizontal" size={24} color={fb.text} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </FbScreen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: "700", color: fb.text, paddingHorizontal: 14, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: fb.bg },
  round: { width: 62, height: 62, borderRadius: 31 },
  fbLogo: { backgroundColor: fb.blue, alignItems: "center", justifyContent: "flex-end" },
  fbF: { color: "#fff", fontSize: 52, fontWeight: "800", lineHeight: 58, marginBottom: -6 },
  badge: { position: "absolute", right: -4, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  text: { flex: 1, fontSize: 15.5, lineHeight: 20.5, color: fb.text, paddingTop: 4 },
  bold: { fontWeight: "700" },
  age: { color: fb.muted },
  thumb: { width: 56, height: 44, borderRadius: 6, marginTop: 8 },
  more: { paddingTop: 2 },
});
