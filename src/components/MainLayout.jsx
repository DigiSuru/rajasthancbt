import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userApiKey, setUserApiKey, showApiSetup, setShowApiSetup, clearActiveTest } = useAppStore();

  const inExam = location.pathname.includes('/exam');
  const isFullscreen = document.fullscreenElement !== null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between overflow-x-hidden">
      {!(inExam && isFullscreen) && (
        <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2 rounded-lg font-black text-xl">RPSC</div>
              <div>
                <h1 className="text-sm sm:text-lg font-bold leading-none tracking-wide">CBT जनरेटर</h1>
                <p className="text-[10px] text-amber-400 font-medium">Serverless Mode</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button onClick={() => navigate('/')} className="hidden sm:block text-slate-400 hover:text-white text-xs font-semibold mr-2 transition">Home</button>
              <button onClick={() => setShowApiSetup(!showApiSetup)} className="bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-md text-xs font-bold border border-slate-700">⚙️ Settings</button>
              {inExam && (
                <button onClick={() => { if(confirm("बाहर निकलें?")) { clearActiveTest(); navigate('/dashboard'); } }} className="bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 px-3 rounded-md font-bold">Exit</button>
              )}
            </div>
          </div>
        </header>
      )}

      {showApiSetup && !inExam && (
        <div className="bg-indigo-900 text-white p-4 border-b border-indigo-700 shadow-inner">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-sm text-indigo-200 flex items-center"><span className="text-lg mr-2">🔑</span> API Setup (Required)</h3>
              <p className="text-xs text-indigo-300 mt-1">अपने Google AI Studio अकाउंट से API Key पाएँ और नीचे पेस्ट करें।</p>
            </div>
            <div className="flex w-full md:w-auto space-x-2">
              <input 
                type="password" 
                placeholder="Paste Gemini API Key here..." 
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                className="w-full md:w-64 px-3 py-2 rounded bg-indigo-950 border border-indigo-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-white"
              />
              <button onClick={() => setShowApiSetup(false)} className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded font-bold text-sm whitespace-nowrap">Save</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow w-full max-w-7xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>

      {!(inExam && isFullscreen) && (
        <footer className="border-t border-slate-200 py-8 text-center bg-white mt-auto">
          <div className="max-w-7xl mx-auto px-6">
            <div className="inline-flex items-center justify-center px-5 py-2 bg-slate-50 border border-slate-100 rounded-full mb-3">
              <span className="text-slate-500 text-sm font-medium">
                Made with <span className="text-red-500 animate-pulse mx-0.5">❤️</span> by <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 font-black tracking-wide">Suru</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} Suru Technologies. Elevating Education with AI.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
