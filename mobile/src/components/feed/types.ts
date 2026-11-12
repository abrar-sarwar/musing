import type { Post, User } from "@/shared/types";
export type FeedPost = Post & { author: User };
