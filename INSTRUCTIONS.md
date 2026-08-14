# Ultronic Simplified Access Patch

This patch removes individual Supabase authentication from the user experience.

New flow:

1. Enter one shared **Team Access Code**.
2. Choose your name from **Working as** in the header.
3. The browser remembers the selected person.
4. **My Tasks** filters to that selected person.

This is intentionally a trust-based team identity model. Selecting a name is not proof that the person is really that person.

## 1. Copy / replace these files

Copy the folders and files from this patch into the root of your real `Workflow-Management-System` repository and choose **Replace** when macOS asks.

New files:
- `app/access/page.tsx`
- `app/api/access/route.ts`
- `app/api/access/signout/route.ts`
- `components/current-user-provider.tsx`
- `components/profile-switcher.tsx`
- `lib/access.ts`
- `lib/team-members.ts`

Replace:
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `components/app-shell.tsx`
- `proxy.ts`
- `.env.example`

## 2. Delete the old authentication files/folders

Delete these from the repository:

- `app/login/`
- `app/auth/`
- `lib/supabase/proxy.ts`

Keep:
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`

We still need Supabase for the database in the next build.

## 3. Add the shared code in Vercel

In Vercel:

**Project → Settings → Environment Variables**

Add:

`TEAM_ACCESS_CODE`

Choose a team code that is not easy to guess. Example format:

`Ultronic-8472-Workflow`

Do NOT name it `NEXT_PUBLIC_TEAM_ACCESS_CODE`.

Set it for Production and Preview.

Your existing Supabase URL and publishable key can stay exactly as they are.

## 4. Optional local setup

If you run the project on your Mac, add this line to `.env.local`:

`TEAM_ACCESS_CODE=your-real-team-code`

Do not commit `.env.local`.

## 5. Edit the temporary team list

For now, names are stored in:

`lib/team-members.ts`

Update that file to match the people you want in the dropdown.

This is temporary. The next database build will move team members into Supabase.

## 6. Commit and push

Suggested commit message:

`Replace individual auth with shared team access`

Push to `main`.

Vercel should deploy automatically.

## 7. Test

When the deployment is Ready:

1. Open the live Vercel URL in a private/incognito window.
2. You should be sent to `/access`.
3. Enter the shared code.
4. You should land on Team Board.
5. Choose a name under **Working as**.
6. Click **My Tasks**.
7. The board should filter to tasks whose Lead matches that selected person.

## Security note

This removes individual authentication on purpose. The shared access code keeps casual outside visitors out, but the selected identity is trust-based.

When we connect real task data in the next build, database writes should go through protected server routes using the shared-access cookie rather than exposing unrestricted anonymous writes directly from the browser.
