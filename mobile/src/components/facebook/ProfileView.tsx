import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedPost, type FeedItem } from "@/components/facebook/FeedPost";
import { Avatar } from "@/components/ui/Avatar";
import { fb, TAB_BAR_SPACE } from "@/constants/theme";
import { useActingUser } from "@/lib/acting-user";
import { apiGet } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useQuery } from "@/lib/use-query";
import { DEFAULT_PROFILE, EXTRA_POSTS, POST_EXTRAS, PROFILE, PROFILE_PHOTOS } from "@/mock/data";
import { reelPoster } from "@/mock/media";
import type { MusingHome, Post, User } from "@/shared/types";

const TABS = ["All", "Photos", "Reels", "Memories"] as const;
type Tab = (typeof TABS)[number];
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

// a personal facebook profile: cover, overlapping avatar, identity, actions, tabs.
// `self` is the acting user's own profile (the profile tab); otherwise a friend's.
export function ProfileView({ user, self }: { user: User; self: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { users, userId, openSwitcher } = useActingUser();
  const [tab, setTab] = useState<Tab>("All");
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user.bio ?? "");
  const [draftBio, setDraftBio] = useState(bio);
  const info = PROFILE[user.id] ?? DEFAULT_PROFILE;

  const data = useQuery(async () => {
    const [{ data: edges }, { data: posts }, { data: topics }] = await Promise.all([
      supabase.from("friendships").select("friend_id").eq("user_id", user.id),
      supabase.from("posts").select("*").eq("author_id", user.id).order("created_at", { ascending: false }),
      supabase.from("reels_topics").select("topic").eq("user_id", user.id).order("score", { ascending: false }),
    ]);
    return { friendIds: (edges ?? []).map((e) => e.friend_id as string), posts: (posts ?? []) as Post[], topics: (topics ?? []).map((t) => t.topic as string) };
  }, [user.id]);
  // a finished musing. plan shows up as ordinary profile activity. own profile only.
  const home = useQuery(() => (self ? apiGet<MusingHome>("/api/musing/home", userId) : Promise.resolve(null)), [self, userId]);
  const real = home.data?.mine.find((p) => p.state === "happening");

  const friends = useMemo(() => users.filter((u) => data.data?.friendIds.includes(u.id)), [users, data.data]);
  const posts = useMemo<FeedItem[]>(() => {
    const seeded = (data.data?.posts ?? []).map((p) => ({ id: p.id, author: user, body: p.body, created_at: p.created_at, ...POST_EXTRAS[p.author_id] }));
    const extra = EXTRA_POSTS.filter((p) => p.author_id === user.id).map((p) => ({ id: p.id, author: user, body: p.body, created_at: new Date(Date.now() - p.hoursAgo * 3600_000).toISOString(), image: p.image, ratio: p.ratio }));
    const own: FeedItem[] = user.id === "maya" ? [{ id: "p-maya-film", author: user, body: "First roll back from the lab. The light leak is a feature.", created_at: new Date(Date.now() - 50 * 3600_000).toISOString(), image: PROFILE_PHOTOS[0], ratio: 1 }] : [];
    return [...seeded, ...extra, ...own];
  }, [data.data, user]);

  const photos = (
    <View style={styles.grid}>
      {PROFILE_PHOTOS.map((p, i) => (
        <Image key={i} source={p} style={styles.gridCell} contentFit="cover" />
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: fb.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} showsVerticalScrollIndicator={false}>
        <View>
          <Image source={info.cover} style={{ width: "100%", height: 250 + insets.top }} contentFit="cover" />
          <View style={[styles.coverBar, { top: insets.top + 6 }]}>
            <Pressable onPress={() => (self ? router.push("/menu") : router.back())} hitSlop={10} accessibilityLabel={self ? "Menu" : "Back"}>
              <MaterialCommunityIcons name={self ? "menu" : "chevron-left"} size={self ? 30 : 36} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }} />
            {self && (
              <Pressable onPress={() => toast("Cover photo editing is mocked in this prototype.")} hitSlop={8} accessibilityLabel="Edit cover">
                <MaterialCommunityIcons name="pencil-outline" size={27} color="#fff" />
              </Pressable>
            )}
            <Pressable onPress={() => router.push("/search")} hitSlop={8} accessibilityLabel="Search">
              <MaterialCommunityIcons name="magnify" size={29} color="#fff" />
            </Pressable>
            <Pressable onPress={() => toast("Profile settings are mocked in this prototype.")} hitSlop={8} accessibilityLabel="More">
              <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={29} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarBorder}>
              <Avatar seed={user.avatar_seed} name={user.name} size={178} />
            </View>
            {self && (
              <Pressable onPress={() => toast("Profile photo editing is mocked in this prototype.")} style={styles.camera} accessibilityLabel="Change profile photo">
                <MaterialCommunityIcons name="camera" size={20} color={fb.text} />
              </Pressable>
            )}
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color={fb.text} />
            {self && (
              <Pressable onPress={openSwitcher} style={styles.switch} accessibilityRole="button" accessibilityLabel="Switch account">
                <MaterialCommunityIcons name="chevron-down" size={26} color={fb.text} />
              </Pressable>
            )}
          </View>
          <Text style={styles.count}>{friends.length} friends</Text>
          {bio ? <Text style={styles.bio}>{bio}</Text> : null}
          <View style={styles.facts}>
            <MaterialCommunityIcons name="map-marker" size={17} color={fb.text} />
            <Text style={styles.fact}>{info.city.split(",")[0]}, GA · </Text>
            <MaterialCommunityIcons name="school" size={17} color={fb.text} />
            <Text style={styles.fact} numberOfLines={1}>
              {info.school}
            </Text>
          </View>

          <View style={styles.common}>
            {friends.slice(0, 3).map((f, i) => (
              <Avatar key={f.id} seed={f.avatar_seed} name={f.name} size={36} style={{ marginLeft: i === 0 ? 0 : -10, borderWidth: 2, borderColor: "#fff", borderRadius: 20 }} />
            ))}
            <Text style={styles.commonText}>{self ? "Friends with things in common" : `${Math.min(friends.length, 4)} mutual friends`}</Text>
          </View>

          <View style={styles.buttons}>
            {self ? (
              <>
                <Btn primary icon="plus-circle-outline" label="Add to story" onPress={() => toast("Added to your story. Mock only.")} />
                <Btn icon="pencil" label="Edit profile" onPress={() => { setDraftBio(bio); setEditing(true); }} />
              </>
            ) : (
              <>
                <Btn primary icon="account-check" label="Friends" onPress={() => toast("You're already friends in the mock data.")} />
                <Btn icon="facebook-messenger" label="Message" onPress={() => router.push("/messages")} />
              </>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
                <Text style={[styles.tabText, tab === t && { color: fb.blue }]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {tab === "All" && (
          <>
            <Section title="Personal details" onEdit={self ? () => toast("Editing details is mocked in this prototype.") : undefined}>
              <Detail icon="map-marker-outline" text={info.city} />
              <Detail icon="cake-variant-outline" text={info.birthday} />
            </Section>
            <Section title="Education" onEdit={self ? () => toast("Editing education is mocked in this prototype.") : undefined}>
              <View style={styles.detail}>
                <View style={styles.schoolLogo}>
                  <MaterialCommunityIcons name="school" size={22} color="#fff" />
                </View>
                <View>
                  <Text style={styles.detailText}>{info.school}</Text>
                  <Text style={styles.sub}>Started August 2022</Text>
                </View>
              </View>
            </Section>
            <Section title="Friends" right={`${friends.length} friends`}>
              <View style={styles.friendGrid}>
                {friends.slice(0, 6).map((f) => (
                  <Pressable key={f.id} style={styles.friend} onPress={() => router.push({ pathname: "/people/[id]", params: { id: f.id } })}>
                    <Avatar seed={f.avatar_seed} name={f.name} size={104} style={styles.friendPic} />
                    <Text style={styles.friendName} numberOfLines={1}>
                      {f.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>
            <Section title="Photos">{photos}</Section>
            <View style={styles.band} />
            <Text style={styles.postsTitle}>Posts</Text>
            {real && (
              <Pressable onPress={() => (real.eventId ? router.push({ pathname: "/events/[id]", params: { id: real.eventId } }) : undefined)} style={styles.activity}>
                <Avatar seed={user.avatar_seed} name={user.name} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityText}>
                    <Text style={{ fontWeight: "700" }}>{user.name}</Text> is going to an event with {Math.max((real.going?.length ?? 1) - 1, 0)} friends.
                  </Text>
                  <Text style={styles.sub}>
                    {real.activity} · {real.when} · made with musing.
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={fb.muted} />
              </Pressable>
            )}
            {posts.map((p) => (
              <View key={p.id}>
                <View style={styles.band} />
                <FeedPost post={p} />
              </View>
            ))}
            {posts.length === 0 && !real && <Text style={styles.empty}>No posts yet.</Text>}
          </>
        )}
        {tab === "Photos" && <View style={{ paddingTop: 8 }}>{photos}</View>}
        {tab === "Reels" && (
          <View style={[styles.grid, { paddingTop: 8 }]}>
            {(data.data?.topics ?? []).map((t, i) => (
              <Pressable key={t} onPress={() => router.navigate("/reels")} style={styles.reelCell}>
                <Image source={reelPoster(t, i)} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Text style={styles.reelTag}>#{t.replace(/\s+/g, "")}</Text>
              </Pressable>
            ))}
            {(data.data?.topics ?? []).length === 0 && <Text style={styles.empty}>No reels yet.</Text>}
          </View>
        )}
        {tab === "Memories" && (
          <View style={styles.memory}>
            <Text style={styles.memoryKicker}>On this day, 1 year ago</Text>
            <Image source={PROFILE_PHOTOS[3]} style={styles.memoryImage} contentFit="cover" />
            <Text style={styles.memoryText}>Golden hour at the reservoir with the whole crew.</Text>
            <Pressable onPress={() => toast("Sharing memories is mocked in this prototype.")} style={styles.memoryBtn}>
              <Text style={styles.memoryBtnText}>Share</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.editBar}>
            <Pressable onPress={() => setEditing(false)} hitSlop={10}>
              <Text style={styles.editCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.editTitle}>Edit profile</Text>
            <Pressable onPress={() => { setBio(draftBio.trim()); setEditing(false); toast("Saved on this device. Mock only."); }} hitSlop={10}>
              <Text style={styles.editSave}>Save</Text>
            </Pressable>
          </View>
          <View style={{ alignItems: "center", padding: 20 }}>
            <Avatar seed={user.avatar_seed} name={user.name} size={120} />
          </View>
          <Text style={styles.editLabel}>Bio</Text>
          <TextInput value={draftBio} onChangeText={setDraftBio} multiline maxLength={101} placeholder="Describe yourself" placeholderTextColor={fb.muted} style={styles.editInput} />
          <Text style={styles.editNote}>Prototype only. Changes stay on this device and reset with the demo.</Text>
        </View>
      </Modal>
    </View>
  );
}

function Btn({ label, icon, onPress, primary = false }: { label: string; icon: IconName; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btn, primary && { backgroundColor: fb.blue }, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialCommunityIcons name={icon} size={20} color={primary ? "#fff" : fb.text} />
      <Text style={[styles.btnText, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children, onEdit, right }: { title: string; children: React.ReactNode; onEdit?: () => void; right?: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
        {onEdit && (
          <Pressable onPress={onEdit} hitSlop={10} accessibilityLabel={`Edit ${title}`}>
            <MaterialCommunityIcons name="pencil-outline" size={24} color={fb.muted} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function Detail({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>
        <MaterialCommunityIcons name={icon} size={28} color={fb.text} />
      </View>
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  coverBar: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 18 },
  sheet: { marginTop: -34, backgroundColor: fb.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, alignItems: "center", paddingBottom: 6 },
  avatarWrap: { marginTop: -112 },
  avatarBorder: { borderRadius: 100, borderWidth: 5, borderColor: "#fff", backgroundColor: "#fff" },
  camera: { position: "absolute", right: 6, bottom: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: fb.button, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "stretch", justifyContent: "center" },
  name: { fontSize: 25, fontWeight: "800", color: fb.text, letterSpacing: -0.4 },
  switch: { position: "absolute", right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: fb.button, alignItems: "center", justifyContent: "center" },
  count: { fontSize: 15.5, fontWeight: "700", color: fb.text, marginTop: 4 },
  bio: { fontSize: 15, color: fb.text, textAlign: "center", paddingHorizontal: 30, marginTop: 8, lineHeight: 20 },
  facts: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 14, paddingHorizontal: 14 },
  fact: { fontSize: 15, fontWeight: "700", color: fb.text, flexShrink: 1 },
  common: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingHorizontal: 14, marginTop: 14 },
  commonText: { fontSize: 15, color: fb.text, marginLeft: 8 },
  buttons: { flexDirection: "row", gap: 10, alignSelf: "stretch", paddingHorizontal: 14, marginTop: 14 },
  btn: { flex: 1, height: 42, borderRadius: 8, backgroundColor: fb.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  btnText: { fontSize: 16, fontWeight: "700", color: fb.text },
  tabs: { paddingHorizontal: 14, gap: 6, paddingTop: 16, paddingBottom: 4 },
  tab: { height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: "center" },
  tabOn: { backgroundColor: fb.blueSoft },
  tabText: { fontSize: 17, fontWeight: "600", color: fb.text },
  section: { paddingHorizontal: 14, paddingTop: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sectionTitle: { flex: 1, fontSize: 19, fontWeight: "700", color: fb.text },
  sectionRight: { fontSize: 15, color: fb.muted },
  detail: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 9 },
  detailIcon: { width: 46, alignItems: "center" },
  detailText: { fontSize: 17, fontWeight: "600", color: fb.text },
  sub: { fontSize: 14, color: fb.muted, marginTop: 1 },
  schoolLogo: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#12379b", alignItems: "center", justifyContent: "center" },
  friendGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  friend: { width: "31%" },
  friendPic: { borderRadius: 10, overflow: "hidden", alignSelf: "center" },
  friendName: { fontSize: 14, fontWeight: "600", color: fb.text, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  gridCell: { width: "32.7%", aspectRatio: 1 },
  reelCell: { width: "32.7%", aspectRatio: 9 / 16, justifyContent: "flex-end", backgroundColor: "#111" },
  reelTag: { color: "#fff", fontWeight: "700", fontSize: 13, padding: 6, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 4 },
  band: { height: 5, backgroundColor: "#c9ccd1", marginTop: 14 },
  postsTitle: { fontSize: 19, fontWeight: "700", color: fb.text, paddingHorizontal: 14, paddingTop: 14 },
  activity: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 12 },
  activityText: { fontSize: 15.5, color: fb.text, lineHeight: 20 },
  empty: { color: fb.muted, padding: 24, textAlign: "center", alignSelf: "stretch" },
  memory: { padding: 14, gap: 10 },
  memoryKicker: { fontSize: 17, fontWeight: "700", color: fb.text },
  memoryImage: { width: "100%", aspectRatio: 4 / 3, borderRadius: 10 },
  memoryText: { fontSize: 16, color: fb.text },
  memoryBtn: { height: 40, borderRadius: 8, backgroundColor: fb.button, alignItems: "center", justifyContent: "center" },
  memoryBtnText: { fontSize: 16, fontWeight: "700", color: fb.text },
  editBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: fb.divider },
  editCancel: { fontSize: 17, color: fb.text },
  editTitle: { fontSize: 18, fontWeight: "700", color: fb.text },
  editSave: { fontSize: 17, fontWeight: "700", color: fb.blue },
  editLabel: { fontSize: 17, fontWeight: "700", color: fb.text, paddingHorizontal: 16 },
  editInput: { margin: 16, minHeight: 90, borderRadius: 10, backgroundColor: fb.input, padding: 12, fontSize: 16, color: fb.text, textAlignVertical: "top" },
  editNote: { fontSize: 13, color: fb.muted, paddingHorizontal: 16 },
});
