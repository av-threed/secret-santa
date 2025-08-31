// auth.js
import { supabase } from './supabase.js';

export async function handleSignUp(email, password, fullName) {
    console.log('Starting signup process...'); // Debug log
    
    try {
        if (!email || !password || !fullName) {
            throw new Error('Email, password, and full name are required');
        }

        console.log('Attempting to create auth user...'); // Debug log
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) {
            console.error('Supabase auth error:', error); // Debug log
            throw error;
        }

        console.log('Auth user created successfully:', data); // Debug log
        // Removed manual insert into profiles table
        return { data, error: null };
    } catch (error) {
        console.error('Error in handleSignUp:', error);
        return { data: null, error };
    }
}

export async function handleSignIn(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error in handleSignIn:', error);
        return { data: null, error };
    }
}

export async function handleSignOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { error: null };
    } catch (error) {
        console.error('Error in handleSignOut:', error);
        return { error };
    }
}
