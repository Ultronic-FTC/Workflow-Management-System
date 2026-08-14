export type TeamMember = {
  id: string;
  name: string;
  role: "student" | "captain" | "mentor" | "coach";
  division: "technical" | "operational" | "both";
  sort_order: number;
};
