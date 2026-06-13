import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { db, auth, isLocalMode, safeAppId, collection, addDoc, onSnapshot } from '../services/firebase';
import { generateQuiz } from '../services/gemini';

export default function Dashboard() {
  const navigate = useNavigate();
  const { userApiKey, setShowApiSetup, setActiveTestState } = useAppStore();

  const [user, setUser] = useState(auth?.currentUser || null);
  const [activeTab, setActiveTab] = useState('generate');
  
  const [examName, setExamName] = useState('RPSC RAS (Pre) Mock Exam');
  const [numQuestions, setNumQuestions] = useState(15);
  const [duration, setDuration] = useState(30); 
  const [difficulty, setDifficulty] = useState('Medium (Standard)');
  const [focusArea, setFocusArea] = useState(''); 
  const [contentInput, setContentInput] = useState('');
  
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [attachedImages, setAttachedImages] = useState([]);
  
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = auth.onAuthStateChanged((usr) => setUser(usr));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || isLocalMode) return;
    try {
      const quizzesRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'quizzes');
      const unsubQuizzes = onSnapshot(quizzesRef, (snapshot) => {
        const qList = [];
        snapshot.forEach(doc => qList.push({ id: doc.id, ...doc.data() }));
        qList.sort((a, b) => b.createdAt - a.createdAt);
        setQuizzes(qList);
      });

      const attemptsRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'attempts');
      const unsubAttempts = onSnapshot(attemptsRef, (snapshot) => {
        const aList = [];
        snapshot.forEach(doc => aList.push({ id: doc.id, ...doc.data() }));
        aList.sort((a, b) => b.attemptedAt - a.attemptedAt);
        setAttempts(aList);
      });

      return () => { unsubQuizzes(); unsubAttempts(); };
    } catch (e) { console.error(e); }
  }, [user]);

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src; script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsParsingPdf(true); setGenError(null); setPdfText(''); setAttachedImages([]); setContentInput('');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachedImages([{ dataUrl: e.target.result, name: file.name }]);
        setIsParsingPdf(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    if (file.type === 'application/pdf') {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          if (typeof window.pdfjsLib === 'undefined') {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js");
            if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          }
          if (!window.pdfjsLib) throw new Error("PDF Library failed to load.");

          const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
          let extractedText = "";
          for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            extractedText += content.items.map(item => item.str).join(" ") + "\n";
          }

          if (extractedText.trim().length < 50) {
             const images = [];
             for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
               const page = await pdf.getPage(i);
               const viewport = page.getViewport({ scale: 1.5 }); 
               const canvas = document.createElement('canvas');
               const context = canvas.getContext('2d');
               canvas.height = viewport.height; canvas.width = viewport.width;
               await page.render({ canvasContext: context, viewport: viewport }).promise;
               images.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.8), name: `Page ${i}` });
             }
             setAttachedImages(images);
          } else {
             setPdfText(extractedText);
             setContentInput(extractedText.substring(0, 8000));
          }
        } catch (err) {
          console.error(err);
        } finally {
          setIsParsingPdf(false);
        }
      };
      fileReader.readAsArrayBuffer(file);
    }
  };

  const triggerQuizGeneration = async () => {
    if (!userApiKey || userApiKey.trim() === '') {
      setGenError("कृपया पहले Settings (⚙️) में जाकर अपनी Gemini API Key दर्ज करें।");
      setShowApiSetup(true);
      return;
    }

    const sourceContent = contentInput || pdfText;
    if ((!sourceContent || sourceContent.trim().length < 50) && attachedImages.length === 0) {
      setGenError("कृपया कम से कम 50 वर्णों की सामग्री या कोई छवि/PDF प्रदान करें।");
      return;
    }

    setIsGenerating(true);
    setGenError(null);

    try {
        const resultText = await generateQuiz(userApiKey, examName, numQuestions, duration, difficulty, focusArea, sourceContent, attachedImages);
        const parsedData = JSON.parse(resultText);
        if (parsedData && parsedData.questions && parsedData.questions.length > 0) {
          const questionsList = parsedData.questions.map((q, idx) => ({ ...q, id: idx + 1 }));
          const uniqueTopics = Array.from(new Set(questionsList.map(q => q.topic || "सामान्य ज्ञान")));

          const quizData = {
            title: examName,
            numQuestions: questionsList.length,
            durationMinutes: Number(duration),
            difficulty: difficulty,
            questions: JSON.stringify(questionsList),
            topics: uniqueTopics,
            createdAt: Date.now()
          };

          let newQuizId = 'local-' + Date.now();
          if (user && !isLocalMode) {
            const quizzesCollectionRef = collection(db, 'artifacts', safeAppId, 'users', user.uid, 'quizzes');
            const docRef = await addDoc(quizzesCollectionRef, quizData);
            newQuizId = docRef.id;
          } else {
            setQuizzes(prev => [{ id: newQuizId, ...quizData }, ...prev]);
          }
          
          startQuizCbtFlow({ id: newQuizId, ...quizData, questions: questionsList });
        } else {
          throw new Error("Invalid output format");
        }
    } catch(error) {
        console.error(error);
        setGenError(`API त्रुटि या JSON पार्स एरर: ${error.message}`);
    } finally {
        setIsGenerating(false);
    }
  };

  const startQuizCbtFlow = (quiz) => {
    let parsedQuestions = typeof quiz.questions === 'string' ? JSON.parse(quiz.questions) : quiz.questions;
    setActiveTestState({
        currentQuiz: { ...quiz, questions: parsedQuestions },
        answers: {},
        visited: [1],
        markedForReview: [],
        currentQuestionIndex: 0,
        timeLeft: quiz.durationMinutes * 60,
        testViewState: 'instructions'
    });
    navigate('/exam');
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b space-x-2 bg-white p-1 rounded-xl shadow-sm overflow-x-auto">
        <button onClick={() => setActiveTab('generate')} className={`flex-1 min-w-[100px] py-3 rounded-lg text-xs sm:text-sm font-bold ${activeTab === 'generate' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>नया टेस्ट</button>
        <button onClick={() => setActiveTab('my-quizzes')} className={`flex-1 min-w-[100px] py-3 rounded-lg text-xs sm:text-sm font-bold ${activeTab === 'my-quizzes' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>मॉक टेस्ट ({quizzes.length})</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[100px] py-3 rounded-lg text-xs sm:text-sm font-bold ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>इतिहास ({attempts.length})</button>
      </div>

      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold mb-4 text-slate-800">1. सामग्री अपलोड करें (Text/PDF/Image)</h3>
            <label className="flex flex-col items-center border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 p-6 rounded-xl cursor-pointer mb-4 transition hover:border-indigo-400">
              <span className="text-sm font-semibold text-slate-700">फ़ाइल चुनें (Upload File)</span>
              <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
            </label>
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {attachedImages.map((img, idx) => (
                  <div key={idx} className="relative w-16 h-20 rounded border-2 border-indigo-200 overflow-hidden group">
                    <img src={img.dataUrl} alt="scan" className="w-full h-full object-cover" />
                    <button onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full m-1 flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            )}
            <textarea value={contentInput} onChange={(e) => setContentInput(e.target.value)} placeholder="अतिरिक्त टेक्स्ट यहाँ पेस्ट करें..." rows="4" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"></textarea>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold mb-4 text-slate-800">2. उन्नत पैरामीटर सेट करें (Advanced)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1 uppercase">परीक्षा का नाम</label>
                <input type="text" value={examName} onChange={(e) => setExamName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1 uppercase">कठिनाई स्तर (Difficulty)</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition">
                    <option value="Easy (Direct Facts)">Easy (सीधे तथ्य)</option>
                    <option value="Medium (Standard)">Medium (मानक स्तर)</option>
                    <option value="Hard (RPSC RAS/CET Level)">Hard (RAS / CET स्तर)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1 uppercase">विशिष्ट विषय (Optional)</label>
                  <input type="text" placeholder="e.g., केवल भूगोल" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
              </div>

              <div className="flex space-x-4">
                <div className="w-1/2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1 uppercase">प्रश्न संख्या</label>
                  <input type="number" min="5" max="50" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
                <div className="w-1/2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1 uppercase">समय (मिनट)</label>
                  <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
              </div>
              
              {genError && <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg font-medium">{String(genError)}</div>}

              <button onClick={triggerQuizGeneration} disabled={isGenerating || isParsingPdf} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-70 text-white font-bold py-4 rounded-xl transition mt-6 shadow-lg shadow-indigo-500/30">
                {isGenerating ? "AI प्रश्न बना रहा है..." : "CBT पेपर जनरेट करें"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-quizzes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
              <h4 className="font-bold text-slate-800 truncate">{String(quiz.title)}</h4>
              <p className="text-xs text-slate-500 mt-1 font-medium">{quiz.numQuestions} Qs • {quiz.durationMinutes} Mins • {quiz.difficulty || 'Standard'}</p>
              <button onClick={() => startQuizCbtFlow(quiz)} className="mt-5 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2.5 rounded-lg transition border border-indigo-100">परीक्षा प्रारंभ करें</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
         <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                 <tr><th className="p-4 font-bold">परीक्षा</th><th className="p-4 text-center font-bold">अंक</th><th className="p-4 text-center font-bold">सटीकता</th><th className="p-4 text-center font-bold">एक्शन</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {attempts.map(att => (
                   <tr key={att.id} className="hover:bg-slate-50 transition">
                     <td className="p-4 font-bold text-slate-800">{String(att.quizTitle)}</td>
                     <td className="p-4 text-center text-emerald-600 font-bold">{att.marksObtained}/{att.maxMarks}</td>
                     <td className="p-4 text-center font-bold text-indigo-600">{att.accuracy}%</td>
                     <td className="p-4 text-center">
                       <button className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-md font-bold transition" onClick={() => {
                         const parentQuiz = quizzes.find(q => q.id === att.quizId);
                         if (parentQuiz) {
                           setActiveTestState({
                               currentQuiz: { ...parentQuiz, questions: typeof parentQuiz.questions === 'string' ? JSON.parse(parentQuiz.questions) : parentQuiz.questions },
                               answers: typeof att.answers === 'string' ? JSON.parse(att.answers) : att.answers,
                               testViewState: 'result'
                           });
                           navigate('/exam');
                         }
                       }}>समीक्षा</button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}
    </div>
  );
}
