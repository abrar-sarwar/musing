"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { TOP_NAV, isActive } from "@/lib/nav";
import type { User } from "@/lib/types";
import { PrototypeBadge } from "./PrototypeBadge";
import { UserSwitcher } from "./UserSwitcher";

export function TopBar({ users, me }: { users: User[]; me: User }) {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
      <div className="relative mx-auto flex h-full max-w-[1340px] items-center justify-between px-2 sm:px-4">
        {/* left: logo + search */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center rounded-full bg-fb-blue text-[26px] font-bold leading-none text-white"
            aria-label="Home"
          >
            f
          </Link>
          <label className="hidden h-10 items-center gap-2 rounded-full bg-fb-input pl-3 pr-4 md:flex">
            <Icon name="search" className="h-4 w-4 text-fb-muted" />
            <input
              className="w-40 bg-transparent text-[15px] outline-none placeholder:text-fb-muted lg:w-52"
              placeholder="Search Facebook"
              readOnly
            />
          </label>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-fb-input text-fb-text md:hidden"
            aria-label="Search"
          >
            <Icon name="search" className="h-5 w-5" />
          </button>
        </div>

        {/* center: surface nav (desktop) */}
        <nav className="absolute left-1/2 hidden h-full -translate-x-1/2 items-center md:flex" aria-label="Primary">
          {TOP_NAV.map((s) => {
            const active = isActive(pathname, s.href);
            const cls = `relative flex h-full w-[96px] items-center justify-center lg:w-[112px] ${
              active ? "text-fb-blue" : "text-fb-muted"
            }`;
            const inner = (
              <>
                <span className={`grid h-12 w-full place-items-center rounded-lg ${active ? "" : "hover:bg-fb-hover"}`}>
                  <Icon name={s.icon} className="h-7 w-7" />
                </span>
                {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-fb-blue" />}
              </>
            );
            return s.enabled ? (
              <Link key={s.key} href={s.href} className={cls} aria-label={s.label} aria-current={active ? "page" : undefined}>
                {inner}
              </Link>
            ) : (
              <span key={s.key} className={`${cls} cursor-default`} aria-label={s.label} aria-disabled="true">
                {inner}
              </span>
            );
          })}
        </nav>

        {/* right: badge, icons, switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <PrototypeBadge />
          <button
            type="button"
            className="hidden h-10 w-10 place-items-center rounded-full bg-fb-input text-fb-text hover:bg-fb-divider/70 sm:grid"
            aria-label="Messenger"
          >
            <Icon name="messenger" className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="hidden h-10 w-10 place-items-center rounded-full bg-fb-input text-fb-text hover:bg-fb-divider/70 md:grid"
            aria-label="Notifications"
          >
            <Icon name="bell" className="h-5 w-5" />
          </button>
          <UserSwitcher users={users} me={me} />
        </div>
      </div>
    </header>
  );
}
