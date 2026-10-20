// Variáveis do Vercel lidas igual pelas três funções de api/.
export const SUPABASE_URL = process.env.SUPABASE_URL || "https://hbmkgakzrqmdlsvszjeo.supabase.co";
export const N8N_URL = process.env.N8N_URL || "https://encorpa-fashion.pikapod.net";
export const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
export const NO_KEY = "Falta a variável SUPABASE_SERVICE_ROLE_KEY no Vercel.";
