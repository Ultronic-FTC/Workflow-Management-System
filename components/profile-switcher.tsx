"use client";

import { teamMembers } from "@/lib/team-members";
import { useCurrentUser } from "@/components/current-user-provider";

export function ProfileSwitcher() {
  const { currentUserId, setCurrentUserId, hydrated } = useCurrentUser();

  return (
    <label className="profile-switcher">
      <span>Working as</span>
      <select
        aria-label="Select your team profile"
        value={hydrated ? currentUserId : ""}
        onChange={(event) => setCurrentUserId(event.target.value)}
      >
        <option value="">Select yourself</option>
        {teamMembers.map((member) => (
          <option value={member.id} key={member.id}>
            {member.name} · {member.role}
          </option>
        ))}
      </select>
    </label>
  );
}
