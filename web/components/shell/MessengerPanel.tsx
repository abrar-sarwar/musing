"use client";

import { useState } from "react";
import { Avatar, MuseAvatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import type { ThreadWithMessages } from "@/lib/db/queries";
import type { User } from "@/lib/types";
import { timeAgo } from "@/lib/time";

type Props = { threads: ThreadWithMessages[]; users: User[]; me: User };

// bottom-right expandable chat panel, desktop only. read-only in step 2.
export function MessengerPanel({ threads, users, me }: Props) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const byId = new Map(users.map((u) => [u.id, u]));
  const thread = threads.find((t) => t.id === threadId) ?? null;

  return (
    <div className="fixed bottom-0 right-4 z-30 hidden w-[328px] md:block">
      <div className={`overflow-hidden rounded-t-lg bg-white shadow-pop ${open ? "h-[440px]" : "h-12"} flex flex-col transition-[height]`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-12 shrink-0 items-center justify-between px-3 hover:bg-fb-hover"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            {thread && open ? (
              <>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setThreadId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      setThreadId(null);
                    }
                  }}
                  className="grid h-7 w-7 place-items-center rounded-full hover:bg-fb-divider/60"
                  aria-label="Back to chats"
                >
                  <Icon name="back" className="h-4 w-4" />
                </span>
                <span className="text-[15px] font-semibold">{thread.title}</span>
              </>
            ) : (
              <>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-fb-input text-fb-text">
                  <Icon name="messenger" className="h-4 w-4" />
                </span>
                <span className="text-[15px] font-semibold">Messenger</span>
              </>
            )}
          </span>
          <Icon name={open ? "chevronDown" : "chevronUp"} className="h-5 w-5 text-fb-muted" />
        </button>

        {open && !thread && (
          <ul className="flex-1 overflow-y-auto border-t border-fb-divider p-2">
            {threads.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-fb-muted">No chats yet.</li>}
            {threads.map((t) => {
              const last = t.messages[t.messages.length - 1];
              const others = t.member_ids.filter((id) => id !== me.id).map((id) => byId.get(id)).filter(Boolean) as User[];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setThreadId(t.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-fb-hover"
                  >
                    <span className="relative h-12 w-12 shrink-0">
                      {others[0] && <Avatar seed={others[0].avatar_seed} name={others[0].name} size={32} className="absolute left-0 top-0" />}
                      {others[1] && (
                        <Avatar seed={others[1].avatar_seed} name={others[1].name} size={32} className="absolute bottom-0 right-0 ring-2 ring-white" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{t.title}</span>
                      {last && (
                        <span className="block truncate text-[13px] text-fb-muted">
                          {last.sender_id === me.id ? "You" : last.sender_id ? byId.get(last.sender_id)?.name.split(" ")[0] : "muse"}: {last.body ?? "sent a plan"} · {timeAgo(last.created_at)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {open && thread && (
          <div className="flex flex-1 flex-col border-t border-fb-divider">
            <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
              {thread.messages.map((m) => {
                const mine = m.sender_id === me.id;
                const sender = m.sender_id ? byId.get(m.sender_id) : null;
                return (
                  <li key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
                    {!mine && (sender ? <Avatar seed={sender.avatar_seed} name={sender.name} size={28} /> : <MuseAvatar size={28} />)}
                    <span
                      className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-[15px] ${
                        mine ? "bg-fb-blue text-white" : "bg-fb-input text-fb-text"
                      }`}
                    >
                      {m.body}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 border-t border-fb-divider p-2">
              <input className="h-9 flex-1 rounded-full bg-fb-input px-3 text-[15px] outline-none placeholder:text-fb-muted" placeholder="Aa" readOnly />
              <span className="grid h-9 w-9 place-items-center rounded-full text-fb-blue">
                <Icon name="like" className="h-5 w-5" />
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
