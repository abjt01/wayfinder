"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, LearningPath, Profile } from "./types";

type State = {
  profile: Profile | null;
  path: LearningPath | null;
  completed: string[];
  chat: ChatMessage[];
  setProfile: (p: Profile) => void;
  setPath: (p: LearningPath) => void;
  toggleComplete: (id: string) => void;
  setChat: (m: ChatMessage[]) => void;
  reset: () => void;
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      profile: null,
      path: null,
      completed: [],
      chat: [],
      setProfile: (profile) => set({ profile }),
      setPath: (path) => set({ path, completed: [] }),
      toggleComplete: (id) =>
        set((s) => ({
          completed: s.completed.includes(id)
            ? s.completed.filter((x) => x !== id)
            : [...s.completed, id],
        })),
      setChat: (chat) => set({ chat }),
      reset: () => set({ profile: null, path: null, completed: [], chat: [] }),
    }),
    { name: "wayfinder-v1" }
  )
);

/** True once localStorage has been read, so pages don't flash empty state. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = useStore.persist;
    if (!api) {
      setHydrated(true);
      return;
    }
    if (api.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return api.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
