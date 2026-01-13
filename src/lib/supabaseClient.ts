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

// STRICT Fair Distribution with Cooldown System
// - Level cooldown: After picking a level, wait 5 picks before picking it again
// - Room cooldown: After picking a room, wait (number of rooms in that level - 1) picks
function fairDistributionShuffle(students: Student[]): Student[] {
    if (students.length <= 2) return students;

    // Group students by level
    const byLevel: Map<string, Student[]> = new Map();
    for (const student of students) {
        const levelStudents = byLevel.get(student.level) || [];
        levelStudents.push(student);
        byLevel.set(student.level, levelStudents);
    }

    // Count unique rooms per level for room cooldown calculation
    const roomsPerLevel: Map<string, Set<string>> = new Map();
    for (const student of students) {
        const rooms = roomsPerLevel.get(student.level) || new Set();
        rooms.add(student.room);
        roomsPerLevel.set(student.level, rooms);
    }

    // Shuffle students within each level
    for (const [level, levelStudents] of byLevel.entries()) {
        byLevel.set(level, levelStudents.sort(() => Math.random() - 0.5));
    }

    const result: Student[] = [];

    // Cooldown tracking: level -> picks remaining until available
    const levelCooldown: Map<string, number> = new Map();
    // Room cooldown: "level-room" -> picks remaining until available  
    const roomCooldown: Map<string, number> = new Map();

    const LEVEL_COOLDOWN = 5; // Wait 5 picks before same level again

    while (result.length < students.length) {
        // Find all levels that have students and are not on cooldown
        let availableLevels: string[] = [];

        for (const [level, levelStudents] of byLevel.entries()) {
            if (levelStudents.length === 0) continue;

            const cooldown = levelCooldown.get(level) || 0;
            if (cooldown <= 0) {
                availableLevels.push(level);
            }
        }

        // If no levels available (all on cooldown), pick the one with lowest cooldown
        if (availableLevels.length === 0) {
            let minCooldown = Infinity;
            let bestLevel: string | null = null;

            for (const [level, levelStudents] of byLevel.entries()) {
                if (levelStudents.length === 0) continue;
                const cooldown = levelCooldown.get(level) || 0;
                if (cooldown < minCooldown) {
                    minCooldown = cooldown;
                    bestLevel = level;
                }
            }

            if (bestLevel) {
                availableLevels = [bestLevel];
            } else {
                break; // No more students
            }
        }

        // Shuffle available levels for randomness
        availableLevels.sort(() => Math.random() - 0.5);

        let selectedStudent: Student | null = null;
        let selectedLevel: string | null = null;

        // Try each available level
        for (const level of availableLevels) {
            const levelStudents = byLevel.get(level)!;
            const roomCount = roomsPerLevel.get(level)?.size || 1;
            const roomCooldownDuration = Math.max(roomCount - 1, 0);

            // Find students in this level whose rooms are not on cooldown
            let validStudents = levelStudents.filter(s => {
                const roomKey = `${level}-${s.room}`;
                const cooldown = roomCooldown.get(roomKey) || 0;
                return cooldown <= 0;
            });

            // Fallback: if all rooms on cooldown, pick the one with lowest cooldown
            if (validStudents.length === 0) {
                let minRoomCooldown = Infinity;
                let bestStudent: Student | null = null;

                for (const s of levelStudents) {
                    const roomKey = `${level}-${s.room}`;
                    const cooldown = roomCooldown.get(roomKey) || 0;
                    if (cooldown < minRoomCooldown) {
                        minRoomCooldown = cooldown;
                        bestStudent = s;
                    }
                }

                if (bestStudent) {
                    validStudents = [bestStudent];
                }
            }

            if (validStudents.length > 0) {
                // Pick randomly from valid students
                const randomIndex = Math.floor(Math.random() * validStudents.length);
                selectedStudent = validStudents[randomIndex];
                selectedLevel = level;
                break;
            }
        }

        if (!selectedStudent || !selectedLevel) {
            // Emergency fallback: just pick any remaining student
            for (const [level, levelStudents] of byLevel.entries()) {
                if (levelStudents.length > 0) {
                    selectedStudent = levelStudents[0];
                    selectedLevel = level;
                    break;
                }
            }
        }

        if (!selectedStudent || !selectedLevel) break;

        // Add to result
        result.push(selectedStudent);

        // Remove from level group
        const levelStudents = byLevel.get(selectedLevel)!;
        const idx = levelStudents.indexOf(selectedStudent);
        levelStudents.splice(idx, 1);

        // Set level cooldown (5 picks)
        levelCooldown.set(selectedLevel, LEVEL_COOLDOWN);

        // Set room cooldown (roomCount - 1 picks)
        const roomCount = roomsPerLevel.get(selectedLevel)?.size || 1;
        const roomKey = `${selectedLevel}-${selectedStudent.room}`;
        roomCooldown.set(roomKey, Math.max(roomCount - 1, 0));

        // Decrease all cooldowns by 1
        for (const [level, cd] of levelCooldown.entries()) {
            if (level !== selectedLevel) {
                levelCooldown.set(level, Math.max(cd - 1, 0));
            }
        }
        for (const [key, cd] of roomCooldown.entries()) {
            if (key !== roomKey) {
                roomCooldown.set(key, Math.max(cd - 1, 0));
            }
        }
    }

    return result;
}

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

    // DEBUG: Log what levels exist in the database
    const levelCounts = new Map<string, number>();
    for (const s of data) {
        levelCounts.set(s.level, (levelCounts.get(s.level) || 0) + 1);
    }
    console.log('📊 Available levels in database:', Object.fromEntries(levelCounts));

    // Use fair distribution shuffle
    const shuffled = fairDistributionShuffle(data);

    // DEBUG: Log the first 10 picks
    console.log('🎲 First 10 picks:', shuffled.slice(0, 10).map(s => `${s.level}/${s.room}`));

    return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Get random candidates filtered by level (e.g., "1", "2", etc.)
// Uses smart shuffle to avoid consecutive same room
export async function getRandomCandidatesByLevel(level: string, count: number = 10): Promise<Student[]> {
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('is_winner', false)
        .eq('level', level);

    if (error) {
        console.error('Error fetching candidates by level:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Use smart shuffle for fair room distribution
    const shuffled = fairDistributionShuffle(data);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Get count of non-winners by level
export async function getRemainingCountByLevel(level: string): Promise<number> {
    const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('is_winner', false)
        .eq('level', level);

    if (error) {
        console.error('Error getting remaining count by level:', error);
        return 0;
    }
    return count || 0;
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
