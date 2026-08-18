# Ultronic Build 2P — Edit Projects

The Projects cards previously displayed data but were not editable.

This build makes every project card clickable.

## What you can edit

- Project Name
- Description
- Division: Technical / Operational / Both
- Status: Planning / Active / Paused / Completed
- Project Lead
- Target Date

This works for BOTH:
- current projects
- historical projects imported from Hours Tracking

Editing a historical project's project record does NOT alter the underlying
historical hours/activity records.

## INSTALL

REPLACE:

- `app/projects/page.tsx`
- `app/projects/projects.module.css`
- `app/api/projects/route.ts`

No Supabase migration.
No new environment variables.

## USE

1. Select yourself under Working As.
2. Open Projects.
3. Click any project card.
4. Edit Project opens.
5. Make changes.
6. Click Save Changes.

The project card refreshes immediately after the save.

## COMMIT

Suggested commit:

`Add project editing`

Commit to main -> Push origin -> wait for Vercel Ready -> hard refresh.
