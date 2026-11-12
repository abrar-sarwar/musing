import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { ProfileView } from "@/components/facebook/ProfileView";
import { SubScreen } from "@/components/shell/SubScreen";
import { useActingUser } from "@/lib/acting-user";

// a friend's profile, pushed from search, a listing or a friends grid.
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { users, userId } = useActingUser();
  const user = users.find((u) => u.id === id);
  if (!user) {
    return (
      <SubScreen title="Profile">
        <Text style={{ padding: 24, textAlign: "center", color: "#65676b" }}>This profile isn&apos;t available.</Text>
      </SubScreen>
    );
  }
  return <ProfileView key={user.id} user={user} self={user.id === userId} />;
}
