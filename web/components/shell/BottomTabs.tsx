"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { BOTTOM_TABS, isActive } from "@/lib/nav";

// phone nav. 390px wide must work.
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-fb-divider bg-white md:hidden"
      aria-label="Primary"
    >
      {BOTTOM_TABS.map((t) => {
        const active = isActive(pathname, t.href);
        const cls = `relative flex flex-1 flex-col items-center justify-center gap-0.5 ${
          t.muse ? (active ? "text-muse-start" : "text-fb-muted") : active ? "text-fb-blue" : "text-fb-muted"
        }`;
        const inner = (
          <>
            {active && <span className={`absolute inset-x-3 top-0 h-[3px] rounded-b ${t.muse ? "bg-muse" : "bg-fb-blue"}`} />}
            {t.muse ? (
              <span className={`grid h-7 w-7 place-items-center rounded-full ${active ? "bg-muse text-white" : "bg-muse text-white opacity-80"}`}>
                <Icon name="sparkle" className="h-4 w-4" />
              </span>
            ) : (
              <Icon name={t.icon} className="h-7 w-7" />
            )}
            <span className={`text-[10px] ${t.muse ? "lowercase" : ""}`}>{t.label}</span>
          </>
        );
        return t.enabled ? (
          <Link key={t.key} href={t.href} className={cls} aria-current={active ? "page" : undefined}>
            {inner}
          </Link>
        ) : (
          <span key={t.key} className={`${cls} cursor-default`} aria-disabled="true">
            {inner}
          </span>
        );
      })}
    </nav>
  );
}
