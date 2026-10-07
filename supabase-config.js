// supabase-config.js
// Initialise Supabase pour toute l'app (Auth + base de données).
// Importé automatiquement par les fichiers qui en ont besoin (auth.js, etc.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wgjaaxtbjjiwaqbonuro.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GI9GhSYaCHWGKWSP4OaGQw_5wgOOnJW";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
