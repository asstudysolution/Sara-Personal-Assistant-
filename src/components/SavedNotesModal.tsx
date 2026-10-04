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
                My Revision Notes & Weak Topics
              </h3>
              <p className="text-xs text-slate-500">
                Saved whiteboard lessons & areas to strengthen
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
            Whiteboard Lessons ({savedLessons.length})
          </button>
          <button
            onClick={() => setActiveTab('weakTopics')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'weakTopics'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            Weak Exam Topics ({weakTopics.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {activeTab === 'lessons' ? (
            savedLessons.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Bookmark className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No saved lessons yet!</p>
                <p className="text-xs mt-1">
                  Click the bookmark icon on the whiteboard while Sara is teaching to save lessons here.
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
                      {lesson.steps.length} teaching steps ·{' '}
                      {lesson.createdAt ? new Date(lesson.createdAt).toLocaleDateString() : 'Recent'}
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
                      <span>Replay</span>
                    </button>
                    {lesson.id && (
                      <button
                        onClick={() => onDeleteLesson(lesson.id!)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition-colors"
                        title="Delete lesson"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            /* Weak Topics */
            weakTopics.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-500" />
                <p className="text-sm font-semibold">No weak topics logged!</p>
                <p className="text-xs mt-1">
                  When you take tests in Exam Practice mode, questions you miss will appear here for targeted revision.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Topics Needing Extra Attention:
                  </span>
                  <button
                    onClick={onClearWeakTopics}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Clear All
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
                      <span>Revise on Board</span>
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
