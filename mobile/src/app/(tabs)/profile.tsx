import { View } from "react-native";
import { ProfileView } from "@/components/facebook/ProfileView";
import { useActingUser } from "@/lib/acting-user";

// the acting user's own profile. remounts on a user switch so local edits don't carry over.
export default function ProfileTab() {
  const { me } = useActingUser();
  return me ? <ProfileView key={me.id} user={me} self /> : <View style={{ flex: 1, backgroundColor: "#fff" }} />;
}
