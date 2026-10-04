/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  X,
  FileText,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { UserSettings, MCQQuestion, ExamSession } from '../types';
import { generateExamMCQs } from '../services/gemini';

interface ExamPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onExplainOnWhiteboard: (question: MCQQuestion) => void;
}

export const ExamPracticeModal: React.FC<ExamPracticeModalProps> = ({
  isOpen,
  onClose,
  settings,
  onExplainOnWhiteboard,
}) => {
  // Phase: 'setup' | 'quiz' | 'result'
  const [phase, setPhase] = useState<'setup' | 'quiz' | 'result'>('setup');

  // Setup form
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [chapterName, setChapterName] = useState<string>('Real Numbers & Quadratic Equations');
  const [pastedNotes, setPastedNotes] = useState<string>('');
  const [isLoadingQuiz, setIsLoadingQuiz] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quiz state
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState<number>(20 * 60); // 20 minutes
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Countdown timer
  useEffect(() => {
    let interval: number;
    if (timerActive && timeLeft > 0 && phase === 'quiz') {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleFinishExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, phase]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartExam = async () => {
    if (!chapterName.trim()) {
      setErrorMsg('Please specify a chapter or topic name!');
      return;
    }

    setIsLoadingQuiz(true);
    setErrorMsg(null);

    try {
      const generated = await generateExamMCQs(
        selectedSubject,
        chapterName + (pastedNotes ? ` (Notes: ${pastedNotes.slice(0, 300)})` : ''),
        settings
      );

      if (!generated || generated.length === 0) {
        throw new Error('Failed to generate questions. Please try again.');
      }

      setQuestions(generated);
      setUserAnswers({});
      setCurrentIndex(0);
      setTimeLeft(20 * 60);
      setPhase('quiz');
      setTimerActive(true);
    } catch (err: any) {
      console.error('Error generating MCQs:', err);
      setErrorMsg(err.message || 'Could not generate exam questions. Please try once more!');
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIdx,
    }));
  };

  const handleFinishExam = () => {
    setTimerActive(false);

    // Calculate score
    let score = 0;
    const weakTopicsList: string[] = [];

    questions.forEach((q, idx) => {
      const selected = userAnswers[idx];
      if (selected === q.answerIndex) {
        score++;
      } else {
        if (q.topic && !weakTopicsList.includes(q.topic)) {
          weakTopicsList.push(q.topic);
        }
      }
    });

    // Save weak topics to localStorage
    try {
      const existingRaw = localStorage.getItem('sara_weak_topics');
      const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = Array.from(new Set([...existing, ...weakTopicsList]));
      localStorage.setItem('sara_weak_topics', JSON.stringify(updated));

      // Save Exam Session History
      const sessionHistory: ExamSession = {
        subject: selectedSubject,
        chapter: chapterName,
        questions,
        userAnswers,
        score,
        total: questions.length,
        timeSpentSeconds: 20 * 60 - timeLeft,
        date: new Date().toLocaleDateString(),
        weakTopics: weakTopicsList,
      };
      const existingSessionsRaw = localStorage.getItem('sara_exam_sessions');
      const existingSessions: ExamSession[] = existingSessionsRaw ? JSON.parse(existingSessionsRaw) : [];
      localStorage.setItem('sara_exam_sessions', JSON.stringify([sessionHistory, ...existingSessions.slice(0, 15)]));
    } catch (e) {
      console.warn('Failed to save exam stats to localStorage:', e);
    }

    setPhase('result');

    // Trigger celebration confetti if score >= 70%
    if (questions.length > 0 && score / questions.length >= 0.7) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const resetToSetup = () => {
    setPhase('setup');
    setUserAnswers({});
    setQuestions([]);
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const scoreCount = questions.filter((q, idx) => userAnswers[idx] === q.answerIndex).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-pink-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                Exam Practice Mode · 20 MCQs
              </h3>
              <p className="text-xs text-slate-500">
                {settings.boardExam || 'Bihar Board (BSEB)'} / {settings.academicLevel || 'Class 10'} Pattern
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* PHASE 1: SETUP */}
          {phase === 'setup' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Subject:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    'Mathematics',
                    'Science (Physics)',
                    'Science (Chemistry)',
                    'Science (Biology)',
                    'Social Science',
                    'English',
                    'Hindi',
                    'Computer Science',
                  ].map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubject(sub)}
                      className={`p-2 rounded-xl text-xs font-semibold text-center border transition-all ${
                        selectedSubject === sub
                          ? 'bg-pink-500 text-white border-pink-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chapter or Exam Topic:
                </label>
                <input
                  type="text"
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  placeholder="e.g. Real Numbers, Trigonometry, Light & Reflection, Electricity"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Optional: Paste Notes or Syllabus Text
                </label>
                <textarea
                  value={pastedNotes}
                  onChange={(e) => setPastedNotes(e.target.value)}
                  rows={3}
                  placeholder="Paste specific definitions, formulas, or question types you want Sara to test you on..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={handleStartExam}
                disabled={isLoadingQuiz}
                className="w-full py-3 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isLoadingQuiz ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sara is crafting your 20 Board Exam MCQs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Start 20-MCQ Timed Exam</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* PHASE 2: QUIZ IN PROGRESS */}
          {phase === 'quiz' && currentQ && (
            <div className="space-y-4">
              {/* Timer & Progress bar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span className="text-pink-600 font-extrabold text-sm">
                    Q{currentIndex + 1}
                  </span>
                  <span>/ {questions.length}</span>
                  {currentQ.topic && (
                    <span className="hidden sm:inline text-slate-400 font-normal">
                      · {currentQ.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              </div>

              {/* Question text */}
              <div className="p-4 rounded-2xl bg-pink-50/40 dark:bg-slate-800/60 border border-pink-100 dark:border-slate-700">
                <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {currentQ.question}
                </p>
              </div>

              {/* 4 MCQ Options */}
              <div className="space-y-2">
                {currentQ.options.map((option, optIdx) => {
                  const isSelected = userAnswers[currentIndex] === optIdx;
                  const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'bg-pink-500 text-white border-pink-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-white text-pink-600'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Nav Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-2">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIndex((prev) => prev + 1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-xs"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinishExam}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Submit & View Score</span>
                  </button>
                )}
              </div>

              {/* Quick Jump Question Matrix */}
              <div className="pt-2">
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  {questions.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-6 h-6 rounded-md text-[10px] font-bold shrink-0 transition-colors ${
                        idx === currentIndex
                          ? 'ring-2 ring-pink-400 bg-pink-600 text-white'
                          : userAnswers[idx] !== undefined
                          ? 'bg-pink-100 text-pink-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PHASE 3: RESULTS & WHITEBOARD REVIEW */}
          {phase === 'result' && (
            <div className="space-y-5">
              {/* Scorecard banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-pink-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 border border-pink-100 dark:border-slate-700 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-pink-500 text-white flex items-center justify-center mx-auto shadow-md">
                  <Award className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-black text-slate-800 dark:text-slate-100">
                  {scoreCount >= 16
                    ? '🎉 Shabaash! Outstanding Performance!'
                    : scoreCount >= 10
                    ? '👍 Good Effort! A little more practice!'
                    : "💪 Don't worry! Sara is here to teach you!"}
                </h4>
                <p className="text-3xl font-extrabold text-pink-600">
                  {scoreCount} / {questions.length}
                </p>
                <p className="text-xs text-slate-500">
                  Percentage: {Math.round((scoreCount / questions.length) * 100)}% · Time Spent: {formatTime(20 * 60 - timeLeft)}
                </p>
              </div>

              {/* Mistake Review List */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Review & Whiteboard Explanations:
                </h5>

                {questions.map((q, idx) => {
                  const selected = userAnswers[idx];
                  const isCorrect = selected === q.answerIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isCorrect
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                          : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          {isCorrect ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Q{idx + 1}. {q.question}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1 mb-2">
                        <p className="text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">Correct Answer:</span> Option{' '}
                          {String.fromCharCode(65 + q.answerIndex)} ({q.options[q.answerIndex]})
                        </p>
                        {!isCorrect && selected !== undefined && (
                          <p className="text-rose-600 dark:text-rose-400">
                            <span className="font-semibold">You Chose:</span> Option{' '}
                            {String.fromCharCode(65 + selected)} ({q.options[selected]})
                          </p>
                        )}
                        <p className="text-slate-500 italic text-[11px] leading-relaxed pt-1">
                          💡 {q.explanation}
                        </p>
                      </div>

                      {/* Explain on Whiteboard Button */}
                      {!isCorrect && (
                        <button
                          onClick={() => {
                            onExplainOnWhiteboard(q);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-2xs transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Explain this on Whiteboard</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={resetToSetup}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Practice Another Chapter</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-colors"
                >
                  Back to Study Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
