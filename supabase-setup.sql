-- ============================================
-- CAT SITTING — Configuration Supabase
-- À exécuter dans Supabase : SQL Editor → New query → coller tout → Run
-- ============================================

-- Table qui stocke toutes les données de l'app (une ligne par compte)
create table if not exists cat_sitting_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  profiles jsonb not null default '{}'::jsonb,
  calevents jsonb not null default '{}'::jsonb,
  tarifs jsonb not null default '{}'::jsonb,
  animalcolors jsonb not null default '{}'::jsonb,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Si la table existait déjà (mise à jour), ajoute la colonne manquante :
alter table cat_sitting_data add column if not exists prefs jsonb not null default '{}'::jsonb;

-- Active la sécurité au niveau des lignes
alter table cat_sitting_data enable row level security;

-- Tout utilisateur connecté peut LIRE toutes les lignes
-- (nécessaire pour que la page admin puisse voir tous les comptes)
create policy "Authenticated users can read all rows"
  on cat_sitting_data for select
  to authenticated
  using (true);

-- Un utilisateur ne peut créer QUE sa propre ligne
create policy "Users can insert their own row"
  on cat_sitting_data for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Un utilisateur ne peut modifier QUE sa propre ligne
create policy "Users can update their own row"
  on cat_sitting_data for update
  to authenticated
  using (auth.uid() = user_id);
