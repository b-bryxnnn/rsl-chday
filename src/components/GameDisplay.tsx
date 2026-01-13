'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, SkipForward, RefreshCw, Sparkles, Trophy, Gift } from 'lucide-react';
import { Student, getRandomCandidates, getRandomCandidatesByLevel, markAsWinner } from '@/lib/supabaseClient';

// Scramble characters for the decrypt effect
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>[]{}';
const THAI_SCRAMBLE = 'กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';

// ระดับชั้น 1-6
const LEVELS = ['1', '2', '3', '4', '5', '6'];

// Changed to 3 stages: 0=encrypted, 1=level, 2=room, 3=number+name
type RevealStage = 0 | 1 | 2 | 3;
type DrawMode = 'all' | 'by-level';

// ===== SOUND EFFECTS =====
// Background music: public/sounds/excitement.mp3 (loops continuously)
// Button sounds: Web Audio API
class HackerSounds {
    private bgAudio: HTMLAudioElement | null = null;
    private audioContext: AudioContext | null = null;
    private isInitialized = false;
    private isBgPlaying = false;

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        // Start background music on init
        this.startBackgroundMusic();
    }

    // Start looping background music
    startBackgroundMusic() {
        if (this.isBgPlaying) return;

        try {
            if (!this.bgAudio) {
                this.bgAudio = new Audio('/sounds/excitement.mp3');
                this.bgAudio.loop = true; // Loop continuously
                this.bgAudio.volume = 0.5; // Lower volume so button sounds are audible
            }

            this.bgAudio.play().catch(e => console.log('Audio play failed:', e));
            this.isBgPlaying = true;
        } catch (e) {
            console.log('Audio error:', e);
        }
    }

    // Stop background music (only if needed)
    stopBackgroundMusic() {
        if (this.bgAudio) {
            this.bgAudio.pause();
            this.bgAudio.currentTime = 0;
        }
        this.isBgPlaying = false;
    }

    // Button unlock sound - dramatic electronic impact
    playUnlockSound() {
        const ctx = this.getContext();

        // Sub-bass hit
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(80, ctx.currentTime);
        subOsc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.4);
        subGain.gain.setValueAtTime(0.5, ctx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        subOsc.start(ctx.currentTime);
        subOsc.stop(ctx.currentTime + 0.5);

        // Rising synth whoosh
        const sweepOsc = ctx.createOscillator();
        const sweepGain = ctx.createGain();
        sweepOsc.connect(sweepGain);
        sweepGain.connect(ctx.destination);
        sweepOsc.type = 'sawtooth';
        sweepOsc.frequency.setValueAtTime(150, ctx.currentTime);
        sweepOsc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.15);
        sweepGain.gain.setValueAtTime(0.15, ctx.currentTime);
        sweepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        sweepOsc.start(ctx.currentTime);
        sweepOsc.stop(ctx.currentTime + 0.2);

        // Confirmation beeps
        [0, 0.08, 0.16].forEach((delay, i) => {
            const beepOsc = ctx.createOscillator();
            const beepGain = ctx.createGain();
            beepOsc.connect(beepGain);
            beepGain.connect(ctx.destination);
            beepOsc.type = 'sine';
            beepOsc.frequency.value = 600 + i * 200;
            const startTime = ctx.currentTime + delay;
            beepGain.gain.setValueAtTime(0.1, startTime);
            beepGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.06);
            beepOsc.start(startTime);
            beepOsc.stop(startTime + 0.06);
        });
    }

    // Victory sound - epic bass drop
    playVictorySound() {
        const ctx = this.getContext();

        // Massive bass drop
        const dropOsc = ctx.createOscillator();
        const dropGain = ctx.createGain();
        dropOsc.connect(dropGain);
        dropGain.connect(ctx.destination);
        dropOsc.type = 'sine';
        dropOsc.frequency.setValueAtTime(60, ctx.currentTime);
        dropOsc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.6);
        dropGain.gain.setValueAtTime(0.7, ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        dropOsc.start(ctx.currentTime);
        dropOsc.stop(ctx.currentTime + 0.8);

        // Victory chord
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const chordOsc = ctx.createOscillator();
            const chordGain = ctx.createGain();
            chordOsc.connect(chordGain);
            chordGain.connect(ctx.destination);
            chordOsc.type = 'sine';
            chordOsc.frequency.value = freq;
            const startTime = ctx.currentTime + 0.1;
            chordGain.gain.setValueAtTime(0.12 - i * 0.02, startTime);
            chordGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
            chordOsc.start(startTime);
            chordOsc.stop(startTime + 0.8);
        });

        // Sparkles
        for (let i = 0; i < 8; i++) {
            const sparkleOsc = ctx.createOscillator();
            const sparkleGain = ctx.createGain();
            sparkleOsc.connect(sparkleGain);
            sparkleGain.connect(ctx.destination);
            sparkleOsc.type = 'sine';
            sparkleOsc.frequency.value = 1500 + Math.random() * 2000;
            const startTime = ctx.currentTime + 0.2 + i * 0.08;
            sparkleGain.gain.setValueAtTime(0.06, startTime);
            sparkleGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
            sparkleOsc.start(startTime);
            sparkleOsc.stop(startTime + 0.15);
        }
    }
}

const hackerSounds = new HackerSounds();

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
    const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const currentStudent = candidates[currentIndex];

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
        if (currentStudent && revealStage < 3) {
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
        if (!currentStudent || revealStage >= 3) return;

        // Initialize and start background music on first interaction
        hackerSounds.init();

        const newStage = (revealStage + 1) as RevealStage;
        setRevealStage(newStage);

        if (newStage === 3) {
            // Final reveal - victory sound + confetti
            hackerSounds.playVictorySound();
            fireConfetti();
        } else {
            // Intermediate stage - unlock sound
            hackerSounds.playUnlockSound();
        }
    }, [currentStudent, revealStage]);

    // Handle confirm (mark as winner)
    const handleConfirm = useCallback(async () => {
        if (!currentStudent) return;

        setIsLoading(true);
        hackerSounds.playUnlockSound(); // Play sound on confirm
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
        hackerSounds.playUnlockSound(); // Play sound on skip
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

            // Shortcuts for Stage 3 (Action Phase)
            // รองรับทั้งภาษาอังกฤษ (y/n) และภาษาไทย (ั/ื)
            if (revealStage === 3 && !isLoading) {
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
    // Stage 1: Level, Stage 2: Room, Stage 3: Number + Name
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

                                    {/* Student Info Display - 2 columns for Level and Room */}
                                    <div className="grid grid-cols-2 gap-6 mb-8">
                                        {/* Level */}
                                        <div className="text-center">
                                            <p className="text-cyan-600 text-sm mb-2">LEVEL</p>
                                            <motion.p
                                                key={`level-${revealStage}`}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`text-5xl font-bold ${revealStage >= 1 ? 'text-green-300' : 'text-cyan-400'
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
                                                className={`text-5xl font-bold ${revealStage >= 2 ? 'text-green-300' : 'text-cyan-400'
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
                                    </div>

                                    {/* Number + Name - revealed together at stage 3 */}
                                    <div className="text-center border-t border-cyan-800 pt-6">
                                        <div className="grid grid-cols-2 gap-6 items-center">
                                            {/* Number */}
                                            <div className="text-center">
                                                <p className="text-cyan-600 text-sm mb-2">NUMBER</p>
                                                <motion.p
                                                    key={`number-${revealStage}`}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`text-5xl font-bold ${revealStage >= 3 ? 'text-yellow-300' : 'text-cyan-400'
                                                        }`}
                                                    style={{
                                                        textShadow: revealStage >= 3
                                                            ? '0 0 30px rgba(255, 255, 0, 0.8)'
                                                            : '0 0 10px rgba(0, 255, 255, 0.5)',
                                                    }}
                                                >
                                                    {getDisplayText('number', 3)}
                                                </motion.p>
                                            </div>

                                            {/* Name */}
                                            <div className="text-center">
                                                <p className="text-cyan-600 text-sm mb-2">NAME</p>
                                                <motion.p
                                                    key={`name-${revealStage}`}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className={`text-4xl font-bold ${revealStage >= 3 ? 'text-yellow-300' : 'text-cyan-400'
                                                        }`}
                                                    style={{
                                                        textShadow: revealStage >= 3
                                                            ? '0 0 30px rgba(255, 255, 0, 0.8), 0 0 60px rgba(255, 200, 0, 0.5)'
                                                            : '0 0 10px rgba(0, 255, 255, 0.5)',
                                                    }}
                                                >
                                                    {getDisplayText('name', 3)}
                                                </motion.p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reveal Progress - 3 stages now */}
                                    <div className="mt-8 flex justify-center gap-2">
                                        {[1, 2, 3].map((stage) => (
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
                                            {revealStage < 3
                                                ? '[ PRESS SPACEBAR TO DECRYPT ]'
                                                : '[ DECRYPTION COMPLETE - WINNER REVEALED ]'}
                                        </p>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Action Buttons */}
                            {revealStage === 3 && (
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
                                        ยืนยัน (Y)
                                    </button>
                                    <button
                                        onClick={handleSkip}
                                        disabled={isLoading}
                                        className="flex items-center gap-2 px-8 py-4 border-2 border-red-500 
                      text-red-400 hover:bg-red-500 hover:text-black font-bold text-xl 
                      transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <SkipForward className="w-6 h-6" />
                                        ไม่อยู่ (N)
                                    </button>
                                </motion.div>
                            )}

                        </div>
                    )}
                </main>

                {/* Footer */}
                <footer className="p-4 border-t border-green-900 text-center text-green-700 text-sm">
                    <p>[ SYSTEM STATUS: ACTIVE ] [ PRESS SPACE TO REVEAL ] [ SOUND: ON 🔊 ]</p>
                </footer>

            </div>
        </div>
    );
}
