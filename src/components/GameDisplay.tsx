'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, SkipForward, RefreshCw, Users, Sparkles, Trophy, Gift } from 'lucide-react';
import { Student, getRandomCandidates, getRandomCandidatesByLevel, markAsWinner } from '@/lib/supabaseClient';

// Scramble characters for the decrypt effect
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>[]{}';
const THAI_SCRAMBLE = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';

// ระดับชั้น 1-6
const LEVELS = ['1', '2', '3', '4', '5', '6'];

type RevealStage = 0 | 1 | 2 | 3 | 4;
type DrawMode = 'all' | 'by-level';

export default function GameDisplay() {
    const [candidates, setCandidates] = useState<Student[]>([]);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [revealStage, setRevealStage] = useState<RevealStage>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Mode selection state
    const [drawMode, setDrawMode] = useState<DrawMode>('all');
    const [selectedLevel, setSelectedLevel] = useState<string>('1');

    const [scrambledTexts, setScrambledTexts] = useState({
        level: '',
        room: '',
        number: '',
        name: '',
    });
    const scrambleIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const currentStudent = candidates[currentIndex];
    const waitingStudents = candidates.slice(currentIndex + 1);

    // Generate scrambled text
    const generateScramble = useCallback((length: number, useThai: boolean = false): string => {
        const chars = useThai ? THAI_SCRAMBLE : SCRAMBLE_CHARS;
        return Array.from({ length: Math.max(length, 5) }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join('');
    }, []);

    // Update scrambled texts
    const updateScrambledTexts = useCallback(() => {
        if (currentStudent) {
            setScrambledTexts({
                level: generateScramble(currentStudent.level.length),
                room: generateScramble(currentStudent.room.length),
                number: generateScramble(currentStudent.number.length),
                name: generateScramble(currentStudent.name.length, true),
            });
        }
    }, [currentStudent, generateScramble]);

    // Start scramble animation
    useEffect(() => {
        if (currentStudent && revealStage < 4) {
            updateScrambledTexts();
            scrambleIntervalRef.current = setInterval(updateScrambledTexts, 50);
            return () => {
                if (scrambleIntervalRef.current) {
                    clearInterval(scrambleIntervalRef.current);
                }
            };
        }
    }, [currentStudent, revealStage, updateScrambledTexts]);

    // Load candidates based on mode
    const loadCandidates = useCallback(async () => {
        setIsLoading(true);
        setRevealStage(0);
        setCurrentIndex(0);

        let newCandidates: Student[];
        if (drawMode === 'by-level') {
            newCandidates = await getRandomCandidatesByLevel(selectedLevel, 10);
        } else {
            newCandidates = await getRandomCandidates(10);
        }

        setCandidates(newCandidates);
        setIsLoading(false);
    }, [drawMode, selectedLevel]);

    useEffect(() => {
        loadCandidates();
    }, [loadCandidates]);

    // Fire confetti effect
    const fireConfetti = async () => {
        const confetti = (await import('canvas-confetti')).default;
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
            confetti({
                particleCount: 7,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 },
                colors: ['#00ff00', '#00ffff', '#ff00ff', '#ffff00'],
            });
            confetti({
                particleCount: 7,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 },
                colors: ['#00ff00', '#00ffff', '#ff00ff', '#ffff00'],
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();
    };

    // Handle spacebar press for reveal
    const handleReveal = useCallback(() => {
        if (!currentStudent || revealStage >= 4) return;

        const newStage = (revealStage + 1) as RevealStage;
        setRevealStage(newStage);

        if (newStage === 4) {
            fireConfetti();
        }
    }, [currentStudent, revealStage]);

    // Handle confirm (mark as winner)
    const handleConfirm = useCallback(async () => {
        if (!currentStudent) return;

        setIsLoading(true);
        await markAsWinner(currentStudent.id);

        // Move to next candidate or reload if none left
        if (currentIndex < candidates.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setRevealStage(0);
        } else {
            await loadCandidates();
        }
        setIsLoading(false);
    }, [currentStudent, currentIndex, candidates.length, loadCandidates]);

    // Handle skip (don't update DB, just move to next)
    const handleSkip = useCallback(() => {
        if (currentIndex < candidates.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setRevealStage(0);
        } else {
            loadCandidates();
        }
    }, [currentIndex, candidates.length, loadCandidates]);

    // Keyboard event listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Spacebar for reveal
            if (e.code === 'Space') {
                e.preventDefault();
                handleReveal();
            }

            // Shortcuts for Stage 4 (Action Phase)
            // รองรับทั้งภาษาอังกฤษ (y/n) และภาษาไทย (ั/ื)
            if (revealStage === 4 && !isLoading) {
                if (e.key.toLowerCase() === 'y' || e.key === 'ั') {
                    handleConfirm();
                }
                if (e.key.toLowerCase() === 'n' || e.key === 'ื') {
                    handleSkip();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleReveal, revealStage, isLoading, handleConfirm, handleSkip]);

    // Get display text based on reveal stage
    const getDisplayText = (field: 'level' | 'room' | 'number' | 'name', stageRequired: number) => {
        if (!currentStudent) return '---';
        if (revealStage >= stageRequired) {
            return currentStudent[field];
        }
        return scrambledTexts[field] || generateScramble(5, field === 'name');
    };

    return (
        <div className="min-h-screen bg-black text-green-400 font-mono overflow-hidden">
            {/* Matrix-style background effect */}
            <div className="fixed inset-0 opacity-5 pointer-events-none overflow-hidden">
                <div className="matrix-rain text-xs leading-none text-green-500">
                    {Array.from({ length: 100 }).map((_, i) => (
                        <span
                            key={i}
                            className="absolute animate-pulse"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                            }}
                        >
                            {SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]}
                        </span>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 min-h-screen flex flex-col">
                {/* Header */}
                <header className="p-4 border-b border-green-900">
                    <div className="flex justify-between items-center max-w-7xl mx-auto">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-6 h-6 text-cyan-400" />
                            <span className="text-xl text-cyan-300">LUCKY DRAW SYSTEM</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600">[ CANDIDATES: {candidates.length} ]</span>
                            <button
                                onClick={loadCandidates}
                                disabled={isLoading}
                                className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                RELOAD
                            </button>
                        </div>
                    </div>
                </header>

                {/* Mode Selector */}
                <div className="p-4 border-b border-green-900 bg-green-950/30">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-wrap items-center gap-4">
                            {/* Mode Buttons */}
                            <div className="flex items-center gap-2">
                                <span className="text-green-600 text-sm">โหมด:</span>
                                <button
                                    onClick={() => setDrawMode('all')}
                                    className={`flex items-center gap-1 px-3 py-2 border-2 transition-all duration-300 ${drawMode === 'all'
                                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                                        : 'border-green-700 text-green-500 hover:border-green-500'
                                        }`}
                                >
                                    <Gift className="w-4 h-4" />
                                    รวมทุกชั้น
                                </button>
                                <button
                                    onClick={() => setDrawMode('by-level')}
                                    className={`flex items-center gap-1 px-3 py-2 border-2 transition-all duration-300 ${drawMode === 'by-level'
                                        ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300'
                                        : 'border-green-700 text-green-500 hover:border-green-500'
                                        }`}
                                >
                                    <Trophy className="w-4 h-4" />
                                    รางวัลใหญ่ (แยกตาม ม.)
                                </button>
                            </div>

                            {/* Level Selector - Only show when by-level mode */}
                            {drawMode === 'by-level' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-600 text-sm">เลือกชั้น:</span>
                                    <div className="flex gap-1">
                                        {LEVELS.map((level) => (
                                            <button
                                                key={level}
                                                onClick={() => setSelectedLevel(level)}
                                                className={`px-3 py-1 border-2 transition-all duration-300 text-sm ${selectedLevel === level
                                                    ? 'border-yellow-400 bg-yellow-500/30 text-yellow-200'
                                                    : 'border-yellow-800 text-yellow-600 hover:border-yellow-500'
                                                    }`}
                                            >
                                                {level}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mode Description */}
                        <div className="mt-2 text-xs">
                            {drawMode === 'all' ? (
                                <span className="text-cyan-600">
                                    [ สุ่มจากนักเรียนทุกระดับชั้นรวมกัน ]
                                </span>
                            ) : (
                                <span className="text-yellow-600">
                                    [ 🏆 รางวัลใหญ่ - สุ่มเฉพาะนักเรียน {selectedLevel} ]
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Display Area */}
                <main className="flex-1 flex items-center justify-center p-8">
                    {!currentStudent ? (
                        <div className="text-center">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-2xl text-green-600"
                            >
                                {isLoading ? 'LOADING CANDIDATES...' : 'NO CANDIDATES AVAILABLE'}
                            </motion.div>
                            {!isLoading && (
                                <button
                                    onClick={loadCandidates}
                                    className="mt-4 px-6 py-3 border-2 border-green-500 hover:bg-green-500 hover:text-black transition-all"
                                >
                                    RELOAD
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="w-full max-w-5xl">
                            {/* Spotlight - Current Student */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStudent.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="border-4 border-cyan-500 p-8 mb-8 bg-gradient-to-br from-black via-cyan-950/20 to-black relative"
                                    style={{
                                        boxShadow: '0 0 60px rgba(0, 255, 255, 0.3), inset 0 0 60px rgba(0, 255, 255, 0.1)',
                                    }}
                                >
                                    {/* ... Same UI as before ... */}
                                    {/* Corner decorations */}
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400" />

                                    <div className="text-center mb-6">
                                        <span className="text-cyan-500 text-sm tracking-widest">
                                            [ CONFIDENTIAL DECRYPTION IN PROGRESS ]
                                        </span>
                                    </div>

                                    {/* Student Info Display */}
                                    <div className="grid grid-cols-3 gap-6 mb-8">
                                        {/* Level */}
                                        <div className="text-center">
                                            <p className="text-cyan-600 text-sm mb-2">LEVEL</p>
                                            <motion.p
                                                key={`level-${revealStage}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`text-4xl font-bold ${revealStage >= 1 ? 'text-green-300' : 'text-cyan-400'
                                                    }`}
                                                style={{
                                                    textShadow: revealStage >= 1
                                                        ? '0 0 20px rgba(0, 255, 100, 0.8)'
                                                        : '0 0 10px rgba(0, 255, 255, 0.5)',
                                                }}
                                            >
                                                {getDisplayText('level', 1)}
                                            </motion.p>
                                        </div>

                                        {/* Room */}
                                        <div className="text-center">
                                            <p className="text-cyan-600 text-sm mb-2">ROOM</p>
                                            <motion.p
                                                key={`room-${revealStage}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`text-4xl font-bold ${revealStage >= 2 ? 'text-green-300' : 'text-cyan-400'
                                                    }`}
                                                style={{
                                                    textShadow: revealStage >= 2
                                                        ? '0 0 20px rgba(0, 255, 100, 0.8)'
                                                        : '0 0 10px rgba(0, 255, 255, 0.5)',
                                                }}
                                            >
                                                {getDisplayText('room', 2)}
                                            </motion.p>
                                        </div>

                                        {/* Number */}
                                        <div className="text-center">
                                            <p className="text-cyan-600 text-sm mb-2">NUMBER</p>
                                            <motion.p
                                                key={`number-${revealStage}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`text-4xl font-bold ${revealStage >= 3 ? 'text-green-300' : 'text-cyan-400'
                                                    }`}
                                                style={{
                                                    textShadow: revealStage >= 3
                                                        ? '0 0 20px rgba(0, 255, 100, 0.8)'
                                                        : '0 0 10px rgba(0, 255, 255, 0.5)',
                                                }}
                                            >
                                                {getDisplayText('number', 3)}
                                            </motion.p>
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div className="text-center border-t border-cyan-800 pt-6">
                                        <p className="text-cyan-600 text-sm mb-3">NAME</p>
                                        <motion.p
                                            key={`name-${revealStage}`}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`text-5xl font-bold ${revealStage >= 4 ? 'text-yellow-300' : 'text-cyan-400'
                                                }`}
                                            style={{
                                                textShadow: revealStage >= 4
                                                    ? '0 0 30px rgba(255, 255, 0, 0.8), 0 0 60px rgba(255, 200, 0, 0.5)'
                                                    : '0 0 10px rgba(0, 255, 255, 0.5)',
                                            }}
                                        >
                                            {getDisplayText('name', 4)}
                                        </motion.p>
                                    </div>

                                    {/* Reveal Progress */}
                                    <div className="mt-8 flex justify-center gap-2">
                                        {[1, 2, 3, 4].map((stage) => (
                                            <div
                                                key={stage}
                                                className={`w-4 h-4 rounded-full transition-all duration-300 ${revealStage >= stage
                                                    ? 'bg-green-400 shadow-lg shadow-green-400/50'
                                                    : 'bg-gray-700 border border-green-700'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Instructions */}
                                    <div className="mt-6 text-center">
                                        <p className="text-cyan-700 text-sm">
                                            {revealStage < 4
                                                ? '[ PRESS SPACEBAR TO DECRYPT ]'
                                                : '[ DECRYPTION COMPLETE - WINNER REVEALED ]'}
                                        </p>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Action Buttons */}
                            {revealStage === 4 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-center gap-6 mb-8"
                                >
                                    <button
                                        onClick={handleConfirm}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 
                      text-black font-bold text-xl transition-all duration-300 
                      disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ boxShadow: '0 0 30px rgba(0, 255, 0, 0.5)' }}
                                    >
                                        <CheckCircle className="w-6 h-6" />
                                        ยืนยัน (CONFIRM)
                                    </button>
                                    <button
                                        onClick={handleSkip}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-8 py-4 border-2 border-red-500 
                      text-red-400 hover:bg-red-500 hover:text-black font-bold text-xl 
                      transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <SkipForward className="w-6 h-6" />
                                        ไม่อยู่ (SKIP)
                                    </button>
                                </motion.div>
                            )}

                            {/* Waiting List */}
                            {waitingStudents.length > 0 && (
                                <div className="border border-green-900 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users className="w-4 h-4 text-green-600" />
                                        <span className="text-green-600 text-sm">WAITING LIST ({waitingStudents.length})</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {waitingStudents.map((student, idx) => (
                                            <div
                                                key={student.id}
                                                className="px-3 py-1 border border-green-800 text-green-700 text-sm bg-green-950/30"
                                            >
                                                #{idx + 2} [ENCRYPTED]
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="p-4 border-t border-green-900 text-center text-green-700 text-sm">
                    <p>[ SYSTEM STATUS: ACTIVE ] [ PRESS SPACE TO REVEAL ]</p>
                </footer>

                {/* Custom CSS for animations */}
            </div>
        </div>
    );
}
