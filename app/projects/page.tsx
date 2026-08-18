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
  live_task_count: number;
  completed_count: number;
  blocked_count: number;
  review_count: number;
  progress: number;
  historical_activity_count: number;
  historical_hours: number;
  historical_only: boolean;
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

  const canDeleteProject =
    currentUser != null &&
    ["captain", "mentor", "coach"].includes(currentUser.role);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [divisionFilter, setDivisionFilter] =
    useState<DivisionFilter>("all");
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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

    const statusRank = (project: Project) => {
      if (project.status === "active") return 0;
      if (project.status === "planning") return 1;
      if (project.status === "paused") return 2;
      return 3;
    };

    return [...filtered].sort((a, b) => {
      const statusDifference = statusRank(a) - statusRank(b);
      if (statusDifference !== 0) return statusDifference;

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
    setEditingProject(null);
    setShowNewProject(true);
  }

  function openEditProject(project: Project) {
    setName(project.name);
    setDescription(project.description ?? "");
    setDivision(project.division);
    setStatus(project.status);
    setLeadMemberId(project.lead_member_id ?? "");
    setTargetDate(project.target_date ?? "");
    setFormError("");
    setEditingProject(project);
  }

  async function deleteProject() {
    if (!editingProject) return;

    if (!currentUser) {
      setFormError(
        "Select yourself under Working As before deleting a project."
      );
      return;
    }

    if (!canDeleteProject) {
      setFormError(
        "Only a captain, mentor, or coach can permanently delete a project."
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${editingProject.name}"?\n\n` +
        "This removes the project record from the Projects tab.\n\n" +
        "Historical spreadsheet hours are NOT deleted.\n\n" +
        "If the project still has live tasks, deletion will be blocked."
    );

    if (!confirmed) return;

    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingProject.id,
          actor_member_id: currentUser.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete project.");
      }

      setEditingProject(null);
      resetForm();
      await loadProjects();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to delete project."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();

    if (!currentUser) {
      setFormError(
        `Select yourself under Working As before ${
          editingProject ? "editing" : "creating"
        } a project.`
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
        method: editingProject ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(editingProject ? { id: editingProject.id } : {}),
          name: name.trim(),
          description: description.trim() || null,
          division,
          status,
          lead_member_id: leadMemberId || null,
          target_date: targetDate || null,
          ...(editingProject
            ? { actor_member_id: currentUser.id }
            : { created_by_member_id: currentUser.id }),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ??
            `Unable to ${editingProject ? "update" : "create"} project.`
        );
      }

      setShowNewProject(false);
      setEditingProject(null);
      resetForm();
      await loadProjects();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : `Unable to ${editingProject ? "update" : "create"} project.`
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
                className={`project-card ${styles.editableProjectCard} ${
                  visualDivision === "operational"
                    ? "operational"
                    : visualDivision === "both"
                      ? styles.bothProject
                      : ""
                }`}
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => openEditProject(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEditProject(project);
                  }
                }}
                title="Click to edit project"
              >
                <div className="project-top">
                  <span>{titleCase(project.division)}</span>
                  <div className={styles.projectTopRight}>
                    <small>EDIT</small>
                  </div>
                </div>

                <h2>{project.name}</h2>

                {project.description && (
                  <p className={styles.description}>{project.description}</p>
                )}

                <div className="project-stats">
                  <span>
                    {project.historical_only
                      ? `${project.task_count} completed activit${
                          project.task_count === 1 ? "y" : "ies"
                        }`
                      : `${project.task_count} task${
                          project.task_count === 1 ? "" : "s"
                        }`}
                  </span>
                  <span>
                    {project.historical_only
                      ? `${project.historical_hours.toFixed(
                          Number.isInteger(project.historical_hours) ? 0 : 1
                        )} hrs`
                      : riskText}
                  </span>
                </div>

                {project.historical_activity_count > 0 &&
                  !project.historical_only && (
                    <div className={styles.historyStrip}>
                      HISTORY · {project.historical_activity_count} activit
                      {project.historical_activity_count === 1 ? "y" : "ies"} ·{" "}
                      {project.historical_hours.toFixed(
                        Number.isInteger(project.historical_hours) ? 0 : 1
                      )}{" "}
                      hrs
                    </div>
                  )}

                <div className={styles.projectMeta}>
                  <span>
                    Lead: <strong>{project.lead_name ?? "Unassigned"}</strong>
                  </span>
                  <span className={styles.status}>
                    {titleCase(project.status)}
                  </span>
                </div>

                <footer>
                  {project.historical_only ? "Last activity" : "Target"}:{" "}
                  {formatTargetDate(project.target_date)}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {(showNewProject || editingProject) && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !saving) {
              setShowNewProject(false);
              setEditingProject(null);
            }
          }}
        >
          <form
            className={styles.modal}
            onSubmit={saveProject}
            aria-label={editingProject ? "Edit project" : "Create new project"}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className="eyebrow">
                  {editingProject ? "EDIT WORKSTREAM" : "NEW WORKSTREAM"}
                </p>
                <h2>{editingProject ? "Edit Project" : "Create Project"}</h2>
                <p>
                  {editingProject
                    ? "Update this project's name, owner, dates, status, or description."
                    : "Projects group related tasks into a major body of team work."}
                </p>
              </div>

              <button
                type="button"
                className={styles.close}
                onClick={() => {
                  setShowNewProject(false);
                  setEditingProject(null);
                  resetForm();
                }}
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
              <div className={styles.actionLeft}>
                {editingProject && canDeleteProject && (
                  <button
                    className={styles.deleteProject}
                    type="button"
                    onClick={deleteProject}
                    disabled={saving}
                  >
                    Delete Project
                  </button>
                )}
              </div>

              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setShowNewProject(false);
                  setEditingProject(null);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={saving || !currentUser}
              >
                {saving
                  ? editingProject
                    ? "Saving…"
                    : "Creating…"
                  : editingProject
                    ? "Save Changes"
                    : "Create Project"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
