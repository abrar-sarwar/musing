import type { ReactNode } from "react";

// facebook-style white card. edge to edge on phones, rounded on desktop.
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-fb-card shadow-card md:rounded-lg ${className}`}>{children}</div>;
}
