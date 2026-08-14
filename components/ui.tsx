import { ReactNode } from "react";

export function Metric({ value, label, tone = "neutral" }: { value: string | number; label: string; tone?: "neutral" | "red" | "cyan" | "yellow" }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

export type TaskCardProps = {
  title: string;
  category: string;
  project: string;
  lead?: string;
  people?: string;
  estimate?: string;
  due?: string;
  tone?: "technical" | "operational";
  badge?: string;
};

export function TaskCard({ title, category, project, lead = "Unassigned", people, estimate, due, tone = "technical", badge }: TaskCardProps) {
  return (
    <article className={`task-card ${tone}`}>
      <div className="task-label">{category} · {project}</div>
      <h3>{title}</h3>
      <div className="task-meta"><span>Lead: {lead}</span>{people && <span>👥 {people}</span>}</div>
      <div className="task-footer"><span>{estimate || "—"}</span><span>{due || "No deadline"}</span></div>
      {badge && <span className="task-badge">{badge}</span>}
    </article>
  );
}

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</section>;
}
