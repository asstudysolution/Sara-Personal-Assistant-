/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Bookmark,
  Sparkles,
  Play,
  Trash2,
  X,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { StructuredLesson } from '../types';

interface SavedNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedLessons: StructuredLesson[];
  weakTopics: string[];
  onSelectLesson: (lesson: StructuredLesson) => void;
  onDeleteLesson: (lessonId: string) => void;
  onReviseTopic: (topic: string) => void;
  onClearWeakTopics: () => void;
}

export const SavedNotesModal: React.FC<SavedNotesModalProps> = ({
  isOpen,
  onClose,
  savedLessons,
  weakTopics,
  onSelectLesson,
  onDeleteLesson,
  onReviseTopic,
  onClearWeakTopics,
}) => {
  const [activeTab, setActiveTab] = useState<'lessons' | 'weakTopics'>('lessons');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-pink-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-600 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                रिवीजन नोट्स और कमजोर टॉपिक
              </h3>
              <p className="text-xs text-slate-500">
                सहेजे गए व्हाइटबोर्ड पाठ और जिनपर अभ्यास की जरूरत है
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

        {/* Tab Switcher */}
        <div className="flex items-center p-1.5 m-3 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'lessons'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            व्हाइटबोर्ड पाठ ({savedLessons.length})
          </button>
          <button
            onClick={() => setActiveTab('weakTopics')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'weakTopics'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            कमजोर टॉपिक ({weakTopics.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {activeTab === 'lessons' ? (
            savedLessons.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">अभी कोई पाठ सहेजा नहीं गया है!</p>
                <p className="text-xs mt-1">
                  व्हाइटबोर्ड पर पढ़ाते समय बुकमार्क आइकन दबाकर पाठ को यहाँ सुरक्षित करें।
                </p>
              </div>
            ) : (
              savedLessons.map((lesson) => (
                <div
                  key={lesson.id || lesson.title}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 hover:border-pink-200 transition-colors"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                      {lesson.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {lesson.steps.length} चरण ·{' '}
                      {lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString('hi-IN') : 'हाल ही में'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        onSelectLesson(lesson);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-2xs transition-all"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>बोर्ड पर चलाएं</span>
                    </button>
                    {lesson.id && (
                      <button
                        onClick={() => onDeleteLesson(lesson.id!)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors"
                        title="हटाएं"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            weakTopics.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-sm font-semibold">कोई कमजोर विषय दर्ज नहीं है!</p>
                <p className="text-xs mt-1">
                  जब आप प्रैक्टिस परीक्षा में कोई सवाल गलत करेंगे, तो वह टॉपिक यहाँ स्वतः जुड़ जाएगा।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    इन विषयों पर अधिक ध्यान देने की आवश्यकता है:
                  </span>
                  <button
                    onClick={onClearWeakTopics}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    सभी हटाएं
                  </button>
                </div>

                {weakTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {topic}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        onReviseTopic(topic);
                        onClose();
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-2xs transition-all shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>बोर्ड पर समझें</span>
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
