// facebook-ish shell palette + the musing accent. light only.
export const fb = {
  bg: "#f0f2f5",
  card: "#ffffff",
  blue: "#0866ff",
  blueSoft: "#e7f0ff",
  text: "#050505",
  muted: "#65676b",
  divider: "#ced0d4",
  hover: "#f2f2f2",
  input: "#f0f2f5",
  green: "#31a24c",
  red: "#f3425f",
  yellow: "#f7b928",
} as const;

export const muse = {
  start: "#7c3aed",
  end: "#ec4899",
  soft: "#f5efff",
  text: "#7c3aed",
} as const;

export const museGradient = [muse.start, muse.end] as const;

export const radius = { card: 8, pill: 999, input: 20 } as const;
