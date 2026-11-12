import { Composer } from "@/components/feed/Composer";
import { PostCard } from "@/components/feed/PostCard";
import { getFeedPosts, getUser } from "@/lib/db/queries";
import { getActingUserId } from "@/lib/user";

export default async function FeedPage() {
  const actingId = await getActingUserId();
  const [me, posts] = await Promise.all([getUser(actingId), getFeedPosts()]);
  if (!me) return null;

  return (
    <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
      <Composer me={me} />
      {/* recap post slot lands here in step 14 */}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
