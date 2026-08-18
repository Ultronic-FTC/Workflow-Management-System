# Ultronic Build 3A — Calendar Uses Actual Work Date

For completed tasks, the Operational Calendar now places the task on the date
the work was actually finished, not on the task's deadline/closure timing.

## How "work completed" is determined

For a completed task, the calendar uses the LATEST date in Actual Time /
Time History for that task.

Example:

- Task deadline / closed: Aug 18
- Natalie logged work: Aug 15
- Alejandro logged work: Aug 15
- Liev logged work: Aug 15

Calendar displays the completed task on Aug 15.

If work was logged on Aug 14 and Aug 15, the task appears on Aug 15 because
that is the last date work was performed.

## Fallback

If a completed task has no Actual Time entries at all, the calendar falls back
to the task deadline so it does not disappear.

Open tasks still appear on their deadline as before.

## REPLACE ONLY

- `app/api/tasks/route.ts`
- `app/operational-calendar/page.tsx`

No Supabase migration.
No CSS changes.
Do not replace `app/api/tasks/[id]/route.ts`.

## COMMIT

Suggested commit:

`Use actual work date on calendar`

Push to main -> wait for Vercel Ready -> hard refresh Operational Calendar.
