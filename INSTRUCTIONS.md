# Ultronic Build 2A — Database-Backed Team Roster

This patch replaces the hard-coded `Working as` names with the active rows from
the Supabase `team_members` table.

## Before deploying the code

Add this server-only environment variable in Vercel:

`SUPABASE_SECRET_KEY`

Use the Secret key from:

Supabase -> Project Settings -> API Keys -> Secret keys

Do not use a Publishable key for this variable.
Do not prefix it with NEXT_PUBLIC_.
Do not put the real value in GitHub.

Set it for Production and Preview.

## Copy these files into the repository

New:
- `app/api/team-members/route.ts`
- `lib/team-access-server.ts`
- `lib/supabase/admin.ts`

Replace:
- `components/current-user-provider.tsx`
- `components/profile-switcher.tsx`
- `lib/team-members.ts`
- `.env.example`

The rest of the app stays unchanged.

## Commit

Suggested message:

`Load team roster from Supabase`

Push to `main`.

## Test

After Vercel says Ready:

1. Open the app.
2. Enter the shared team access code if required.
3. Open the `Working as` dropdown.
4. It should contain the active `team_members` rows from Supabase, in sort order.
5. Select a name.
6. Refresh the page.
7. The selected person should remain selected on that browser.

The sample Kanban cards are still hard-coded in this patch. The next patch will
move Projects and Tasks into Supabase.
