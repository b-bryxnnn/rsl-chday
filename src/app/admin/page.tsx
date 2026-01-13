'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, RefreshCw, Users, CheckCircle, AlertCircle, Database } from 'lucide-react';
import Papa from 'papaparse';
import {
    supabase,
    deleteAllStudents,
    insertStudents,
    resetAllWinners,
    getTotalStudentCount,
    getWinnerCount,
} from '@/lib/supabaseClient';

interface CSVRow {
    level: string;
    room: string;
    number: string;
    name: string;
}

export default function AdminPage() {
    const [totalCount, setTotalCount] = useState<number>(0);
    const [winnerCount, setWinnerCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchCounts = async () => {
        const total = await getTotalStudentCount();
        const winners = await getWinnerCount();
        setTotalCount(total);
        setWinnerCount(winners);
    };

    useEffect(() => {
        fetchCounts();
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setMessage(null);

        Papa.parse<CSVRow>(file, {
            header: true,
            encoding: 'UTF-8',
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const students = results.data.filter(
                        (row) => row.level && row.room && row.number && row.name
                    );

                    if (students.length === 0) {
                        setMessage({ type: 'error', text: 'ไม่พบข้อมูลที่ถูกต้องใน CSV' });
                        setIsLoading(false);
                        return;
                    }

                    // Delete all existing students
                    const deleteSuccess = await deleteAllStudents();
                    if (!deleteSuccess) {
                        setMessage({ type: 'error', text: 'ลบข้อมูลเก่าไม่สำเร็จ' });
                        setIsLoading(false);
                        return;
                    }

                    // Insert new students
                    const insertSuccess = await insertStudents(students);
                    if (!insertSuccess) {
                        setMessage({ type: 'error', text: 'เพิ่มข้อมูลใหม่ไม่สำเร็จ' });
                        setIsLoading(false);
                        return;
                    }

                    setMessage({
                        type: 'success',
                        text: `อัพโหลดสำเร็จ! เพิ่มข้อมูลนักเรียน ${students.length} คน`,
                    });
                    await fetchCounts();
                } catch (error) {
                    console.error('Upload error:', error);
                    setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการอัพโหลด' });
                }
                setIsLoading(false);
            },
            error: (error) => {
                console.error('Parse error:', error);
                setMessage({ type: 'error', text: 'อ่านไฟล์ CSV ไม่สำเร็จ' });
                setIsLoading(false);
            },
        });

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleResetWinners = async () => {
        if (!confirm('ต้องการรีเซ็ตสถานะผู้ชนะทั้งหมดหรือไม่?')) return;

        setIsLoading(true);
        setMessage(null);

        const success = await resetAllWinners();
        if (success) {
            setMessage({ type: 'success', text: 'รีเซ็ตสถานะผู้ชนะเรียบร้อย' });
            await fetchCounts();
        } else {
            setMessage({ type: 'error', text: 'รีเซ็ตไม่สำเร็จ' });
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
            {/* Header */}
            <div className="max-w-4xl mx-auto">
                <div className="border border-green-500 p-6 mb-8">
                    <h1 className="text-3xl font-bold text-center mb-2 text-green-300">
                        [ ADMIN CONTROL PANEL ]
                    </h1>
                    <p className="text-center text-green-600">ระบบจัดการข้อมูลนักเรียน - สุ่มรางวัลวันเด็ก</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="border border-green-700 p-4 bg-green-950/30">
                        <div className="flex items-center gap-3">
                            <Users className="w-8 h-8 text-green-400" />
                            <div>
                                <p className="text-green-600 text-sm">TOTAL STUDENTS</p>
                                <p className="text-3xl font-bold text-green-300">{totalCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border border-cyan-700 p-4 bg-cyan-950/30">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-cyan-400" />
                            <div>
                                <p className="text-cyan-600 text-sm">WINNERS</p>
                                <p className="text-3xl font-bold text-cyan-300">{winnerCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border border-yellow-700 p-4 bg-yellow-950/30">
                        <div className="flex items-center gap-3">
                            <Database className="w-8 h-8 text-yellow-400" />
                            <div>
                                <p className="text-yellow-600 text-sm">REMAINING</p>
                                <p className="text-3xl font-bold text-yellow-300">{totalCount - winnerCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Message Alert */}
                {message && (
                    <div
                        className={`border p-4 mb-6 flex items-center gap-3 ${message.type === 'success'
                                ? 'border-green-500 bg-green-950/50 text-green-300'
                                : 'border-red-500 bg-red-950/50 text-red-300'
                            }`}
                    >
                        {message.type === 'success' ? (
                            <CheckCircle className="w-5 h-5" />
                        ) : (
                            <AlertCircle className="w-5 h-5" />
                        )}
                        {message.text}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-6">
                    {/* CSV Upload */}
                    <div className="border border-green-700 p-6">
                        <h2 className="text-xl mb-4 text-green-300">📁 UPLOAD CSV DATA</h2>
                        <p className="text-green-600 text-sm mb-4">
                            รูปแบบ CSV: level, room, number, name (UTF-8 encoding)
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="csv-upload"
                            disabled={isLoading}
                        />
                        <label
                            htmlFor="csv-upload"
                            className={`inline-flex items-center gap-2 px-6 py-3 border-2 border-green-500 
                cursor-pointer transition-all duration-300
                ${isLoading
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-green-500 hover:text-black'
                                }`}
                        >
                            <Upload className="w-5 h-5" />
                            {isLoading ? 'PROCESSING...' : 'SELECT CSV FILE'}
                        </label>
                        <p className="text-green-700 text-xs mt-3">
                            ⚠️ การอัพโหลดจะลบข้อมูลเดิมทั้งหมดและแทนที่ด้วยข้อมูลใหม่
                        </p>
                    </div>

                    {/* Reset Winners */}
                    <div className="border border-yellow-700 p-6">
                        <h2 className="text-xl mb-4 text-yellow-300">🔄 RESET WINNERS</h2>
                        <p className="text-yellow-600 text-sm mb-4">
                            รีเซ็ตสถานะ is_winner ของทุกคนกลับเป็น false (เริ่มงานใหม่)
                        </p>
                        <button
                            onClick={handleResetWinners}
                            disabled={isLoading}
                            className={`inline-flex items-center gap-2 px-6 py-3 border-2 border-yellow-500 
                transition-all duration-300
                ${isLoading
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-yellow-500 hover:text-black cursor-pointer'
                                }`}
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            RESET ALL WINNERS
                        </button>
                    </div>

                    {/* CSV Format Guide */}
                    <div className="border border-green-900 p-6 bg-green-950/20">
                        <h2 className="text-xl mb-4 text-green-500">📋 CSV FORMAT GUIDE</h2>
                        <pre className="text-green-600 text-sm overflow-x-auto">
                            {`level,room,number,name
ม.1,1,1,สมชาย ใจดี
ม.1,1,2,สมหญิง รักเรียน
ม.2,3,15,วิชัย เก่งมาก`}
                        </pre>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-green-700 text-sm">
                    <p>[ SYSTEM STATUS: ONLINE ] [ CONNECTION: SECURE ]</p>
                </div>
            </div>
        </div>
    );
}
