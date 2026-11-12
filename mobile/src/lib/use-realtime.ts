import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

let seq = 0;

// calls onChange whenever a row in `table` changes. the payload is ignored on purpose:
// the app refetches through the api server, which decides what this person may see.
export function useTableChanges(table: "plans" | "events" | "messages" | "muse_trace" | "app_settings", onChange: () => void, filter?: string) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const ch = supabase
      .channel(`${table}-${filter ?? "all"}-${++seq}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => cb.current())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [table, filter]);
}
