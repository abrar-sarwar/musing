import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@/shared/types";
import { apiPost } from "./api";
import { supabase } from "./supabase";

const KEY = "musing_user";
const DEFAULT_USER = "maya";
const DEMO_ORDER = ["maya", "alex", "jo", "sam"];

type Ctx = {
  userId: string;
  me: User | null;
  users: User[];
  ready: boolean;
  /** bumps whenever data should refetch (user switch, reset) */
  version: number;
  switchTo: (id: string) => void;
  resetDemo: () => Promise<void>;
  switcherOpen: boolean;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  bump: () => void;
};

const ActingUserContext = createContext<Ctx | null>(null);

const rank = (u: User) => {
  const i = DEMO_ORDER.indexOf(u.id);
  return i === -1 ? 99 : i;
};

export function ActingUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(DEFAULT_USER);
  const [users, setUsers] = useState<User[]>([]);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase.from("users").select("*");
    if (error) {
      console.warn("users load failed:", error.message);
      return;
    }
    setUsers(((data ?? []) as User[]).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v) setUserId(v);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers, version]);

  const switchTo = useCallback(
    (id: string) => {
      setUserId(id);
      void AsyncStorage.setItem(KEY, id);
      setSwitcherOpen(false);
      bump();
    },
    [bump],
  );

  const resetDemo = useCallback(async () => {
    await apiPost("/api/reset", userId);
    bump();
  }, [userId, bump]);

  const me = useMemo(() => users.find((u) => u.id === userId) ?? null, [users, userId]);

  const value = useMemo<Ctx>(
    () => ({
      userId,
      me,
      users,
      ready,
      version,
      switchTo,
      resetDemo,
      switcherOpen,
      openSwitcher: () => setSwitcherOpen(true),
      closeSwitcher: () => setSwitcherOpen(false),
      bump,
    }),
    [userId, me, users, ready, version, switchTo, resetDemo, switcherOpen, bump],
  );

  return <ActingUserContext.Provider value={value}>{children}</ActingUserContext.Provider>;
}

export function useActingUser(): Ctx {
  const ctx = useContext(ActingUserContext);
  if (!ctx) throw new Error("useActingUser outside ActingUserProvider");
  return ctx;
}
