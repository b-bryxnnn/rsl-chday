import { createClient } from '@supabase/supabase-js';

// Types for our database
export interface Student {
    id: number;
    level: string;
    room: string;
    number: string;
    name: string;
    is_winner: boolean;
}

// Supabase client configuration
// Supabase client configuration
// Use placeholder values during build time to prevent errors
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_project_url';

// Only show warning in browser if env vars are missing
if (typeof window !== 'undefined' && !isConfigured) {
    console.warn('Supabase environment variables missing or default. App will act as unconnected.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper functions for database operations
export async function getRandomCandidates(count: number = 10): Promise<Student[]> {
    // Get all non-winners
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_winner', false);

    if (error) {
        console.error('Error fetching candidates:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Shuffle and pick random candidates
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

export async function markAsWinner(studentId: number): Promise<boolean> {
    const { error } = await supabase
        .from('students')
        .update({ is_winner: true })
        .eq('id', studentId);

    if (error) {
        console.error('Error marking winner:', error);
        return false;
    }
    return true;
}

export async function resetAllWinners(): Promise<boolean> {
    const { error } = await supabase
        .from('students')
        .update({ is_winner: false })
        .neq('id', 0); // Update all rows

    if (error) {
        console.error('Error resetting winners:', error);
        return false;
    }
    return true;
}

export async function getTotalStudentCount(): Promise<number> {
    const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error getting count:', error);
        return 0;
    }
    return count || 0;
}

export async function getWinnerCount(): Promise<number> {
    const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_winner', true);

    if (error) {
        console.error('Error getting winner count:', error);
        return 0;
    }
    return count || 0;
}

export async function deleteAllStudents(): Promise<boolean> {
    const { error } = await supabase
        .from('students')
        .delete()
        .neq('id', 0); // Delete all rows

    if (error) {
        console.error('Error deleting students:', error);
        return false;
    }
    return true;
}

export async function insertStudents(students: Omit<Student, 'id' | 'is_winner'>[]): Promise<boolean> {
    const { error } = await supabase
        .from('students')
        .insert(students.map(s => ({ ...s, is_winner: false })));

    if (error) {
        console.error('Error inserting students:', error);
        return false;
    }
    return true;
}
