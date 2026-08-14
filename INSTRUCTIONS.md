# Ultronic Build 2D — Real Weekly Capacity Planning

This build implements the capacity model we agreed on:

- Task Estimate = total expected effort for the whole task
- Weekly Capacity = how many hours a person can give the team that week
- Planned Hours = how many hours that specific person plans to spend on that task that week
- Remaining Capacity = Available - Planned

This means a six-hour task can be planned like:
- Natalie: 1 hr this week
- Ben: 3 hrs this week
- Colton: 2 hrs this week

and a multi-week task can be split across different weeks.

## Step 1 — Run the SQL migration in Supabase

Open:

Supabase -> SQL Editor -> New Query

Copy and run:

`supabase/migrations/003_capacity_planning.sql`

It creates:

- `weekly_capacity`
- `task_weekly_plans`

The second table is tied to `task_assignments`, so someone can only plan hours
against a task they are actually assigned to.

Expected result at the bottom:
- task_weekly_plans
- weekly_capacity

## Step 2 — Copy the code patch into your repository

NEW:
- `app/api/capacity/route.ts`
- `app/capacity/capacity.module.css`

REPLACE:
- `app/capacity/page.tsx`
- `app/page.tsx`

The replacement `app/page.tsx` preserves the clickable task-card detail view
and also makes the Team Board capacity summary use real weekly capacity data.

## Step 3 — Commit and deploy

Suggested GitHub Desktop commit:

`Add real weekly capacity planning`

Commit to main -> Push origin.

Wait for Vercel to show Ready.

## Step 4 — Test Capacity

1. Select yourself under Working As.
2. Open Capacity.
3. The current week should default to Monday of the current week.
4. Click `Update My Capacity`.
5. Enter how many hours you can give the team this week.
6. For each task assigned to you, enter your planned hours for this week.
7. Save.

The team table will calculate:
- Available
- Planned
- Remaining
- Unplanned assigned tasks
- Workload percentage
- Who is over capacity

Use the arrows next to the week to plan another week.

## Important behavior

If an assigned task has no planned hours for the selected week, it is counted
as `Unplanned` instead of silently disappearing from workload.

If an assigned task has no total task estimate, the page also flags it as
`Unestimated`.

This is intentional so the capacity dashboard never looks artificially empty
just because planning data is missing.

## Team Board

The Team Board capacity card now uses the current week's real totals:
- Available
- Planned
- Remaining
- Count over capacity when applicable

No new Vercel environment variables are needed.
