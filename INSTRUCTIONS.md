# Clickable Task Cards

This patch makes each Kanban task card clickable.

Copy into your real Workflow-Management-System repository and replace:

- app/page.tsx
- app/team-board.module.css

Commit message suggestion:

`Make task cards clickable`

After Vercel deploys, clicking any task card opens a Task Details modal showing:
- project
- category
- status
- priority
- description
- lead
- point of contact
- people needed / assigned
- assignees
- estimate
- deadline
- difficulty

This patch is read-only task detail. Editing, self-assignment, status changes, time logging,
subtasks, and approval workflow can be added in the next task-management build.
