"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { TeamMember } from "@/lib/team-members";

type CurrentUserContextValue = {
  currentUser: TeamMember | null;
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
  teamMembers: TeamMember[];
  hydrated: boolean;
  rosterError: string;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);
const STORAGE_KEY = "ultronic_current_user";

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserIdState] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [rosterError, setRosterError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRoster() {
      const savedUserId = window.localStorage.getItem(STORAGE_KEY) ?? "";

      try {
        const response = await fetch("/api/team-members", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load team roster.");
        }

        const payload = await response.json();
        const members = Array.isArray(payload.members)
          ? (payload.members as TeamMember[])
          : [];

        if (cancelled) {
          return;
        }

        setTeamMembers(members);

        if (savedUserId && members.some((member) => member.id === savedUserId)) {
          setCurrentUserIdState(savedUserId);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
          setCurrentUserIdState("");
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setRosterError(
            "Team roster unavailable. Check the Supabase server connection."
          );
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    loadRoster();

    return () => {
      cancelled = true;
    };
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
    [currentUserId, teamMembers]
  );

  return (
    <CurrentUserContext.Provider
      value={{
        currentUser,
        currentUserId,
        setCurrentUserId,
        teamMembers,
        hydrated,
        rosterError,
      }}
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
