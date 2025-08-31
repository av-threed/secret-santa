import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm'

const SUPABASE_URL = 'https://icdxxlirmwhbehqqrhot.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZHh4bGlybXdoYmVocXFyaG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0Mzk5NTEsImV4cCI6MjA3MjAxNTk1MX0.VN6nr8wFdUe16nB5f7nzwC7iOcbwgBIcnsM7nLFRWhY'

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Interface for working with gifts
export async function getMyGifts() {
    const { data, error } = await supabase
        .from('gifts')
        .select('*')
        .eq('user_id', supabase.auth.user().id)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export async function addGiftToList(giftData) {
    const { data, error } = await supabase
        .from('gifts')
        .insert([{
            ...giftData,
            user_id: supabase.auth.user().id
        }])

    if (error) throw error
    return data
}

export async function deleteGift(giftId) {
    const { error } = await supabase
        .from('gifts')
        .delete()
        .match({ id: giftId, user_id: supabase.auth.user().id })

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
    const { data, error } = await supabase
        .from('kid_gifts')
        .select(`
            *,
            kids (
                name
            )
        `)
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export async function addKidGift(kidId, giftData) {
    const { data, error } = await supabase
        .from('kid_gifts')
        .insert([{
            ...giftData,
            kid_id: kidId
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
export function getCurrentUser() {
    return supabase.auth.user()
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
