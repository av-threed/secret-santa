# Supabase setup for Link Previews (Dev)

## Prereqs
- Install CLI: `npm i -g supabase`
- Login: `supabase login`
- Get your Project Ref from Dashboard → Settings → General
- Link this directory to your project: `supabase link --project-ref <YOUR_PROJECT_REF>`

## Create Edge Function
```bash
supabase functions new link-preview
```
Replace `supabase/functions/link-preview/index.ts` with the function code I provided in chat.

## Local testing
```bash
npm run supabase:serve
```
Open your dev page at http://localhost:8080 and paste a link. Cards will upgrade with preview image/title.

## Deploy
```bash
npm run supabase:deploy
```

## Optional server-side cache table
Run this SQL in the SQL editor (or `psql`):
```sql
create table if not exists link_previews (
  normalized_url text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists link_previews_fetched_at_idx on link_previews (fetched_at desc);
```

If you want the Edge Function to upsert into this table, add the service role key as a secret and I’ll extend the function code accordingly.
