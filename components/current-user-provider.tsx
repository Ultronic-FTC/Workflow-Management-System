"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { teamMembers, TeamMember } from "@/lib/team-members";

type CurrentUserContextValue = {
  currentUser: TeamMember | null;
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  hydrated: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);
const STORAGE_KEY = "ultronic_current_user";

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserIdState] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    setCurrentUserIdState(saved);
    setHydrated(true);
  }, []);

  function setCurrentUserId(id: string) {
    setCurrentUserIdState(id);

    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  const currentUser = useMemo(
    () => teamMembers.find((member) => member.id === currentUserId) ?? null,
    [currentUserId]
  );

  return (
    <CurrentUserContext.Provider
      value={{ currentUser, currentUserId, setCurrentUserId, hydrated }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const value = useContext(CurrentUserContext);

  if (!value) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider.");
  }

  return value;
}
