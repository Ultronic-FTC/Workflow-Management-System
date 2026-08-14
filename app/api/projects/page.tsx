"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import styles from "./projects.module.css";

type Project = {
  id: string;
  name: string;
  description: string | null;
  division: "technical" | "operational" | "both";
  status: "planning" | "active" | "paused" | "completed";
  lead_member_id: string | null;
  lead_name: string | null;
  target_date: string | null;
  task_count: number;
  completed_count: number;
  blocked_count: number;
  review_count: number;
  progress: number;
};

type Filter = "all" | "technical" | "operational";

function formatDate(value: string | null) {
  if (!value) {
    return "Ongoing";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ProjectsPage() {
  const { currentUser, teamMembers, hydrated } = useCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [division, setDivision] = useState<
    "technical" | "operational" | "both"
  >("operational");
  const [status, setStatus] = useState<
    "planning" | "active" | "paused" | "completed"
  >("active");
  const [leadMemberId, setLeadMemberId] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load projects.");
      }

      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load projects."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const visibleProjects = useMemo(() => {
    if (filter === "all") {
      return projects;
    }

    return projects.filter(
      (project) => project.division === filter || project.division === "both"
    );
  }, [filter, projects]);

  function openNewProject() {
    setName("");
    setDescription("");
    setDivision("operational");
    setStatus("active");
    setLeadMemberId(currentUser?.id ?? "");
    setTargetDate("");
    setFormError("");
    setShowModal(true);
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          division,
          status,
          lead_member_id: leadMemberId || null,
          target_date: targetDate || null,
          created_by_member_id: currentUser?.id ?? null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create project.");
      }

      setShowModal(false);
      await loadProjects();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create project."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="eyebrow">WORKSTREAMS</p>
          <h1>Projects</h1>
          <p>Major bodies of work across technical and operational teams.</p>
        </div>
        <button className="primary-button" onClick={openNewProject}>
          + New Project
        </button>
      </div>

      <div className="project-filters">
        <button
          className={filter === "all" ? "active-filter" : undefined}
          onClick={() => setFilter("all")}
        >
          All Projects
        </button>
        <button
          className={filter === "technical" ? "active-filter" : undefined}
          onClick={() => setFilter("technical")}
        >
          Technical
        </button>
        <button
          className={filter === "operational" ? "active-filter" : undefined}
          onClick={() => setFilter("operational")}
        >
          Operational
        </button>
        <span></span>
        <button disabled>Sort: Target Date ▾</button>
      </div>

      {loading && <div className={styles.loading}>Loading projects…</div>}

      {!loading && loadError && (
        <div className={styles.error}>
          <strong>Projects could not be loaded.</strong>
          <div>{loadError}</div>
        </div>
      )}

      {!loading && !loadError && visibleProjects.length === 0 && (
        <div className={styles.empty}>
          No projects match this view. Use <strong>+ New Project</strong> to
          create the first one.
        </div>
      )}

      {!loading && !loadError && visibleProjects.length > 0 && (
        <div className="project-grid">
          {visibleProjects.map((project) => {
            const tone =
              project.division === "technical" ? "technical" : "operational";
            const risk =
              project.blocked_count > 0
                ? `${project.blocked_count} blocked`
                : project.review_count > 0
                  ? `${project.review_count} need review`
                  : project.task_count === 0
                    ? "No tasks yet"
                    : "On track";

            return (
              <article
                className={`project-card ${tone}`}
                key={project.id}
                title={project.description ?? undefined}
              >
                <div className="project-top">
                  <span>{titleCase(project.division)}</span>
                  <strong>{project.progress}%</strong>
                </div>

                <h2>{project.name}</h2>

                <div className="progress">
                  <i style={{ width: `${project.progress}%` }} />
                </div>

                <div className="project-stats">
                  <span>{project.task_count} tasks</span>
                  <span>{risk}</span>
                </div>

                <div className={styles.cardMeta}>
                  <span>
                    Lead: <strong>{project.lead_name ?? "Unassigned"}</strong>
                  </span>
                  <span
                    className={`${styles.status} ${styles[project.status]}`}
                  >
                    {titleCase(project.status)}
                  </span>
                </div>

                <footer>Target: {formatDate(project.target_date)}</footer>
              </article>
            );
          })}
        </div>
      )}

      {showModal && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !submitting) {
              setShowModal(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className="eyebrow">NEW WORKSTREAM</p>
                <h2 id="new-project-title">Create Project</h2>
              </div>
              <button
                className={styles.close}
                onClick={() => setShowModal(false)}
                disabled={submitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className={styles.form} onSubmit={submitProject}>
              <label>
                Project Name
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Professional Demo"
                />
              </label>

              <label className={styles.full}>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What body of work does this project represent?"
                />
              </label>

              <div className={styles.twoCol}>
                <label>
                  Division
                  <select
                    value={division}
                    onChange={(event) =>
                      setDivision(
                        event.target.value as
                          | "technical"
                          | "operational"
                          | "both"
                      )
                    }
                  >
                    <option value="technical">Technical</option>
                    <option value="operational">Operational</option>
                    <option value="both">Both</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value as
                          | "planning"
                          | "active"
                          | "paused"
                          | "completed"
                      )
                    }
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
              </div>

              <div className={styles.twoCol}>
                <label>
                  Project Lead
                  <select
                    value={leadMemberId}
                    disabled={!hydrated}
                    onChange={(event) => setLeadMemberId(event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((member) => (
                      <option value={member.id} key={member.id}>
                        {member.name} · {titleCase(member.role)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Target Date
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(event) => setTargetDate(event.target.value)}
                  />
                </label>
              </div>

              {formError && (
                <p className={styles.formMessage}>{formError}</p>
              )}

              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.submit}
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
