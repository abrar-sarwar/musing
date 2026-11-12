"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import type { User } from "@/lib/types";

// act as any seeded user. no login, no passwords. also hosts the one-tap reset.
export function UserSwitcher({ users, me }: { users: User[]; me: User }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function post(url: string, body?: object, key = url) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `${res.status}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1.5 rounded-full pl-0.5 pr-2 hover:bg-fb-hover"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acting as ${me.name}. Switch user`}
      >
        <Avatar seed={me.avatar_seed} name={me.name} size={36} />
        <Icon name="chevronDown" className="h-4 w-4 text-fb-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg bg-white shadow-pop"
        >
          <div className="px-3 pb-2 pt-3">
            <div className="text-[13px] font-semibold text-fb-muted">Acting as</div>
            <div className="mt-2 flex items-center gap-3 rounded-lg bg-fb-input px-3 py-2">
              <Avatar seed={me.avatar_seed} name={me.name} size={36} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{me.name}</div>
                <div className="truncate text-[12px] text-fb-muted">@{me.id}</div>
              </div>
            </div>
          </div>
          <div className="px-2 pb-1 text-[13px] font-semibold text-fb-muted">Switch to</div>
          <ul className="max-h-72 overflow-y-auto px-2 pb-2">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy !== null || u.id === me.id}
                  onClick={() => post("/api/user", { id: u.id }, u.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-fb-hover disabled:cursor-default disabled:opacity-60"
                >
                  <Avatar seed={u.avatar_seed} name={u.name} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{u.name}</span>
                  {u.id === me.id && <Icon name="check" className="h-4 w-4 text-fb-blue" />}
                  {busy === u.id && <span className="text-[12px] text-fb-muted">…</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-fb-divider p-2">
            <button
              type="button"
              role="menuitem"
              disabled={busy !== null}
              onClick={() => post("/api/reset", undefined, "reset")}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] font-medium hover:bg-fb-hover disabled:opacity-60"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-fb-input text-fb-text">
                <Icon name="refresh" className="h-4.5 w-4.5" />
              </span>
              {busy === "reset" ? "Resetting…" : "Reset demo data"}
            </button>
            {error && <div className="px-2 pt-1 text-[12px] text-fb-red">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
