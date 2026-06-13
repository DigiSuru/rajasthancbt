import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      <nav className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center relative z-20">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2 rounded-xl font-black text-2xl text-white shadow-lg shadow-orange-500/30">
            RPSC
          </div>
          <span className="font-extrabold text-xl tracking-wide text-white">AI Mock Test<span className="text-amber-500">.</span></span>
        </div>
        <div className="hidden md:flex space-x-8 font-semibold text-sm text-slate-300">
          <a href="#features" className="hover:text-amber-400 transition">Features</a>
          <a href="#pricing" className="hover:text-amber-400 transition">Pricing</a>
        </div>
        <div>
          <button onClick={() => navigate('/dashboard')} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-bold transition border border-white/10 backdrop-blur-md">
            Login / Enter App
          </button>
        </div>
      </nav>

      <section className="relative pt-20 pb-32 px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/30 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-600/20 blur-[100px] rounded-full pointer-events-none"></div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/30 px-4 py-2 rounded-full text-indigo-300 text-xs font-bold uppercase tracking-wider mb-8">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span>India's Most Advanced AI Exam Engine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8 tracking-tight">
            Crack RPSC & RSSB Exams with <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500">
              Advanced AI Mock Tests
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
            Upload your notes or scan textbook photos. Our AI analyzes the core concepts and generates highly balanced CBT mock exams containing Direct Questions, Assertion-Reason, and Match Matrices with strict negative marking.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button onClick={() => navigate('/dashboard')} className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-lg font-bold rounded-2xl shadow-xl shadow-indigo-500/25 transition transform hover:-translate-y-1">
              Start Generating for Free 🚀
            </button>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-slate-800 py-12 text-center bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 border border-slate-800 rounded-full">
            <span className="text-slate-300 font-semibold tracking-wide">
              Made with <span className="text-red-500 animate-pulse mx-1">❤️</span> by <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-black">Suru</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
