// facebook mobile palette + the musing. accent. light only.
export const fb = {
  bg: "#ffffff", // main background
  bg2: "#f0f2f5", // secondary background, gaps between feed units
  card: "#ffffff",
  blue: "#0866ff",
  blueSoft: "#e7f3ff", // active nav + selected pills
  unread: "#e7f3ff",
  text: "#050505",
  muted: "#65676b",
  divider: "#ced0d4",
  hover: "#f2f2f2",
  input: "#f0f2f5",
  button: "#e4e6eb", // secondary button fill
  green: "#31a24c",
  red: "#f3425f",
  badge: "#e41e3f",
  yellow: "#f7b928",
} as const;

// musing. gets its own identity only inside musing. features: soft lavender to pink.
export const muse = {
  start: "#8b5cf6",
  end: "#ec4899",
  soft: "#f3eeff",
  softer: "#faf7ff",
  line: "#e4d9ff",
  text: "#6d28d9",
  dating: "#6f3fd8",
} as const;

export const museGradient = [muse.start, muse.end] as const;

export const radius = { card: 8, pill: 999, input: 20 } as const;

// space the floating tab bar needs at the bottom of every tab screen
export const TAB_BAR_HEIGHT = 58;
export const TAB_BAR_SPACE = 96;
