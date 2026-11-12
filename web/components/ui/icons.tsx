import type { SVGProps } from "react";

export type IconName =
  | "home" | "reels" | "events" | "groups" | "friends" | "messenger" | "bell"
  | "search" | "menu" | "chevronDown" | "chevronUp" | "sparkle" | "video"
  | "photo" | "emoji" | "like" | "comment" | "share" | "plus" | "x" | "more"
  | "globe" | "back" | "edit" | "refresh" | "check";

type Props = SVGProps<SVGSVGElement> & { name: IconName; filled?: boolean };

// simple stroke icons, 24px grid, currentColor. close enough to the shell's look.
export function Icon({ name, filled = false, className = "h-6 w-6", ...rest }: Props) {
  const stroke = {
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...stroke} {...rest}>
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />,
  reels: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M3 8h18M8 3l3 5M14 3l3 5" />
      <path d="M10.5 11.5v6l5-3-5-3Z" fill="currentColor" stroke="none" />
    </>
  ),
  events: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h3v3H8z" fill="currentColor" stroke="none" />
    </>
  ),
  groups: (
    <>
      <circle cx="8" cy="9" r="3" />
      <circle cx="16.5" cy="10" r="2.5" />
      <path d="M2.5 19c.6-3 2.7-4.5 5.5-4.5s4.9 1.5 5.5 4.5M13.5 18.5c.4-2.2 1.6-3.5 3-3.5 1.9 0 3.3 1.2 3.8 3.5" />
    </>
  ),
  friends: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19.5c.7-3.4 3-5.2 6.2-5.2s5.5 1.8 6.2 5.2" />
      <path d="M16 5.5a3 3 0 0 1 0 5.8M18 14.6c2 .5 3.1 1.9 3.5 4.4" />
    </>
  ),
  messenger: (
    <>
      <path d="M12 3C7 3 3 6.7 3 11.3c0 2.5 1.2 4.7 3.1 6.2V21l3-1.7c.9.3 1.9.4 2.9.4 5 0 9-3.7 9-8.4S17 3 12 3Z" />
      <path d="m7.5 13.5 3-3.2 2.5 2 3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  menu: (
    <>
      <circle cx="5" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  sparkle: (
    <path
      d="M12 2.5c.6 4.3 2.7 7 7 7.5-4.3.6-6.4 3.2-7 7.5-.6-4.3-2.7-6.9-7-7.5 4.3-.5 6.4-3.2 7-7.5ZM5 15.5c.3 1.9 1.2 3 3 3.3-1.8.3-2.7 1.4-3 3.2-.3-1.8-1.2-2.9-3-3.2 1.8-.3 2.7-1.4 3-3.3Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="m16 10 5-3v10l-5-3" />
    </>
  ),
  photo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.8" />
      <path d="m3 17 5-4.5 4 3.5 3.5-3L21 17" />
    </>
  ),
  emoji: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  like: (
    <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 3.5-7.5c1.4 0 2.5 1.1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1 6.5a2 2 0 0 1-2 1.7H7" />
  ),
  comment: <path d="M12 3.5c5 0 9 3.4 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L5 20.5l.9-3.4C4.1 15.7 3 13.5 3 11.1c0-4.2 4-7.6 9-7.6Z" />,
  share: <path d="M14 5v4C8 9.5 5 12.8 4 18.5c2.5-3.3 5.8-4.6 10-4.6V18l6-6.5L14 5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  edit: <path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4" />,
  refresh: <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};
