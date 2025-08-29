// supabaseClient.js
// Initializes Supabase client and provides auth helpers for a static site.
// Reads Supabase URL and anon key from environment variables injected at build time.

// These should be replaced at build time or injected by your static host (e.g., Netlify, Vercel)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || window.env?.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || window.env?.SUPABASE_ANON_KEY || "";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Disable auto-refresh so sessions expire after 1 hour
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
    // Set token expiry to 1 hour (3600 seconds)
    // This is enforced by your Supabase project settings, but we can hint here
    // (Supabase JS will respect the server's expiry)
    // No service role key is ever exposed here
  },
});

export function signUpWithEmail(email, password) {
  // Returns a promise
  return supabase.auth.signUp({ email, password });
}

export function signInWithEmail(email, password) {
  // Returns a promise
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

export function getSession() {
  return supabase.auth.getSession();
}

export { supabase };
