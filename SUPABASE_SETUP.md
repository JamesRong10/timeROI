# Supabase setup (TimeROI)

## 1) Create tables + RLS policies

Pick one approach:

### Option A (recommended): Supabase CLI migrations

This repo includes a migration at `supabase/migrations/20260414200000_init.sql`.

```bash
# install supabase CLI if you don't have it
# https://supabase.com/docs/guides/cli

npm run supabase:login
npm run supabase:link -- --project-ref <your-project-ref>
npm run supabase:push
```

### Option B: SQL editor

If you don't want to use the CLI, copy/paste the migration file into the Supabase SQL editor and run it:
- `supabase/migrations/20260414200000_init.sql`

## 2) Configure client env vars

Set these values for the Expo app:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Security note (important)

- The Supabase **anon** key is designed to be used in client apps and can be extracted from a built app. This is OK.
- Never put **service_role** keys, database passwords, or private keys in the mobile/web app.
- Your real data protection must come from **Row Level Security (RLS)** and policies (see the migration SQL).

## 3) Supabase Auth settings

In Supabase Dashboard:
- Enable Email auth.
- Decide whether you require email confirmation. If confirmation is enabled, sign-up won’t immediately log the user in.

## Notes

- `profiles` rows are created automatically via a database trigger on `auth.users` (see the SQL).
