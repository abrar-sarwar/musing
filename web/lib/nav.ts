import type { IconName } from "@/components/ui/icons";

// every surface in the shell. enabled=false renders inert so nothing half-built
// is reachable from the nav. flip to true as each step lands.
export type Surface = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  enabled: boolean;
  muse?: boolean; // musing. accent
};

export const TOP_NAV: Surface[] = [
  { key: "home", label: "Home", href: "/", icon: "home", enabled: true },
  { key: "reels", label: "Reels", href: "/reels", icon: "reels", enabled: false },
  { key: "events", label: "Events", href: "/events", icon: "events", enabled: false },
  { key: "groups", label: "Groups", href: "/groups", icon: "groups", enabled: false },
];

export const LEFT_NAV: Surface[] = [
  { key: "friends", label: "Friends", href: "/friends", icon: "friends", enabled: false },
  { key: "events", label: "Events", href: "/events", icon: "events", enabled: false },
  { key: "groups", label: "Groups", href: "/groups", icon: "groups", enabled: false },
  { key: "musing", label: "musing.", href: "/musing", icon: "sparkle", enabled: false, muse: true },
];

export const BOTTOM_TABS: Surface[] = [
  { key: "home", label: "Home", href: "/", icon: "home", enabled: true },
  { key: "reels", label: "Reels", href: "/reels", icon: "reels", enabled: false },
  { key: "musing", label: "musing.", href: "/musing", icon: "sparkle", enabled: false, muse: true },
  { key: "events", label: "Events", href: "/events", icon: "events", enabled: false },
  { key: "menu", label: "Menu", href: "/menu", icon: "menu", enabled: false },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
