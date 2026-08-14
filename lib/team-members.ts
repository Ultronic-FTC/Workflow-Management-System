export type TeamMember = {
  id: string;
  name: string;
  role: string;
};

export const teamMembers: TeamMember[] = [
  { id: "natalie", name: "Natalie", role: "Team Member" },
  { id: "sophie", name: "Sophie", role: "Team Member" },
  { id: "ben", name: "Ben", role: "Team Member" },
  { id: "michael", name: "Michael", role: "Mentor" },
  { id: "cache", name: "Cache", role: "Mentor" },
];

// This list is intentionally temporary.
// In the next build, team members will come from Supabase instead of this file.
