# Ultronic Build 2B — Real Projects

This build makes the Projects page database-backed and makes `+ New Project`
functional.

It also includes the SQL seed for the four first real projects and their first
tasks.

## Step 1 — Run the SQL seed in Supabase

Open:

Supabase -> SQL Editor -> New Query

Paste the contents of:

`supabase/migrations/002_initial_projects_and_tasks.sql`

Click Run.

Expected projects:
- STEM Tent
- FLL Tutor
- Fundraising
- Professional Demo

Professional Demo has no project target date on purpose. The two outreach tasks
under it each have their own deadline.

## Step 2 — Copy the app patch

Copy these into the root of your real repository:

New:
- `app/api/projects/route.ts`
- `app/projects/projects.module.css`

Replace:
- `app/projects/page.tsx`

No new Vercel environment variables are needed. This build reuses:
- TEAM_ACCESS_CODE
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SECRET_KEY

## Step 3 — Commit

Suggested message:

`Connect Projects to Supabase`

Push to main and wait for Vercel to show Ready.

## Step 4 — Test

Open Projects.

You should see the four database projects instead of the old sample projects.

The cards should show:
- real lead
- real target date
- real task count
- calculated completion percentage
- blocked/review counts when applicable

Click `+ New Project`.

Create a test project or a real project. It should appear after creation
without editing Supabase manually.

## Note about progress

For now:

`progress = completed tasks / total active tasks`

When a project has zero tasks, progress is 0%.

Later we can optionally add weighted progress if some tasks are much larger
than others.
