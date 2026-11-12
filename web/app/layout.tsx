import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomTabs } from "@/components/shell/BottomTabs";
import { LeftNav } from "@/components/shell/LeftNav";
import { MessengerPanel } from "@/components/shell/MessengerPanel";
import { RightRail } from "@/components/shell/RightRail";
import { TopBar } from "@/components/shell/TopBar";
import { getFriends, getThreadsFor, getUsers } from "@/lib/db/queries";
import { getActingUserId } from "@/lib/user";

export const metadata: Metadata = {
  title: "musing.",
  description: "hackathon prototype. one vague thought, a real plan with friends.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actingId = await getActingUserId();
  const [users, friends, threads] = await Promise.all([getUsers(), getFriends(actingId), getThreadsFor(actingId)]);
  const me = users.find((u) => u.id === actingId) ?? users[0];

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-fb-bg text-fb-text">
        <TopBar users={users} me={me} />
        <div className="mx-auto grid w-full max-w-[1340px] grid-cols-1 gap-0 pt-14 pb-16 md:grid-cols-[280px_minmax(0,1fr)] md:gap-4 md:pb-6 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="hidden md:block">
            <div className="scrollbar-none sticky top-14 h-[calc(100vh-56px)] overflow-y-auto px-2 py-4">
              <LeftNav me={me} />
            </div>
          </aside>
          <main className="min-w-0">
            <div className="mx-auto w-full max-w-[680px]">{children}</div>
          </main>
          <aside className="hidden lg:block">
            <div className="scrollbar-none sticky top-14 h-[calc(100vh-56px)] overflow-y-auto px-2 py-4">
              <RightRail friends={friends} />
            </div>
          </aside>
        </div>
        <BottomTabs />
        <MessengerPanel threads={threads} users={users} me={me} />
      </body>
    </html>
  );
}
