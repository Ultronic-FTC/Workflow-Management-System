# Ultronic Build 2J — Real Project Creation

This fixes the Projects page itself.

The reason the + New Project button was visible but did nothing is that the
current `app/projects/page.tsx` is still the original static prototype. The
button literally had no onClick handler.

This patch replaces that prototype with the real Supabase-backed Projects page.

## What changes

- + New Project opens a real creation form
- New projects are POSTed to the existing `/api/projects` endpoint
- The Projects page now loads the real `projects` table instead of the eight
  hard-coded sample projects
- Real task counts, blocked counts, review counts, progress, project lead, and
  target dates are displayed
- Technical / Operational filters work
- Project Lead uses the real Ultronic roster

No Supabase migration is required because the existing Projects API and table
already support project creation.

## INSTALL

REPLACE:
- `app/projects/page.tsx`

NEW:
- `app/projects/projects.module.css`

Do not change `app/api/projects/route.ts`. Your existing API already supports
both GET and POST.

## COMMIT

Suggested commit:

`Connect Projects page to Supabase`

Commit to main -> Push origin -> wait for Vercel Ready -> hard refresh.

## TEST

1. Select yourself under Working As.
2. Open Projects.
3. Click + New Project.
4. Create a harmless test project.
5. It should appear immediately in the real project grid.
6. It will also become available in the Project dropdown when creating/editing
   tasks because both features use the same `projects` table.

Important: once this patch is installed, the old fake cards such as Intake,
Autonomous, Drive Practice, Website, etc. disappear unless those projects
actually exist in Supabase.
