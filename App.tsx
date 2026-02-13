
import React, { useState, useEffect, useRef } from 'react';
import { Subject, QuestionCount, YearLevel, Question, AppState, TestResult } from './types';
import { generateQuestions, speakText } from './services/geminiService';
import Button from './components/Button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Header = () => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
    <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <span className="text-white font-bold text-xl">N</span>
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
          NAPLAN Explorer
        </h1>
      </div>
      <div className="hidden md:block text-sm text-slate-500 font-medium">
        v9.0 Curriculum Practice
      </div>
    </div>
  </header>
);

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('setup');
  const [subject, setSubject] = useState<Subject>(Subject.MATH);
  const [yearLevel, setYearLevel] = useState<YearLevel>(3);
  const [count, setCount] = useState<QuestionCount>(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const timerRef = useRef<any>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (appState === 'testing' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            finishTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (appState !== 'testing') {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [appState, timeLeft]);

  const handleSpeak = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const text = questions[currentQuestionIndex].text;
      const buffer = await speakText(text);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsSpeaking(false);
      audioSourceRef.current = source;
      source.start();
    } catch (e) {
      console.error("Speech failed", e);
      setIsSpeaking(false);
    }
  };

  const startTest = async () => {
    setIsLoading(true);
    setAppState('loading');
    try {
      const qs = await generateQuestions(subject, count, yearLevel);
      setQuestions(qs);
      
      const minutes = count === 50 ? 60 : count;
      setTimeLeft(minutes * 60);
      
      setAppState('testing');
      setCurrentQuestionIndex(0);
      setUserAnswers({});
    } catch (error) {
      console.error("Failed to load questions", error);
      alert("Something went wrong generating questions. Please try again.");
      setAppState('setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (optionIndex: number) => {
    const questionId = questions[currentQuestionIndex].id;
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const finishTest = () => {
    const answers = questions.map(q => {
      const selectedOption = userAnswers[q.id];
      return {
        questionId: q.id,
        selectedOption: selectedOption !== undefined ? selectedOption : -1,
        isCorrect: selectedOption === q.correctAnswerIndex
      };
    });

    const score = answers.filter(a => a.isCorrect).length;
    
    setResult({
      score,
      totalQuestions: questions.length,
      yearLevel,
      answers,
      subject,
      timestamp: Date.now()
    });
    setAppState('results');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setIsSpeaking(false);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      if (audioSourceRef.current) audioSourceRef.current.stop();
      setIsSpeaking(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestionId = questions[currentQuestionIndex]?.id;
  const isAnswered = userAnswers[currentQuestionId] !== undefined;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 md:py-12">
        {appState === 'setup' && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Practice Version 9.0
              </h2>
              <p className="text-slate-600 text-lg">
                Official Australian Curriculum alignment for Year 1 to Year 6.
              </p>
            </div>

            <div className="space-y-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                  1. Select Subject
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[Subject.MATH, Subject.ENGLISH].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSubject(s)}
                      className={`p-6 rounded-2xl border-2 transition-all text-left group ${
                        subject === s 
                        ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-600/10' 
                        : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                        subject === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-200'
                      }`}>
                        {s === Subject.MATH ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                        )}
                      </div>
                      <span className={`font-bold block text-lg ${subject === s ? 'text-blue-900' : 'text-slate-700'}`}>{s}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                  2. Select Year Level
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((y) => (
                    <button
                      key={y}
                      onClick={() => setYearLevel(y as YearLevel)}
                      className={`py-4 rounded-xl border-2 font-bold transition-all ${
                        yearLevel === y
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-[10px] opacity-70 mb-0.5">Year</span>
                      <span className="text-lg">{y}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
                  3. Question Count & Time
                </label>
                <div className="flex flex-wrap gap-3">
                  {[10, 20, 30, 50].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCount(c as QuestionCount)}
                      className={`flex-1 min-w-[60px] py-4 rounded-xl border-2 font-bold transition-all ${
                        count === c
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {c} qns
                      <span className="block text-[10px] opacity-70 font-normal mt-1">
                        {c === 50 ? '60 mins' : `${c} mins`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button size="xl" onClick={startTest} isLoading={isLoading}>
                  Begin Practice
                </Button>
              </div>
            </div>
          </div>
        )}

        {appState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-8 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-xl">AI</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Crafting Questions...</h2>
            <p className="text-slate-500 max-w-xs">
              Gemini is building your v9.0 practice test for Year {yearLevel}.
            </p>
          </div>
        )}

        {appState === 'testing' && questions.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-blue-600 uppercase tracking-widest">
                    Year {yearLevel} • {subject} • Q{currentQuestionIndex + 1}/{questions.length}
                  </span>
                  <span className={`text-sm font-black px-3 py-1 rounded-full ${timeLeft < 60 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300 ease-out"
                    style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-10 mb-8 relative overflow-hidden">
              {yearLevel <= 2 && (
                <button 
                  onClick={handleSpeak}
                  disabled={isSpeaking}
                  className={`absolute top-6 right-6 p-4 rounded-full shadow-lg transition-all ${isSpeaking ? 'bg-blue-600 text-white scale-110' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd"></path></svg>
                </button>
              )}

              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-6">
                  {questions[currentQuestionIndex].category}
                </span>

                <p className={`text-xl md:text-2xl font-semibold text-slate-900 leading-relaxed mb-8 ${yearLevel <= 2 ? 'pr-14' : ''}`}>
                  {questions[currentQuestionIndex].text}
                </p>
              </div>

              <div className="space-y-4">
                {questions[currentQuestionIndex].options.map((option, idx) => {
                  const isSelected = userAnswers[currentQuestionId] === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswerSelect(idx)}
                      className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${
                        isSelected 
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/10' 
                        : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 flex-shrink-0 rounded-full border-2 flex items-center justify-center font-bold ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-400'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className={`text-lg ${isSelected ? 'text-blue-900 font-semibold' : 'text-slate-700 font-medium'}`}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between items-center gap-4">
              <Button 
                variant="outline" 
                onClick={prevQuestion} 
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              
              {currentQuestionIndex === questions.length - 1 ? (
                <Button 
                  onClick={finishTest} 
                  variant="primary" 
                  className="px-12"
                  disabled={!isAnswered}
                >
                  Submit & See Results
                </Button>
              ) : (
                <Button 
                  onClick={nextQuestion} 
                  className="px-12"
                  disabled={!isAnswered}
                >
                  Next Question
                </Button>
              )}
            </div>
          </div>
        )}

        {appState === 'results' && result && (
          <div className="max-w-4xl mx-auto pb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black text-slate-900 mb-2">Performance Summary</h2>
              <p className="text-slate-500 text-lg">Year {result.yearLevel} • {result.subject} (v9.0)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl md:col-span-1 flex flex-col items-center justify-center">
                <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                  <svg className="absolute w-full h-full -rotate-90">
                    <circle 
                      cx="80" cy="80" r="70" 
                      fill="none" stroke="#F1F5F9" strokeWidth="12"
                    />
                    <circle 
                      cx="80" cy="80" r="70" 
                      fill="none" stroke="#2563EB" strokeWidth="12"
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * (result.score / result.totalQuestions))}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-5xl font-black text-slate-900">{Math.round((result.score / result.totalQuestions) * 100)}%</div>
                    <div className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Score</div>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-slate-900 font-bold text-xl">{result.score} / {result.totalQuestions}</p>
                  <p className="text-slate-500 text-sm">Correct Answers</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl md:col-span-2">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Learning Areas</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(() => {
                        const categoriesMap: Record<string, { total: number, correct: number }> = {};
                        questions.forEach((q, idx) => {
                          const isCorrect = result.answers[idx].isCorrect;
                          if (!categoriesMap[q.category]) {
                            categoriesMap[q.category] = { total: 0, correct: 0 };
                          }
                          categoriesMap[q.category].total++;
                          if (isCorrect) categoriesMap[q.category].correct++;
                        });
                        return Object.entries(categoriesMap).map(([name, stats]) => ({
                          name,
                          score: Math.round((stats.correct / stats.total) * 100)
                        }));
                      })()}
                    >
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                Detailed Review
              </h3>
              
              {questions.map((q, idx) => {
                const answer = result.answers[idx];
                return (
                  <div 
                    key={q.id} 
                    className={`bg-white rounded-2xl border-2 p-6 transition-all ${
                      answer.isCorrect ? 'border-emerald-100' : 'border-rose-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          answer.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-slate-900 text-lg leading-snug">{q.text}</h4>
                      </div>
                    </div>

                    <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                      <div className={`p-4 rounded-xl border ${answer.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <span className="block font-bold opacity-60 uppercase text-[10px] mb-1">Your Choice</span>
                        <span className="font-bold">{answer.selectedOption === -1 ? 'Timed Out' : q.options[answer.selectedOption]}</span>
                      </div>
                      {!answer.isCorrect && (
                        <div className="p-4 bg-emerald-50 border-emerald-100 rounded-xl">
                          <span className="block font-bold text-emerald-600 uppercase text-[10px] mb-1">Correct Choice</span>
                          <span className="font-bold text-emerald-800">{q.options[q.correctAnswerIndex]}</span>
                        </div>
                      )}
                    </div>

                    <div className="ml-11 p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-slate-700 leading-relaxed text-sm">
                      <span className="font-bold text-blue-700 block mb-1">Explanation</span>
                      {q.explanation}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex justify-center sticky bottom-8">
              <Button onClick={() => setAppState('setup')} size="lg" className="shadow-2xl">
                New Practice Session
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
