import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm'

const SUPABASE_URL = 'https://icdxxlirmwhbehqqrhot.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZHh4bGlybXdoYmVocXFyaG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0Mzk5NTEsImV4cCI6MjA3MjAxNTk1MX0.VN6nr8wFdUe16nB5f7nzwC7iOcbwgBIcnsM7nLFRWhY'

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Interface for working with gifts
export async function getMyGifts() {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    const userId = userData?.user?.id
    if (!userId) return []

    const { data, error } = await supabase
        .from('gifts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export async function addGiftToList(giftData) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    const userId = userData?.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data, error } = await supabase
        .from('gifts')
        .insert([{ ...giftData, user_id: userId }])

    if (error) throw error
    return data
}

export async function deleteGift(giftId) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    const userId = userData?.user?.id
    if (!userId) throw new Error('Not signed in')

    const { error } = await supabase
        .from('gifts')
        .delete()
        .match({ id: giftId, user_id: userId })

    if (error) throw error
}

// Interface for working with kids and their gifts
export async function getKids() {
    const { data, error } = await supabase
        .from('kids')
        .select('*')
        .order('name')

    if (error) throw error
    return data
}

export async function getKidGifts(kidId) {
    // Try with relation; if that fails (e.g., metadata mismatch), fall back to simple select
    let query = supabase.from('kid_gifts')
        .select('*, kids(name)')
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false });
    let { data, error } = await query;
    if (error) {
        // Fallback without join
        const res = await supabase
            .from('kid_gifts')
            .select('*')
            .eq('kid_id', kidId)
            .order('created_at', { ascending: false });
        if (res.error) throw res.error;
        return res.data;
    }
    return data;
}

export async function findOrCreateKid(kidName) {
    const normalized = kidName.trim();
    if (!normalized) throw new Error('Kid name required');

    // Try to find existing (case-insensitive)
    const { data: existing, error: findError } = await supabase
        .from('kids')
        .select('*')
        .ilike('name', normalized)
        .limit(1);
    if (findError) throw findError;
    if (existing && existing.length > 0) return existing[0];

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error('Not signed in');

    const { data, error } = await supabase
        .from('kids')
        .insert([{ name: normalized, created_by: userId }])
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function addKidGift(kidId, giftData) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    const userId = userData?.user?.id
    if (!userId) throw new Error('Not signed in')

    const { data, error } = await supabase
        .from('kid_gifts')
        .insert([{
            ...giftData,
            kid_id: kidId,
            created_by: userId
        }])

    if (error) throw error
    return data
}

export async function deleteKidGift(giftId) {
    const { error } = await supabase
        .from('kid_gifts')
        .delete()
        .match({ id: giftId })

    if (error) throw error
}

// User session management
export async function getCurrentUser() {
    const { data } = await supabase.auth.getUser()
    return data?.user || null
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
}

export async function signInWithEmail(email) {
    const { user, error } = await supabase.auth.signIn({ email })
    if (error) throw error
    return user
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
}

// App helpers for Secret Santa assignment flow
export async function getCurrentYear() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'current_year')
        .limit(1)
        .single();
    if (!error && data?.value) return parseInt(data.value, 10);
    return new Date().getFullYear();
}

export async function getRecipientForBuyer() {
    const year = await getCurrentYear();
    const { data: userData } = await supabase.auth.getUser();
    const buyerId = userData?.user?.id;
    if (!buyerId) throw new Error('Not signed in');

    const { data, error } = await supabase
        .from('assignments')
        .select('recipient_user_id')
        .eq('buyer_user_id', buyerId)
        .eq('year', year)
        .limit(1)
        .single();
    if (error) return null;
    return data?.recipient_user_id || null;
}

export async function getUserGifts(userId) {
    const { data, error } = await supabase
        .from('gifts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .limit(1)
        .single();
    if (error) return { full_name: null };
    return data || { full_name: null };
}

// Claimed kid gifts for the current user across all kids (supports pagination)
export async function getMyClaimedKidGifts({ from = 0, limit = 50 } = {}) {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData?.user?.id;
    if (!me) return [];
    const to = Math.max(0, from + limit - 1);
    // Try relational select to include kid names; fall back if needed
    let { data, error } = await supabase
        .from('kid_gifts')
        .select('id, name, link, notes, price, kid_id, claimed_by, claimed_at, kids(name)')
        .eq('claimed_by', me)
        .order('claimed_at', { ascending: false })
        .range(from, to);
    let rows = data || [];
    if (error) {
        const res = await supabase
            .from('kid_gifts')
            .select('id, name, link, notes, price, kid_id, claimed_by, claimed_at')
            .eq('claimed_by', me)
            .order('claimed_at', { ascending: false })
            .range(from, to);
        if (res.error) throw res.error;
        rows = res.data || [];
    }

    // Ensure we always return the kid's name for display even if the relation isn't present
    try {
        const missingKidNames = rows.some(g => !(g?.kids && g.kids.name));
        if (missingKidNames) {
            const uniqueKidIds = Array.from(new Set(rows.map(g => g.kid_id).filter(Boolean)));
            if (uniqueKidIds.length > 0) {
                const { data: kidRows, error: kidErr } = await supabase
                    .from('kids')
                    .select('id, name')
                    .in('id', uniqueKidIds);
                if (!kidErr && kidRows) {
                    const idToName = Object.fromEntries(kidRows.map(k => [k.id, k.name]));
                    rows = rows.map(g => {
                        const kidName = g?.kids?.name || idToName[g.kid_id] || null;
                        return kidName ? { ...g, kid_name: kidName, kids: g.kids || { name: kidName } } : g;
                    });
                }
            }
        }
    } catch (_) { /* best-effort enrichment */ }

    return rows;
}

// Recipient self-serve helpers
export async function isAssignmentsLocked() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'lock_assignments')
        .limit(1)
        .single();
    if (error) return false;
    return String(data?.value || '').toLowerCase() === 'true';
}

export async function listProfilesExcludingSelf() {
    const { data: userData } = await supabase.auth.getUser();
    const me = userData?.user?.id;
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .neq('id', me)
        .order('full_name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function upsertMyRecipient(recipientUserId) {
    const year = await getCurrentYear();
    const { data: userData } = await supabase.auth.getUser();
    const buyerId = userData?.user?.id;
    if (!buyerId) throw new Error('Not signed in');

    const payload = [{ year, buyer_user_id: buyerId, recipient_user_id: recipientUserId }];
    const { data, error } = await supabase
        .from('assignments')
        .upsert(payload, { onConflict: 'year,buyer_user_id' });
    if (error) throw error;
    return data;
}

// Admin helpers
export async function inviteUser(email, fullName) {
    const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, fullName }
    });
    if (error) throw error;
    return data;
}

export function cleanAuthHash() {
    try {
        const url = new URL(window.location.href);
        if (url.hash && /access_token|refresh_token|provider_token|type=/.test(url.hash)) {
            history.replaceState({}, document.title, url.pathname + url.search);
        }
    } catch {}
}

export function initAuthRouteGuards() {
    try {
        // Scrub immediately on load in case a user copies a tokenized URL
        cleanAuthHash();
        // Scrub again when Supabase finishes processing a magic/invite link
        supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') cleanAuthHash();
        });
    } catch {}
}
