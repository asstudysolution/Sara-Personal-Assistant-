/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  Mic,
  MicOff,
  Send,
  Upload,
  Settings as SettingsIcon,
  BookOpen,
  Award,
  Video,
  Volume2,
  VolumeX,
  Trash2,
  RefreshCw,
  AlertCircle,
  X,
  Paperclip,
} from 'lucide-react';
import {
  UserSettings,
  ChatMessage,
  StructuredLesson,
  SaraMood,
  AnswerStyle,
  MCQQuestion,
} from './types';
import {
  generateWhiteboardLesson,
  streamChatResponse,
  checkStudentWork,
  formatFriendlyError,
} from './services/gemini';
import { audioPlayer } from './services/audioPlayer';
import { SaraAvatar } from './components/SaraAvatar';
import { Whiteboard } from './components/Whiteboard';
import { ApiKeySetupCard } from './components/ApiKeySetupCard';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { LiveLookModal } from './components/LiveLookModal';
import { ExamPracticeModal } from './components/ExamPracticeModal';
import { SettingsModal } from './components/SettingsModal';
import { SavedNotesModal } from './components/SavedNotesModal';

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  academicLevel: 'Class 10 (Matric)',
  boardExam: 'Bihar Board (BSEB)',
  language: 'Hinglish',
  textModel: 'gemini-2.5-flash',
  ttsModel: 'gemini-3.1-flash-tts-preview',
  voiceName: 'Leda',
  voiceEnergy: 'Cheerful',
  whiteboardTheme: 'cream',
  speechInputLang: 'en-IN',
  darkMode: false,
};

const INITIAL_LESSON: StructuredLesson = {
  id: 'lesson-welcome',
  title: 'Welcome to Sara Study Room! ✨',
  steps: [
    {
      say: "Namaste! Hehe, I'm Sara, your cute AI study buddy! I love teaching on this whiteboard. Ask me any math, science, or board exam question, or show me your textbook with the camera!",
      board: [
        { type: 'text', x: 25, y: 15, content: '🌸 Sara Study Buddy Whiteboard 🌸', color: '#7C3AED', fontSize: 26 },
        { type: 'line', x: 22, y: 18, width: 56, height: 0, color: '#FFB7B2' },
        { type: 'text', x: 15, y: 35, content: '• Step-by-Step Maths & Science Explanations', color: '#1E40AF', fontSize: 18 },
        { type: 'text', x: 15, y: 48, content: '• Real-Time Camera Vision (Capture & Ask)', color: '#1E40AF', fontSize: 18 },
        { type: 'text', x: 15, y: 61, content: '• Bihar Board BSEB & CBSE 20-MCQ Exam Practice', color: '#1E40AF', fontSize: 18 },
        { type: 'formula', x: 15, y: 78, content: 'y = mx + c   |   E = mc²   |   sin²θ + cos²θ = 1', color: '#059669', fontSize: 19 },
      ],
    },
  ],
};

export default function App() {
  // 1. Settings & API Key
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const storedKey = localStorage.getItem('sara_gemini_api_key') || '';
      const storedSettings = localStorage.getItem('sara_settings');
      if (storedSettings) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings), apiKey: storedKey };
      }
      return { ...DEFAULT_SETTINGS, apiKey: storedKey };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // 2. Chat history
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('sara_chat_history');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content:
          "Namaste! Hehe, I'm Sara, your cute AI study buddy! 🌸 Ask me any question, tap Camera to show me a book page, or click one of the quick buttons below. Let's learn together! Yay! ✨",
        timestamp: Date.now(),
      },
    ];
  });

  // Save chat to localStorage (up to 20 messages)
  useEffect(() => {
    try {
      localStorage.setItem('sara_chat_history', JSON.stringify(messages.slice(-20)));
    } catch {}
  }, [messages]);

  // 3. Current Whiteboard Lesson
  const [currentLesson, setCurrentLesson] = useState<StructuredLesson | null>(INITIAL_LESSON);

  // 4. Saved Lessons & Weak Topics
  const [savedLessons, setSavedLessons] = useState<StructuredLesson[]>(() => {
    try {
      const raw = localStorage.getItem('sara_saved_notes');
      return raw ? JSON.parse(raw) : [INITIAL_LESSON];
    } catch {
      return [INITIAL_LESSON];
    }
  });

  const [weakTopics, setWeakTopics] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('sara_weak_topics');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // 5. Avatar Mood & Sleepiness Timer
  const [saraMood, setSaraMood] = useState<SaraMood>('idle');
  const inactivityTimerRef = useRef<number | null>(null);

  const resetInactivityTimer = () => {
    if (saraMood === 'sleepy') {
      setSaraMood('idle');
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Set sleepy after 60 seconds of no interaction
    inactivityTimerRef.current = window.setTimeout(() => {
      setSaraMood('sleepy');
    }, 60000);
  };

  useEffect(() => {
    resetInactivityTimer();
    const handleUserActivity = () => resetInactivityTimer();

    window.addEventListener('pointerdown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    return () => {
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  // 6. Audio mute state
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioPlayer.setMuted(next);
  };

  // 7. Modals
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isLiveLookOpen, setIsLiveLookOpen] = useState<boolean>(false);
  const [isExamPracticeOpen, setIsExamPracticeOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSavedNotesOpen, setIsSavedNotesOpen] = useState<boolean>(false);

  // 8. Input & Speech Recognition
  const [inputText, setInputText] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [isCheckingWork, setIsCheckingWork] = useState<boolean>(false);
  const [isLoadingAnswer, setIsLoadingAnswer] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRecRef = useRef<any>(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoadingAnswer]);

  // Speech Recognition toggle
  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage("Speech recognition is not supported in this browser. Please type your question! 🎙️");
      return;
    }

    if (isListeningMic) {
      if (speechRecRef.current) {
        speechRecRef.current.stop();
      }
      setIsListeningMic(false);
      setSaraMood('idle');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = settings.speechInputLang || 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningMic(true);
        setSaraMood('listening');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          // Auto-send when silence is detected
          setTimeout(() => {
            handleSend(transcript);
          }, 300);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event);
        setIsListeningMic(false);
        setSaraMood('idle');
      };

      recognition.onend = () => {
        setIsListeningMic(false);
        setSaraMood('idle');
      };

      speechRecRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Mic start failed:', err);
      setIsListeningMic(false);
      setSaraMood('idle');
    }
  };

  // Submit Query to Sara
  const handleSend = async (overrideText?: string, answerStyle?: AnswerStyle) => {
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToSend && !attachedImage) return;

    if (!settings.apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    resetInactivityTimer();
    setErrorMessage(null);
    setInputText('');

    const userMsgId = 'msg-' + Date.now();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      image: attachedImage || undefined,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoadingAnswer(true);
    setSaraMood('thinking');

    // Parse image inlineData if present
    let imagePart: { mimeType: string; data: string } | undefined;
    if (attachedImage) {
      const match = attachedImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        imagePart = { mimeType: match[1], data: match[2] };
      }
    }

    const currentImg = attachedImage;
    setAttachedImage(null); // Clear attachment

    try {
      // 1. First attempt to generate a structured whiteboard lesson
      const whiteboardRes = await generateWhiteboardLesson(
        textToSend || 'Explain the concept in this image',
        settings,
        imagePart,
        answerStyle
      );

      if (whiteboardRes.lesson) {
        // Successful whiteboard lesson
        setCurrentLesson(whiteboardRes.lesson);

        const assistantMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          role: 'assistant',
          content: `Yay! I've prepared a visual lesson on "${whiteboardRes.lesson.title}" on the whiteboard! Follow along step-by-step! ✨`,
          timestamp: Date.now(),
          whiteboardLesson: whiteboardRes.lesson,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setSaraMood('happy');

        // Speak the first step's explanation
        if (whiteboardRes.lesson.steps[0]) {
          audioPlayer.speakText(whiteboardRes.lesson.steps[0].say, settings, 'step-0', () => {
            setSaraMood('idle');
          });
        }
      } else {
        // Fallback to conversational streaming text
        let fullStreamed = '';
        const streamMsgId = 'msg-' + (Date.now() + 1);

        setMessages((prev) => [
          ...prev,
          {
            id: streamMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            timestamp: Date.now(),
          },
        ]);

        fullStreamed = await streamChatResponse(
          messages,
          textToSend,
          settings,
          imagePart,
          answerStyle,
          (chunkText) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamMsgId ? { ...m, content: chunkText } : m))
            );
          }
        );

        setMessages((prev) =>
          prev.map((m) => (m.id === streamMsgId ? { ...m, isStreaming: false } : m))
        );

        setSaraMood('talking');
        // Speak initial sentence of response
        const firstSentence = fullStreamed.split(/[.?!।\n]/)[0] || fullStreamed.slice(0, 100);
        audioPlayer.speakText(firstSentence, settings, undefined, () => {
          setSaraMood('idle');
        });
      }
    } catch (err: any) {
      console.error('Error generating answer:', err);
      const friendly = formatFriendlyError(err);
      setErrorMessage(friendly);
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: friendly,
          timestamp: Date.now(),
          error: friendly,
        },
      ]);
      setSaraMood('idle');
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  // Quick Answer Style Buttons
  const handleQuickStyle = (style: AnswerStyle) => {
    if (inputText.trim()) {
      handleSend(inputText.trim(), style);
    } else {
      handleSend(`Please give me a ${style.toLowerCase()} for our current topic!`, style);
    }
  };

  // Check My Work from Whiteboard
  const handleCheckMyWork = async (snapshotBase64: string) => {
    if (!settings.apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setIsCheckingWork(true);
    setSaraMood('thinking');

    try {
      const evaluation = await checkStudentWork(snapshotBase64, inputText, settings);

      const assistantMsg: ChatMessage = {
        id: 'msg-check-' + Date.now(),
        role: 'assistant',
        content: `🔍 **Sara's Work Check**:\n\n${evaluation}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setSaraMood('happy');
      audioPlayer.speakText(evaluation.slice(0, 180), settings, undefined, () => {
        setSaraMood('idle');
      });
    } catch (err: any) {
      setErrorMessage(formatFriendlyError(err));
      setSaraMood('idle');
    } finally {
      setIsCheckingWork(false);
    }
  };

  // Save lesson to My Notes
  const handleSaveLesson = (lessonToSave: StructuredLesson) => {
    const updated = [lessonToSave, ...savedLessons.filter((l) => l.id !== lessonToSave.id)];
    setSavedLessons(updated);
    try {
      localStorage.setItem('sara_saved_notes', JSON.stringify(updated.slice(0, 30)));
    } catch {}
    setSaraMood('happy');
  };

  const handleDeleteSavedLesson = (lessonId: string) => {
    const updated = savedLessons.filter((l) => l.id !== lessonId);
    setSavedLessons(updated);
    try {
      localStorage.setItem('sara_saved_notes', JSON.stringify(updated));
    } catch {}
  };

  // Revise weak topic on Whiteboard
  const handleReviseTopic = (topic: string) => {
    handleSend(`Please teach me the complete concept of "${topic}" step-by-step on the whiteboard!`);
  };

  const handleClearWeakTopics = () => {
    setWeakTopics([]);
    try {
      localStorage.removeItem('sara_weak_topics');
    } catch {}
  };

  // Explain MCQ Question on Whiteboard
  const handleExplainMCQOnWhiteboard = (q: MCQQuestion) => {
    const prompt = `Please teach this question on the whiteboard step-by-step:
Question: ${q.question}
Correct Answer: ${q.options[q.answerIndex]}
Concept: ${q.topic}
Show why the correct answer is right and why the common trap options are wrong!`;
    handleSend(prompt);
  };

  // File Upload handler for bottom dock
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setAttachedImage(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-cleared',
        role: 'assistant',
        content: "Chat cleared! Hehe, fresh slate! What topic should we tackle next? 🌸",
        timestamp: Date.now(),
      },
    ]);
  };

  // First Launch Screen if no key is saved
  if (!settings.apiKey) {
    return (
      <ApiKeySetupCard
        onSaveKey={(savedKey, discovered) => {
          const updated: UserSettings = {
            ...settings,
            apiKey: savedKey,
            textModel: discovered?.bestFlashModel || settings.textModel || 'gemini-2.5-flash',
            ttsModel: discovered?.bestTtsModel || settings.ttsModel || 'gemini-3.1-flash-tts-preview',
            availableTextModels: discovered?.availableTextModels,
            availableTtsModels: discovered?.availableTtsModels,
          };
          setSettings(updated);
          localStorage.setItem('sara_gemini_api_key', savedKey);
          localStorage.setItem('sara_settings', JSON.stringify(updated));
        }}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col font-ui transition-colors duration-300 ${
        settings.darkMode
          ? 'bg-slate-950 text-slate-100'
          : 'bg-[#FAF7F0] text-slate-800'
      }`}
    >
      {/* 1. TOP HEADER BAR */}
      <header className="sticky top-0 z-40 px-3 sm:px-6 py-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-pink-100 dark:border-slate-800 flex items-center justify-between shadow-2xs">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2">
          <div
            onClick={() => setSaraMood('happy')}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-400 to-rose-300 flex items-center justify-center shadow-xs cursor-pointer hover:rotate-12 transition-transform"
          >
            <span className="text-sm">👧</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-pink-600 dark:text-pink-400 tracking-tight font-handwriting">
                Sara
              </h1>
              <span className="text-[11px] font-bold text-slate-500 hidden xs:inline">
                · {settings.academicLevel}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              {settings.boardExam} · {settings.language} Study Buddy
            </p>
          </div>
        </div>

        {/* Header Action Nav */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Live Look Button */}
          <button
            onClick={() => setIsLiveLookOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
            title="Live Look: Continuous video and voice study tutor"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Live Look</span>
          </button>

          {/* Exam Practice Button */}
          <button
            onClick={() => setIsExamPracticeOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold transition-colors"
            title="Exam Practice: 20 Board-style MCQs with timer"
          >
            <Award className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">20-MCQ Exam</span>
          </button>

          {/* My Notes Button */}
          <button
            onClick={() => setIsSavedNotesOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
            title="My Saved Lessons & Weak Topics"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">My Notes</span>
          </button>

          {/* Voice Mute / Unmute */}
          <button
            onClick={handleToggleMute}
            className={`p-1.5 rounded-xl border text-xs transition-colors ${
              isMuted
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
            title={isMuted ? 'Unmute Sara' : 'Mute Sara'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-pink-500" />}
          </button>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Settings & Key"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN STUDY ROOM CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-2 sm:p-4 flex flex-col gap-3">
        {/* Error Banner if any */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* WHITEBOARD & AVATAR ROW */}
        <div className="relative w-full h-[380px] sm:h-[460px] md:h-[500px]">
          {/* Sara Interactive Whiteboard */}
          <Whiteboard
            lesson={currentLesson}
            settings={settings}
            onCheckMyWork={handleCheckMyWork}
            onSaveLesson={handleSaveLesson}
            onSaraMoodChange={(mood) => setSaraMood(mood)}
            isCheckingWork={isCheckingWork}
          />

          {/* Sara Anime Avatar positioned in bottom-right corner of the stage */}
          <div className="absolute -bottom-2 -right-1 sm:bottom-1 sm:right-2 z-20 pointer-events-auto">
            <SaraAvatar
              mood={saraMood}
              onAvatarClick={() => {
                setSaraMood('happy');
                audioPlayer.speakText(
                  "Hehe! I'm right here cheering you on! Let's solve more problems! Yay! ✨",
                  settings
                );
              }}
              compact={false}
            />
          </div>
        </div>

        {/* QUICK ANSWER STYLE BUTTONS */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none select-none">
          <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Style:
          </span>
          {(
            [
              'Explain simply',
              'Explain in detail',
              'Exam answer (points to write)',
              'Quick revision',
              'Quiz me (MCQs)',
              'Why did I get this wrong?',
            ] as AnswerStyle[]
          ).map((style) => (
            <button
              key={style}
              onClick={() => handleQuickStyle(style)}
              disabled={isLoadingAnswer}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-pink-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-2xs shrink-0 transition-all disabled:opacity-50"
            >
              {style}
            </button>
          ))}
        </div>

        {/* CHAT LOG DECK (Last 20 messages context) */}
        <div className="flex-1 min-h-[160px] max-h-[320px] rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 overflow-y-auto space-y-3 shadow-2xs">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Study Room Dialogue
            </span>
            <button
              onClick={handleClearChat}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear Chat
            </button>
          </div>

          {messages.map((m) => {
            const isSara = m.role === 'assistant';
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isSara ? 'justify-start' : 'justify-end'}`}
              >
                {isSara && (
                  <div className="w-7 h-7 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <span className="text-xs">👧</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isSara
                      ? 'bg-pink-50/70 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-pink-100 dark:border-slate-700'
                      : 'bg-pink-500 text-white font-medium'
                  }`}
                >
                  {/* Attached user image thumbnail */}
                  {m.image && (
                    <img
                      src={m.image}
                      alt="Student question"
                      className="max-h-48 rounded-xl object-contain mb-2 border border-white/20"
                    />
                  )}

                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {m.isStreaming && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-pink-500 animate-pulse" />
                  )}
                </div>
              </div>
            );
          })}

          {isLoadingAnswer && (
            <div className="flex items-center gap-2 text-xs text-pink-600 dark:text-pink-400 font-semibold p-2">
              <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span>Sara is preparing your step-by-step whiteboard lesson...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* 3. BOTTOM MULTIMODAL INPUT DOCK */}
        <div className="sticky bottom-2 z-30 p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-pink-200 dark:border-slate-800 shadow-lg space-y-2">
          {/* Image Preview Banner if photo attached */}
          {attachedImage && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-pink-50 dark:bg-slate-800 border border-pink-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <img
                  src={attachedImage}
                  alt="Attached"
                  className="w-10 h-10 rounded-lg object-cover border"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Photo attached (Sara will analyze on send)
                </span>
              </div>
              <button
                onClick={() => setAttachedImage(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Camera Button */}
            <button
              onClick={() => setIsCameraOpen(true)}
              className="p-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-pink-600 dark:text-pink-400 transition-colors"
              title="Camera: Capture textbook question or problem"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Gallery Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Upload photo from gallery"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileAttach}
            />

            {/* Mic Button */}
            <button
              onClick={handleToggleMic}
              className={`p-2.5 rounded-xl transition-all ${
                isListeningMic
                  ? 'bg-red-500 text-white ring-4 ring-red-200 dark:ring-red-900/40 animate-pulse'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
              title={isListeningMic ? 'Listening... click to stop' : 'Ask by voice (Mic)'}
            >
              {isListeningMic ? <Mic className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text Input Box */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Sara any topic (e.g. 'Solve quadratic formula', 'Explain photosynthesis in Hinglish')..."
              className="flex-1 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />

            {/* Send Button */}
            <button
              onClick={() => handleSend()}
              disabled={isLoadingAnswer || (!inputText.trim() && !attachedImage)}
              className="p-2.5 sm:px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5 shrink-0"
              title="Send to Sara"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </div>
        </div>
      </main>

      {/* 4. MODALS */}
      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSendCapture={(img, prompt) => {
          setAttachedImage(img);
          handleSend(prompt);
        }}
      />

      {/* Live Look Modal */}
      <LiveLookModal
        isOpen={isLiveLookOpen}
        onClose={() => setIsLiveLookOpen(false)}
        settings={settings}
      />

      {/* Exam Practice Modal */}
      <ExamPracticeModal
        isOpen={isExamPracticeOpen}
        onClose={() => setIsExamPracticeOpen(false)}
        settings={settings}
        onExplainOnWhiteboard={handleExplainMCQOnWhiteboard}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(updated) => {
          setSettings(updated);
          localStorage.setItem('sara_gemini_api_key', updated.apiKey);
          localStorage.setItem('sara_settings', JSON.stringify(updated));
        }}
        onRemoveApiKey={() => {
          localStorage.removeItem('sara_gemini_api_key');
          setSettings({ ...settings, apiKey: '' });
        }}
      />

      {/* Saved Notes Modal */}
      <SavedNotesModal
        isOpen={isSavedNotesOpen}
        onClose={() => setIsSavedNotesOpen(false)}
        savedLessons={savedLessons}
        weakTopics={weakTopics}
        onSelectLesson={(lesson) => setCurrentLesson(lesson)}
        onDeleteLesson={handleDeleteSavedLesson}
        onReviseTopic={handleReviseTopic}
        onClearWeakTopics={handleClearWeakTopics}
      />
    </div>
  );
}
