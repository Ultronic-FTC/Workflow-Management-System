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

type DivisionFilter = "all" | "technical" | "operational";

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTargetDate(value: string | null) {
  if (!value) return "No target date";

  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProjectsPage() {
  const { currentUser, teamMembers } = useCurrentUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [divisionFilter, setDivisionFilter] =
    useState<DivisionFilter>("all");
  const [showNewProject, setShowNewProject] = useState(false);

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
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load projects.");
      }

      setProjects(Array.isArray(payload.projects) ? payload.projects : []);
    } catch (error) {
      setPageError(
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
    const filtered = projects.filter((project) => {
      if (divisionFilter === "all") return true;

      return (
        project.division === divisionFilter || project.division === "both"
      );
    });

    return [...filtered].sort((a, b) => {
      if (!a.target_date && !b.target_date) {
        return a.name.localeCompare(b.name);
      }

      if (!a.target_date) return 1;
      if (!b.target_date) return -1;

      return a.target_date.localeCompare(b.target_date);
    });
  }, [projects, divisionFilter]);

  function resetForm() {
    setName("");
    setDescription("");
    setDivision("operational");
    setStatus("active");
    setLeadMemberId("");
    setTargetDate("");
    setFormError("");
  }

  function openNewProject() {
    resetForm();
    setShowNewProject(true);
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();

    if (!currentUser) {
      setFormError(
        "Select yourself under Working As before creating a project."
      );
      return;
    }

    if (name.trim().length < 2) {
      setFormError("Project name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          division,
          status,
          lead_member_id: leadMemberId || null,
          target_date: targetDate || null,
          created_by_member_id: currentUser.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create project.");
      }

      setShowNewProject(false);
      resetForm();
      await loadProjects();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create project."
      );
    } finally {
      setSaving(false);
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

        <button
          className="primary-button"
          type="button"
          onClick={openNewProject}
        >
          + New Project
        </button>
      </div>

      <div className="project-filters">
        <button
          type="button"
          className={divisionFilter === "all" ? styles.activeFilter : undefined}
          onClick={() => setDivisionFilter("all")}
        >
          All Projects
        </button>

        <button
          type="button"
          className={
            divisionFilter === "technical" ? styles.activeFilter : undefined
          }
          onClick={() => setDivisionFilter("technical")}
        >
          Technical
        </button>

        <button
          type="button"
          className={
            divisionFilter === "operational" ? styles.activeFilter : undefined
          }
          onClick={() => setDivisionFilter("operational")}
        >
          Operational
        </button>

        <span />

        <button type="button" disabled>
          Sort: Target Date
        </button>
      </div>

      {!currentUser && (
        <div className="identity-prompt">
          <strong>Choose your name above.</strong>
          <span>
            You can browse projects now, but you need a selected profile to
            create one.
          </span>
        </div>
      )}

      {pageError && <div className={styles.errorBox}>{pageError}</div>}

      {loading ? (
        <div className={styles.emptyState}>Loading projects…</div>
      ) : visibleProjects.length === 0 ? (
        <div className={styles.emptyState}>
          No projects match this filter.
        </div>
      ) : (
        <div className="project-grid">
          {visibleProjects.map((project) => {
            const visualDivision =
              project.division === "technical"
                ? "technical"
                : project.division === "operational"
                  ? "operational"
                  : "both";

            const riskText =
              project.blocked_count > 0
                ? `${project.blocked_count} blocked`
                : project.review_count > 0
                  ? `${project.review_count} need review`
                  : "0 blocked";

            return (
              <article
                className={`project-card ${
                  visualDivision === "operational"
                    ? "operational"
                    : visualDivision === "both"
                      ? styles.bothProject
                      : ""
                }`}
                key={project.id}
              >
                <div className="project-top">
                  <span>{titleCase(project.division)}</span>
                  <strong>{project.progress}%</strong>
                </div>

                <h2>{project.name}</h2>

                {project.description && (
                  <p className={styles.description}>{project.description}</p>
                )}

                <div className="progress">
                  <i style={{ width: `${project.progress}%` }} />
                </div>

                <div className="project-stats">
                  <span>
                    {project.task_count} task
                    {project.task_count === 1 ? "" : "s"}
                  </span>
                  <span>{riskText}</span>
                </div>

                <div className={styles.projectMeta}>
                  <span>
                    Lead: <strong>{project.lead_name ?? "Unassigned"}</strong>
                  </span>
                  <span className={styles.status}>
                    {titleCase(project.status)}
                  </span>
                </div>

                <footer>Target: {formatTargetDate(project.target_date)}</footer>
              </article>
            );
          })}
        </div>
      )}

      {showNewProject && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !saving) {
              setShowNewProject(false);
            }
          }}
        >
          <form
            className={styles.modal}
            onSubmit={createProject}
            aria-label="Create new project"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className="eyebrow">NEW WORKSTREAM</p>
                <h2>Create Project</h2>
                <p>
                  Projects group related tasks into a major body of team work.
                </p>
              </div>

              <button
                type="button"
                className={styles.close}
                onClick={() => setShowNewProject(false)}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className={styles.formBody}>
              <label className={styles.field}>
                Project Name
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Centerstage Intake"
                />
              </label>

              <label className={styles.field}>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does this project need to accomplish?"
                />
              </label>

              <div className={styles.twoColumn}>
                <label className={styles.field}>
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

                <label className={styles.field}>
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

              <div className={styles.twoColumn}>
                <label className={styles.field}>
                  Project Lead
                  <select
                    value={leadMemberId}
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

                <label className={styles.field}>
                  Target Date
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(event) => setTargetDate(event.target.value)}
                  />
                </label>
              </div>

              {formError && (
                <div className={styles.formError}>{formError}</div>
              )}
            </div>

            <div className={styles.actions}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setShowNewProject(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={saving || !currentUser}
              >
                {saving ? "Creating…" : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
