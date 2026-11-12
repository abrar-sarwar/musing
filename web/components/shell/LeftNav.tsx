"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import { LEFT_NAV, isActive } from "@/lib/nav";
import type { User } from "@/lib/types";

export function LeftNav({ me }: { me: User }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Sidebar">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fb-hover">
        <Avatar seed={me.avatar_seed} name={me.name} size={36} />
        <span className="truncate text-[15px] font-medium">{me.name}</span>
      </div>

      {LEFT_NAV.map((s) => {
        const active = isActive(pathname, s.href);
        const row = `flex items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-medium ${
          active ? "bg-fb-hover" : "hover:bg-fb-hover"
        }`;
        const icon = s.muse ? (
          <span className="bg-muse grid h-9 w-9 place-items-center rounded-full text-white">
            <Icon name="sparkle" className="h-5 w-5" />
          </span>
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full text-fb-blue">
            <Icon name={s.icon} className="h-7 w-7" />
          </span>
        );
        const label = s.muse ? (
          <span className="flex items-center gap-2">
            <span className="text-muse font-semibold">{s.label}</span>
            <span className="rounded-full bg-muse-soft px-1.5 py-0.5 text-[10px] font-semibold lowercase text-muse-start">new</span>
          </span>
        ) : (
          <span>{s.label}</span>
        );
        return s.enabled ? (
          <Link key={s.key} href={s.href} className={row} aria-current={active ? "page" : undefined}>
            {icon}
            {label}
          </Link>
        ) : (
          <div key={s.key} className={`${row} cursor-default`} aria-disabled="true">
            {icon}
            {label}
          </div>
        );
      })}

      <div className="mx-2 my-2 border-t border-fb-divider" />
      <p className="px-2 text-[12px] leading-5 text-fb-muted">
        Privacy · Terms · Advertising · Cookies
        <br />
        Hackathon prototype · mock data · no real accounts
      </p>
    </nav>
  );
}
