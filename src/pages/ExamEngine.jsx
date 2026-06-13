import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { db, auth, isLocalMode, safeAppId, collection, addDoc } from '../services/firebase';

export default function ExamEngine() {
  const navigate = useNavigate();
  const { activeTestState, setActiveTestState, examFontSize, setExamFontSize } = useAppStore();
  
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [instructionChecked, setInstructionChecked] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    if (!activeTestState) navigate('/dashboard');
  }, [activeTestState, navigate]);

  if (!activeTestState) return null;

  const { currentQuiz, answers, visited, markedForReview, timeLeft, currentQuestionIndex, testViewState } = activeTestState;

  useEffect(() => {
    let interval = null;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => setActiveTestState({ timeLeft: timeLeft - 1 }), 1000);
    } else if (timeLeft <= 0 && isTimerActive) {
      setIsTimerActive(false);
      submitExamAnswers();
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, setActiveTestState]);

  const handleStartExamActual = () => {
    if (!instructionChecked) {
      alert("कृपया निर्देश बॉक्स को चेक करें।");
      return;
    }
    setActiveTestState({ testViewState: 'exam' });
    setIsTimerActive(true);
  };

  const handleSelectOption = useCallback((optIndex) => {
    const qId = currentQuiz.questions[currentQuestionIndex].id;
    setActiveTestState({ answers: { ...answers, [qId]: optIndex } });
  }, [currentQuiz, currentQuestionIndex, answers, setActiveTestState]);

  const handleClearResponse = useCallback(() => {
    const qId = currentQuiz.questions[currentQuestionIndex].id;
    const updated = { ...answers };
    delete updated[qId];
    setActiveTestState({ answers: updated });
  }, [currentQuiz, currentQuestionIndex, answers, setActiveTestState]);

  const handleSaveAndNext = useCallback(() => {
    const currentQId = currentQuiz.questions[currentQuestionIndex].id;
    const nextIndex = currentQuestionIndex + 1;
    const newMarked = markedForReview.filter(id => id !== currentQId);
    
    if (nextIndex < currentQuiz.questions.length) {
      const newVisited = [...new Set([...visited, currentQuiz.questions[nextIndex].id])];
      setActiveTestState({ currentQuestionIndex: nextIndex, visited: newVisited, markedForReview: newMarked });
    } else {
      setActiveTestState({ markedForReview: newMarked });
      alert("आप अंतिम प्रश्न पर हैं। दाईं ओर से सबमिट करें।");
    }
  }, [currentQuiz, currentQuestionIndex, visited, markedForReview, setActiveTestState]);

  const handleMarkReviewAndNext = useCallback(() => {
    const currentQId = currentQuiz.questions[currentQuestionIndex].id;
    const nextIndex = currentQuestionIndex + 1;
    const newMarked = [...new Set([...markedForReview, currentQId])];
    
    if (nextIndex < currentQuiz.questions.length) {
      const newVisited = [...new Set([...visited, currentQuiz.questions[nextIndex].id])];
      setActiveTestState({ currentQuestionIndex: nextIndex, visited: newVisited, markedForReview: newMarked });
    } else {
      setActiveTestState({ markedForReview: newMarked });
    }
  }, [currentQuiz, currentQuestionIndex, visited, markedForReview, setActiveTestState]);

  const jumpToQuestion = (index) => {
    const newVisited = [...new Set([...visited, currentQuiz.questions[index].id])];
    setActiveTestState({ currentQuestionIndex: index, visited: newVisited });
  };

  useEffect(() => {
    if (testViewState !== 'exam') return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      switch(e.key.toLowerCase()) {
        case '1': handleSelectOption(0); break;
        case '2': handleSelectOption(1); break;
        case '3': handleSelectOption(2); break;
        case '4': handleSelectOption(3); break;
        case 'arrowright': jumpToQuestion(Math.min(currentQuestionIndex + 1, currentQuiz.questions.length - 1)); break;
        case 'arrowleft': jumpToQuestion(Math.max(currentQuestionIndex - 1, 0)); break;
        case 's': handleSaveAndNext(); break;
        case 'm': handleMarkReviewAndNext(); break;
        case 'c': handleClearResponse(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [testViewState, currentQuestionIndex, handleSelectOption, handleSaveAndNext, handleMarkReviewAndNext, handleClearResponse]);

  const submitExamAnswers = async () => {
    setIsTimerActive(false);
    setShowSubmitModal(false);
    if (document.fullscreenElement) document.exitFullscreen();

    let correctCount = 0, incorrectCount = 0, skippedCount = 0;
    currentQuiz.questions.forEach(q => {
      const userAns = answers[q.id];
      if (userAns === undefined) skippedCount++;
      else if (Number(userAns) === Number(q.ans)) correctCount++;
      else incorrectCount++;
    });

    const marksObtained = Number((correctCount * 1 - incorrectCount * 0.33).toFixed(2));
    const maxMarks = currentQuiz.questions.length;
    const accuracy = correctCount > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;

    const attemptPayload = {
      id: 'att-' + Date.now(),
      quizId: currentQuiz.id,
      quizTitle: currentQuiz.title,
      totalQuestions: maxMarks,
      correctCount, incorrectCount, skippedCount, marksObtained, maxMarks, accuracy,
      answers: JSON.stringify(answers),
      attemptedAt: Date.now()
    };

    if (auth?.currentUser && !isLocalMode) {
      try {
        const attemptsColRef = collection(db, 'artifacts', safeAppId, 'users', auth.currentUser.uid, 'attempts');
        await addDoc(attemptsColRef, attemptPayload);
      } catch(e) { console.error("Firebase save failed", e); }
    }
    
    setActiveTestState({ testViewState: 'result' });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => console.error(e));
    else if(document.exitFullscreen) document.exitFullscreen();
  };

  const getFontSizeClass = () => {
    if (examFontSize === 0) return 'text-sm';
    if (examFontSize === 2) return 'text-lg md:text-xl leading-loose';
    return 'text-base md:text-lg leading-relaxed';
  };

  if (testViewState === 'instructions') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 mt-4">
        <h2 className="text-xl font-bold border-b border-slate-100 pb-4 mb-6 text-slate-800">CBT परीक्षा निर्देशिका</h2>
        <ul className="text-sm space-y-3 mb-8 text-slate-600 font-medium">
          <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-indigo-500 mr-3"></span> कुल प्रश्न: <b className="ml-1 text-slate-800">{currentQuiz.numQuestions}</b></li>
          <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-indigo-500 mr-3"></span> कुल समय: <b className="ml-1 text-slate-800">{currentQuiz.durationMinutes} मिनट</b></li>
          <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></span> सही उत्तर पर: <b className="ml-1 text-emerald-600">+1 अंक</b></li>
          <li className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-3"></span> गलत उत्तर पर: <b className="ml-1 text-red-600">-0.33 अंक</b> (नकारात्मक अंकन)</li>
        </ul>
        <label className="flex items-center space-x-3 bg-amber-50 border border-amber-100 p-4 rounded-xl text-sm font-semibold text-amber-900 cursor-pointer mb-8">
          <input type="checkbox" checked={instructionChecked} onChange={(e) => setInstructionChecked(e.target.checked)} className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
          <span>मैंने सभी नियम पढ़ लिए हैं।</span>
        </label>
        <button onClick={handleStartExamActual} className={`w-full py-4 rounded-xl font-bold text-white transition shadow-lg ${instructionChecked ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}>परीक्षा शुरू करें</button>
      </motion.div>
    );
  }

  if (testViewState === 'exam') {
    return (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 h-full mt-1">
        <div className="lg:col-span-3 bg-white p-5 md:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-[60vh] relative">
          
          <div className="absolute top-0 right-8 transform -translate-y-1/2 flex space-x-2">
            <div className="bg-slate-800 text-white rounded-lg shadow-lg flex border border-slate-700 overflow-hidden">
              <button onClick={() => setExamFontSize(0)} className={`px-3 py-1 text-xs font-bold hover:bg-slate-700 ${examFontSize === 0 ? 'bg-indigo-600' : ''}`}>A-</button>
              <button onClick={() => setExamFontSize(1)} className={`px-3 py-1 text-sm font-bold border-l border-r border-slate-700 hover:bg-slate-700 ${examFontSize === 1 ? 'bg-indigo-600' : ''}`}>A</button>
              <button onClick={() => setExamFontSize(2)} className={`px-3 py-1 text-base font-bold hover:bg-slate-700 ${examFontSize === 2 ? 'bg-indigo-600' : ''}`}>A+</button>
            </div>
            <button onClick={toggleFullScreen} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-bold border border-slate-700 shadow-lg">
              Full Screen 🔲
            </button>
          </div>

          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 mt-4">
             <span className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-lg text-xs font-black tracking-wide">प्रश्न {currentQuestionIndex + 1}/{currentQuiz.questions.length}</span>
             <span className={`font-mono px-4 py-1.5 rounded-lg text-sm shadow-md flex items-center ${timeLeft < 300 ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
               <span className="mr-2">⏳</span> {formatTime(timeLeft)}
             </span>
          </div>
          
          <AnimatePresence mode='wait'>
            <motion.div key={currentQuestionIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-grow flex flex-col">
              <div className={`font-semibold mb-8 text-slate-800 whitespace-pre-wrap ${getFontSizeClass()}`}>
                {String(currentQuiz.questions[currentQuestionIndex].q)}
              </div>
              
              <div className="space-y-3 flex-grow">
                {currentQuiz.questions[currentQuestionIndex].opts.map((opt, idx) => {
                  const isSelected = answers[currentQuiz.questions[currentQuestionIndex].id] === idx;
                  return (
                    <div key={idx} onClick={() => handleSelectOption(idx)} className={`p-4 border-2 rounded-xl cursor-pointer text-sm font-medium transition ${isSelected ? 'bg-indigo-50/50 border-indigo-500' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <div className="flex items-start">
                        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 mr-3 flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                           {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                        </div>
                        <span className={`${isSelected ? 'text-indigo-900' : 'text-slate-700'} ${getFontSizeClass()}`}>{String(opt)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-wrap gap-3 justify-between mt-8 border-t border-slate-100 pt-6">
            <div className="flex space-x-3 w-full sm:w-auto">
               <button onClick={handleClearResponse} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl text-xs font-bold transition">Clear (C)</button>
               <button onClick={handleMarkReviewAndNext} className="flex-1 sm:flex-none bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-100 px-5 py-3 rounded-xl text-xs font-bold transition">Review & Next (M)</button>
            </div>
            <button onClick={handleSaveAndNext} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/30 transition">Save & Next (S)</button>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
           <h4 className="font-bold text-xs text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-3 flex justify-between">
             <span>प्रश्नों की ग्रिड</span>
             <span className="text-[10px] lowercase tracking-normal">use ← → keys</span>
           </h4>
           <div className="grid grid-cols-5 lg:grid-cols-4 gap-2 mb-6">
             {currentQuiz.questions.map((q, idx) => {
               const qId = q.id;
               const isAns = answers[qId] !== undefined;
               const isRev = markedForReview.includes(qId);
               const isCurrent = currentQuestionIndex === idx;
               let bg = "bg-slate-100 text-slate-600 border-transparent";
               if(isRev) bg = "bg-purple-600 text-white border-purple-700"; 
               else if(isAns) bg = "bg-emerald-500 text-white border-emerald-600"; 
               else if(visited.includes(qId)) bg = "bg-red-500 text-white border-red-600";
               
               if (isCurrent) bg += " ring-2 ring-offset-2 ring-indigo-500";
               
               return <button key={qId} onClick={() => jumpToQuestion(idx)} className={`w-full h-10 text-xs font-bold rounded-lg border transition ${bg}`}>{idx + 1}</button>
             })}
           </div>
           <div className="mt-auto space-y-2 mb-6 text-[10px] font-bold text-slate-500">
              <div className="flex items-center"><span className="w-3 h-3 bg-emerald-500 rounded mr-2"></span> Answered</div>
              <div className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded mr-2"></span> Not Answered</div>
              <div className="flex items-center"><span className="w-3 h-3 bg-purple-600 rounded mr-2"></span> Marked Review</div>
           </div>
           <button onClick={() => setShowSubmitModal(true)} className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/30 transition">परीक्षा सबमिट करें</button>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl transform scale-100 transition-all">
             <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
             <h3 className="font-black text-xl text-slate-800 mb-2">क्या आप सुनिश्चित हैं?</h3>
             <p className="text-sm text-slate-500 mb-8 font-medium">सबमिट करने के बाद आप उत्तर नहीं बदल पाएंगे। आपका स्कोर तुरंत कैलकुलेट किया जाएगा।</p>
             <div className="flex space-x-3">
                <button onClick={() => setShowSubmitModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl font-bold text-sm text-slate-700 transition">वापस जाएँ</button>
                <button onClick={() => submitExamAnswers()} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-500/30 transition">सबमिट करें</button>
             </div>
           </div>
        </div>
      )}
    </>
    );
  }

  // Result View (extracted but kept here for simplicity, could also be a separate file, but logic is tightly coupled to currentQuiz)
  if (testViewState === 'result') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 mt-2">
        <div className="bg-indigo-950 text-white p-8 md:p-10 rounded-3xl flex flex-col md:flex-row justify-between items-center shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 blur-[80px] rounded-full opacity-20 pointer-events-none"></div>
           <div className="relative z-10 text-center md:text-left mb-6 md:mb-0">
             <h2 className="text-3xl font-black mb-2">{String(currentQuiz.title)}</h2>
             <p className="text-indigo-300 text-sm font-medium">स्कोरकार्ड एवं प्रदर्शन विश्लेषण</p>
           </div>
           <div className="relative z-10 text-5xl font-black text-amber-400 bg-black/20 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
              {Number((currentQuiz.questions.reduce((acc, q) => answers[q.id] === undefined ? acc : (answers[q.id] === q.ans ? acc + 1 : acc - 0.33), 0)).toFixed(2))}
              <span className="text-xl text-indigo-300 font-bold ml-1"> / {currentQuiz.questions.length}</span>
           </div>
        </div>

        <div className="space-y-6">
          {currentQuiz.questions.map((q, idx) => {
            const isCorrect = Number(answers[q.id]) === Number(q.ans);
            const isUnanswered = answers[q.id] === undefined;
            return (
              <div key={q.id} className={`bg-white p-6 md:p-8 rounded-3xl border-2 ${isCorrect ? 'border-emerald-100 shadow-sm' : isUnanswered ? 'border-slate-200' : 'border-red-100 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xs font-black tracking-widest text-slate-400 uppercase">प्रश्न {idx + 1}</span>
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider ${isCorrect ? 'bg-emerald-100 text-emerald-700' : isUnanswered ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-700'}`}>
                     {isCorrect ? '+1.00 (सही)' : isUnanswered ? '0.00 (छोड़ा)' : '-0.33 (गलत)'}
                  </span>
                </div>
                <p className="text-base md:text-lg font-bold text-slate-800 mb-6 whitespace-pre-wrap leading-relaxed">{String(q.q)}</p>
                <div className="space-y-3 mb-6">
                  {q.opts.map((opt, oIdx) => (
                    <div key={oIdx} className={`p-4 rounded-xl text-sm font-medium flex justify-between items-start transition ${oIdx === Number(q.ans) ? 'bg-emerald-50 border-2 border-emerald-400 text-emerald-900' : oIdx === Number(answers[q.id]) ? 'bg-red-50 border-2 border-red-300 text-red-900' : 'bg-slate-50 border-2 border-transparent text-slate-600'}`}>
                      <span className="mr-4">({oIdx + 1}) {String(opt)}</span>
                      <div className="flex-shrink-0 mt-0.5">
                        {oIdx === Number(q.ans) && <span className="bg-emerald-500 text-white text-[10px] px-2 py-1 rounded font-bold">सही उत्तर</span>}
                        {oIdx === Number(answers[q.id]) && oIdx !== Number(q.ans) && <span className="bg-red-500 text-white text-[10px] px-2 py-1 rounded font-bold">आपका चयन</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-indigo-50/50 p-5 rounded-2xl text-sm text-indigo-900 border border-indigo-100 leading-relaxed">
                  <strong className="block text-xs uppercase tracking-widest text-indigo-500 mb-2 font-black">व्याख्या (Rationale)</strong> 
                  {String(q.rationale)}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="text-center pt-8 pb-4">
          <button onClick={() => navigate('/dashboard')} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold transition">Back to Dashboard</button>
        </div>
      </motion.div>
    );
  }

  return null;
}
