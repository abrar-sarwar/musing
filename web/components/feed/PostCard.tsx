import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import type { FeedPost } from "@/lib/db/queries";
import { hash } from "@/lib/hash";
import { timeAgo } from "@/lib/time";

export function PostCard({ post }: { post: FeedPost }) {
  const likes = 3 + (hash(post.id) % 40);
  const comments = hash(post.id + "c") % 9;

  return (
    <Card>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Avatar seed={post.author.avatar_seed} name={post.author.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-5">{post.author.name}</div>
          <div className="flex items-center gap-1 text-[13px] text-fb-muted">
            <span>{timeAgo(post.created_at)}</span>
            <span>·</span>
            <Icon name="globe" className="h-3 w-3" />
          </div>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full text-fb-muted hover:bg-fb-hover">
          <Icon name="more" className="h-5 w-5" />
        </span>
      </div>

      <p className="whitespace-pre-wrap px-4 pb-2 pt-3 text-[15px] leading-5">{post.body}</p>

      <div className="flex items-center justify-between px-4 py-2 text-[15px] text-fb-muted">
        <span className="flex items-center gap-1.5">
          <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-fb-blue text-white">
            <Icon name="like" className="h-2.5 w-2.5" filled />
          </span>
          {likes}
        </span>
        {comments > 0 && <span>{comments} comments</span>}
      </div>

      <div className="mx-4 grid grid-cols-3 border-t border-fb-divider py-1">
        <PostAction icon="like" label="Like" />
        <PostAction icon="comment" label="Comment" />
        <PostAction icon="share" label="Share" />
      </div>
    </Card>
  );
}

function PostAction({ icon, label }: { icon: "like" | "comment" | "share"; label: string }) {
  return (
    <div className="flex h-9 items-center justify-center gap-2 rounded-lg text-[15px] font-medium text-fb-muted hover:bg-fb-hover">
      <Icon name={icon} className="h-5 w-5" />
      {label}
    </div>
  );
}
