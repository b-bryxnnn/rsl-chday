'use client';

import dynamic from 'next/dynamic';
import { isConfigured } from '@/lib/supabaseClient';

const GameDisplay = dynamic(() => import('@/components/GameDisplay'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
      <div className="text-xl animate-pulse">Initializing System...</div>
    </div>
  )
});

export default function Page() {
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-8">
        <div className="max-w-xl w-full border border-red-500 p-8 text-center shadow-[0_0_20px_rgba(255,0,0,0.3)]">
          <h1 className="text-3xl font-bold text-red-500 mb-6">[ SYSTEM CRITICAL ERROR ]</h1>
          <p className="text-xl mb-4">Database Connection Failed</p>
          <div className="text-left bg-red-950/30 p-4 rounded border border-red-900 mb-6">
            <p className="mb-2 text-red-300">Missing Supabase credentials.</p>
            <p className="mb-2">Please create <code className="bg-red-900 px-1">.env.local</code> with:</p>
            <pre className="text-xs text-gray-300 overflow-x-auto p-2 bg-black border border-red-900">
              NEXT_PUBLIC_SUPABASE_URL=your_url
              NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
            </pre>
          </div>
          <p className="text-sm text-gray-500">
            Please restart the server (npm run dev) after creating the file.
          </p>
        </div>
      </div>
    );
  }

  return <GameDisplay />;
}
