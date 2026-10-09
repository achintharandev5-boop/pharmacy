# Supabase Setup

This guide explains how to apply the database migrations and seeds to a real Supabase project.

## Prerequisites
1. Install the Supabase CLI:
   ``bash
   npm install -g supabase
   ``n
2. Login to your Supabase account:
   ``bash
   supabase login
   ``n
## Apply Migrations

1. Link your local project to your Supabase project (you can find the project reference ID in your project settings):
   ``bash
   cd apps/api
   supabase link --project-ref <your-project-ref-id>
   ``n
2. Push the migrations to the remote database:
   ``bash
   supabase db push
   ``n
## Seed Data (Optional)

If you want to push the seed data to your remote project, you can run:
``bash
supabase db execute --file supabase/seed.sql
``n
