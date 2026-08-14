# Ultronic Team Manager — Starter

Build 1 of the FTC team work-management application.

## What is included
- Next.js + TypeScript application shell
- Ultronic-inspired dark/red/cyan visual system
- Team Board mockup
- Projects mockup
- Capacity mockup
- Ideas & Decisions mockup
- Supabase browser/server client foundation
- Magic-link login screen
- `.env.example`
- migration folder ready for the real database schema

The dashboard currently uses **mock data on purpose**. The next build will replace this with Supabase tables and real CRUD operations.

## 1. Install Node.js
Use a current supported Node.js version from https://nodejs.org/.

## 2. Create local environment settings
Copy `.env.example` to `.env.local` and replace the placeholder values with your Supabase Project URL and Publishable Key.

```bash
cp .env.example .env.local
```

Do not commit `.env.local` to GitHub.

## 3. Install dependencies
```bash
npm install
```

## 4. Run locally
```bash
npm run dev
```
Open http://localhost:3000

## 5. Push to GitHub
From inside this folder:

```bash
git init
git add .
git commit -m "Build 1: application foundation"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

If the GitHub repository already has a README or other commit, use GitHub Desktop instead or pull before pushing.

## 6. Deploy with Vercel
Import the `ultronic-team-manager` GitHub repository into Vercel.

Before deployment, add these environment variables in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Then deploy.

## Important
Do **not** add Supabase secret/service-role keys to client-side environment variables or commit them to GitHub.

## Next milestone
Build 2 will create the actual database schema for users, categories, projects, tasks, assignments, subtasks, capacity, time entries, comments, activity, ideas, decisions, dependencies, and evidence references.
