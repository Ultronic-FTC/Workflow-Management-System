"use client";

import { useCurrentUser } from "@/components/current-user-provider";

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ProfileSwitcher() {
  const {
    currentUserId,
    setCurrentUserId,
    teamMembers,
    hydrated,
    rosterError,
  } = useCurrentUser();

  const disabled = !hydrated || teamMembers.length === 0;

  return (
    <label
      className="profile-switcher"
      title={rosterError || "Select your team profile"}
    >
      <span>Working as</span>
      <select
        aria-label="Select your team profile"
        value={hydrated ? currentUserId : ""}
        disabled={disabled}
        onChange={(event) => setCurrentUserId(event.target.value)}
      >
        <option value="">
          {!hydrated
            ? "Loading roster…"
            : rosterError
              ? "Roster unavailable"
              : "Select yourself"}
        </option>

        {teamMembers.map((member) => (
          <option value={member.id} key={member.id}>
            {member.name} · {titleCase(member.role)}
          </option>
        ))}
      </select>
    </label>
  );
}
