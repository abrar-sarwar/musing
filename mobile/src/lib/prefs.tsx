import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Settings } from "@/shared/types";
import { useActingUser } from "./acting-user";
import { apiGet, apiPost } from "./api";
import { useTableChanges } from "./use-realtime";

// demo controls. muse on/off, replay and posters are global (server side, so both
// phones agree). the trace panel is per device.
type Ctx = {
  settings: Settings;
  setSetting: (key: keyof Settings, value: boolean) => Promise<void>;
  traceOn: boolean;
  setTraceOn: (v: boolean) => void;
  /** a thought handed to the composer from elsewhere (reels card, recap, suggestion) */
  handoff: string | null;
  setHandoff: (t: string | null) => void;
};

const DEFAULTS: Settings = { muse_on: true, muse_replay: false, posters_on: true };
const TRACE_KEY = "musing_trace";
const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { userId, version } = useActingUser();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [traceOn, setTrace] = useState(false);
  const [handoff, setHandoff] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Settings>("/api/settings", userId)
      .then(setSettings)
      .catch(() => {});
  }, [userId]);

  useEffect(load, [load, version]);
  useTableChanges("app_settings", load);

  useEffect(() => {
    void AsyncStorage.getItem(TRACE_KEY).then((v) => setTrace(v === "1"));
  }, []);

  const setSetting = useCallback(
    async (key: keyof Settings, value: boolean) => {
      setSettings((s) => ({ ...s, [key]: value }));
      try {
        setSettings(await apiPost<Settings>("/api/settings", userId, { key, value }));
      } catch {
        load();
      }
    },
    [userId, load],
  );

  const setTraceOn = useCallback((v: boolean) => {
    setTrace(v);
    void AsyncStorage.setItem(TRACE_KEY, v ? "1" : "0");
  }, []);

  const value = useMemo(() => ({ settings, setSetting, traceOn, setTraceOn, handoff, setHandoff }), [settings, setSetting, traceOn, setTraceOn, handoff]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs outside PrefsProvider");
  return ctx;
}
