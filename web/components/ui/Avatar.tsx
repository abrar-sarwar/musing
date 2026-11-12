import { hash } from "@/lib/hash";

const PALETTE = ["#1877f2", "#e4405f", "#f7b928", "#45bd62", "#a033ff", "#f02849", "#5b21b6", "#0ea5e9", "#f97316", "#14b8a6"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

type Props = {
  seed: string;
  name: string;
  size?: number;
  online?: boolean;
  className?: string;
};

// placeholder avatar: initials on a deterministic color. no real photos anywhere.
export function Avatar({ seed, name, size = 40, online = false, className = "" }: Props) {
  const color = PALETTE[hash(seed) % PALETTE.length];
  return (
    <span
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.38) }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
      {online && (
        <span
          className="absolute rounded-full border-2 border-white bg-fb-green"
          style={{ width: Math.max(10, size * 0.3), height: Math.max(10, size * 0.3), right: -1, bottom: -1 }}
        />
      )}
    </span>
  );
}

// muse's own avatar: the gradient sparkle
export function MuseAvatar({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`bg-muse inline-flex shrink-0 items-center justify-center rounded-full text-white ${className}`}
      style={{ width: size, height: size }}
      title="muse"
      aria-label="muse"
    >
      <svg viewBox="0 0 24 24" style={{ width: size * 0.55, height: size * 0.55 }} fill="currentColor" aria-hidden="true">
        <path d="M12 2.5c.6 4.3 2.7 7 7 7.5-4.3.6-6.4 3.2-7 7.5-.6-4.3-2.7-6.9-7-7.5 4.3-.5 6.4-3.2 7-7.5ZM5 15.5c.3 1.9 1.2 3 3 3.3-1.8.3-2.7 1.4-3 3.2-.3-1.8-1.2-2.9-3-3.2 1.8-.3 2.7-1.4 3-3.3Z" />
      </svg>
    </span>
  );
}
