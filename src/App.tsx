/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Camera,
  Mic,
  Send,
  Upload,
  Settings as SettingsIcon,
  BookOpen,
  Award,
  Video,
  Volume2,
  VolumeX,
  Trash2,
  AlertCircle,
  X,
  Paperclip,
  MessageSquare,
  Presentation,
  RotateCcw,
  ChevronDown,
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
  generateWhiteboardLessonProgressive,
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
  language: 'Hindi', // Hindi first default
  textModel: 'gemini-2.5-flash',
  ttsModel: 'gemini-3.1-flash-tts-preview',
  voiceName: 'Leda',
  voiceEnergy: 'Cheerful',
  whiteboardTheme: 'cream',
  speechInputLang: 'hi-IN', // hi-IN default
  darkMode: false,
};

const INITIAL_BOARD_LESSON: StructuredLesson = {
  id: 'lesson-welcome',
  title: 'सारा का डिजिटल शिक्षण व्हाइटबोर्ड ✨',
  steps: [
    {
      say: 'नमस्ते! मैं सारा हूँ। यह हमारा लाइव व्हाइटबोर्ड है, यहाँ मैं आपको हर विषय लिखकर और चित्र बनाकर सिखाऊँगी।',
      board: [
        { type: 'text', x: 20, y: 16, content: '🌸 सारा का अध्ययन कक्ष (Study Room) 🌸', color: '#7C3AED', fontSize: 26 },
        { type: 'line', x: 18, y: 20, width: 64, height: 0, color: '#FFB7B2' },
        { type: 'text', x: 10, y: 34, content: '• गणित एवं विज्ञान के आसान और सटीक चरण', color: '#1E40AF', fontSize: 22 },
        { type: 'text', x: 10, y: 48, content: '• बिहार बोर्ड एवं CBSE परीक्षा की तैयारी', color: '#1E40AF', fontSize: 22 },
        { type: 'text', x: 10, y: 62, content: '• 20 महत्वपूर्ण वस्तुनिष्ठ प्रश्न (MCQs)', color: '#1E40AF', fontSize: 22 },
        { type: 'formula', x: 10, y: 78, content: 'द्विघात सूत्र: x = (-b ± √(b² - 4ac)) / 2a', color: '#059669', fontSize: 22 },
      ],
    },
  ],
};

const INITIAL_CHAT_GREETING =
  'नमस्ते! मैं सारा हूँ, आपकी प्यारी पढ़ाई वाली दोस्त। 🌸 कुछ भी पूछिए, कैमरे से किताब का पन्ना दिखाइए, या नीचे के बटन दबाइए। चलिए, साथ में पढ़ते हैं!';

export default function App() {
  // Navigation Section: 'chat' | 'whiteboard'
  const [activeNav, setActiveNav] = useState<'chat' | 'whiteboard'>('chat');

  // 1. Settings & API Key
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const storedKey = localStorage.getItem('sara_gemini_api_key') || '';
      const storedSettings = localStorage.getItem('sara_settings');
      if (storedSettings) {
        return {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(storedSettings),
          apiKey: storedKey,
          language: JSON.parse(storedSettings).language || 'Hindi',
          speechInputLang: JSON.parse(storedSettings).speechInputLang || 'hi-IN',
        };
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
        content: INITIAL_CHAT_GREETING,
        timestamp: Date.now(),
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('sara_chat_history', JSON.stringify(messages.slice(-20)));
    } catch {}
  }, [messages]);

  // 3. Current Whiteboard Lesson
  const [currentLesson, setCurrentLesson] = useState<StructuredLesson | null>(INITIAL_BOARD_LESSON);

  // 4. Saved Lessons & Weak Topics
  const [savedLessons, setSavedLessons] = useState<StructuredLesson[]>(() => {
    try {
      const raw = localStorage.getItem('sara_saved_notes');
      return raw ? JSON.parse(raw) : [INITIAL_BOARD_LESSON];
    } catch {
      return [INITIAL_BOARD_LESSON];
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
  const [lastFailedQuery, setLastFailedQuery] = useState<{ text: string; style?: AnswerStyle } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRecRef = useRef<any>(null);

  useEffect(() => {
    if (activeNav === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingAnswer, activeNav]);

  // Speech Recognition with default hi-IN
  const handleToggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('इस ब्राउज़र में आवाज़ पहचान (Mic) उपलब्ध नहीं है। कृपया लिखकर पूछें! 🎙️');
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
      recognition.lang = settings.speechInputLang || 'hi-IN';
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
          setTimeout(() => {
            handleSend(transcript);
          }, 350);
        }
      };

      recognition.onerror = () => {
        setIsListeningMic(false);
        setSaraMood('idle');
      };

      recognition.onend = () => {
        setIsListeningMic(false);
        setSaraMood('idle');
      };

      speechRecRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningMic(false);
      setSaraMood('idle');
    }
  };

  // Teaching Mode state
  const [isTeachingMode, setIsTeachingMode] = useState<boolean>(false);
  const [isLoadingWhiteboardLesson, setIsLoadingWhiteboardLesson] = useState<boolean>(false);

  // Submit Query to Sara - always streams a real 5 to 8 lines explanation in chat first
  const handleSend = async (overrideText?: string, answerStyle?: AnswerStyle) => {
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToSend && !attachedImage) return;

    if (!settings.apiKey) {
      setIsSettingsOpen(true);
      return;
    }

    resetInactivityTimer();
    setErrorMessage(null);
    setLastFailedQuery(null);
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

    let imagePart: { mimeType: string; data: string } | undefined;
    if (attachedImage) {
      const match = attachedImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        imagePart = { mimeType: match[1], data: match[2] };
      }
    }
    setAttachedImage(null);

    try {
      // 1. Always stream real 5 to 8 lines explanation directly in chat
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
      // Speak initial explanation sentence in Hindi
      const firstSentence = fullStreamed.split(/[।?!.\n]/)[0] || fullStreamed.slice(0, 100);
      audioPlayer.speakText(firstSentence, settings, undefined, () => {
        setSaraMood('idle');
      });

      // 2. Pre-fetch structured whiteboard lesson in background so it's ready when user taps "व्हाइटबोर्ड पर समझाओ"
      generateWhiteboardLesson(textToSend, settings, imagePart, answerStyle)
        .then((res) => {
          if (res.lesson) {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamMsgId ? { ...m, whiteboardLesson: res.lesson } : m))
            );
          }
        })
        .catch(() => {});
    } catch (err: any) {
      console.error('Error generating answer:', err);
      const friendlyHindi = formatFriendlyError(err);
      const technicalDetails = err?.details || err?.message || String(err);

      setLastFailedQuery({ text: textToSend, style: answerStyle });
      setErrorMessage(friendlyHindi);

      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: friendlyHindi,
          timestamp: Date.now(),
          error: friendlyHindi,
          errorDetails: technicalDetails,
        },
      ]);
      setSaraMood('idle');
    } finally {
      setIsLoadingAnswer(false);
    }
  };

  // Quick Answer Styles in Hindi
  const handleQuickStyle = (style: AnswerStyle) => {
    if (inputText.trim()) {
      handleSend(inputText.trim(), style);
    } else {
      handleSend(`कृपया हमारे वर्तमान विषय को ${style} रूप में समझाइए!`, style);
    }
  };

  // Launch Full-Screen Whiteboard Teaching Mode with audio unlock and autoplay
  const handleLaunchTeachingMode = async (topicOrContent: string, existingLesson?: StructuredLesson) => {
    // 1. Synchronously unlock AudioContext on user touch/tap
    audioPlayer.unlockAudioContext();

    // 2. Request Fullscreen API when available
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}

    // 3. Open full-screen board immediately
    setIsTeachingMode(true);
    setActiveNav('whiteboard');

    if (existingLesson) {
      setCurrentLesson(existingLesson);
      setIsLoadingWhiteboardLesson(false);
      return;
    }

    // 4. Progressive generation: start playing steps 1-3 as soon as ready, remaining in background
    setIsLoadingWhiteboardLesson(true);
    setSaraMood('thinking');

    try {
      const finalLesson = await generateWhiteboardLessonProgressive(
        topicOrContent.slice(0, 450),
        settings,
        (initialLesson) => {
          if (
            initialLesson &&
            Array.isArray(initialLesson.steps) &&
            initialLesson.steps.length > 0
          ) {
            setCurrentLesson(initialLesson);
            setIsLoadingWhiteboardLesson(false);
            setSaraMood('happy');
          }
        },
        (fullLesson) => {
          if (
            fullLesson &&
            Array.isArray(fullLesson.steps) &&
            fullLesson.steps.length > 0
          ) {
            setCurrentLesson(fullLesson);
          }
        }
      );

      if (
        finalLesson &&
        Array.isArray(finalLesson.steps) &&
        finalLesson.steps.length > 0
      ) {
        setCurrentLesson((prev) =>
          prev && prev.steps && prev.steps.length >= finalLesson.steps.length
            ? prev
            : finalLesson
        );
      }
      setIsLoadingWhiteboardLesson(false);
    } catch (err) {
      console.error('Error generating whiteboard lesson:', err);
      setIsLoadingWhiteboardLesson(false);
      setErrorMessage(formatFriendlyError(err));
    }
  };

  // Exit Full-Screen Teaching Mode
  const handleExitTeachingMode = () => {
    audioPlayer.stop();
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
    setIsTeachingMode(false);
    setActiveNav('chat');
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
        content: `🔍 **सारा द्वारा काम की जांच**:\n\n${evaluation}`,
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

  const handleReviseTopic = (topic: string) => {
    handleSend(`कृपया "${topic}" के विषय को व्हाइटबोर्ड पर विस्तार से समझाइए!`);
    setActiveNav('whiteboard');
  };

  const handleClearWeakTopics = () => {
    setWeakTopics([]);
    try {
      localStorage.removeItem('sara_weak_topics');
    } catch {}
  };

  const handleExplainMCQOnWhiteboard = (q: MCQQuestion) => {
    const prompt = `कृपया इस प्रश्न को व्हाइटबोर्ड पर हल करके समझाएं:
प्रश्न: ${q.question}
सही उत्तर: ${q.options[q.answerIndex]}
टॉपिक: ${q.topic}
स्पष्ट करें कि सही उत्तर कैसे आया और क्या गलतियाँ नहीं करनी चाहिए!`;
    handleSend(prompt);
    setActiveNav('whiteboard');
  };

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

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-cleared',
        role: 'assistant',
        content: 'चैट साफ़ हो गई! 🌸 बताइए, अब कौन सा नया टॉपिक सीखें?',
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
        settings.darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#FAF7F0] text-slate-800'
      }`}
    >
      {/* 1. TOP HEADER BAR (Hidden in Full-Screen Teaching Mode) */}
      {!isTeachingMode && (
        <header className="sticky top-0 z-40 px-3 sm:px-6 py-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-pink-100 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <SaraAvatar
              mood={saraMood}
              size="sm"
              onAvatarClick={() => {
                setSaraMood('happy');
                audioPlayer.speakText(
                  'नमस्ते! मैं सारा हूँ, आपकी पढ़ाई वाली दोस्त! चलिए मन लगाकर सीखते हैं! 🌸✨',
                  settings
                );
              }}
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-black text-pink-600 dark:text-pink-400 tracking-tight font-handwriting">
                  सारा
                </h1>
                <span className="text-[11px] font-bold text-slate-500 hidden xs:inline">
                  · {settings.academicLevel}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                {settings.boardExam} · प्यारी AI पढ़ाई वाली दोस्त
              </p>
            </div>
          </div>

          {/* Quick Header Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live Look */}
            <button
              onClick={() => setIsLiveLookOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold transition-colors"
              title="लाइव लुक: कॉपी देखते हुए बोलकर पढ़ाना"
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">लाइव लुक</span>
            </button>

            {/* Notes */}
            <button
              onClick={() => setIsSavedNotesOpen(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
              title="सहेजे गए पाठ और कमजोर टॉपिक"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden md:inline">नोट्स</span>
            </button>

            {/* Voice Mute / Unmute */}
            <button
              onClick={handleToggleMute}
              className={`p-1.5 rounded-xl border text-xs transition-colors ${
                isMuted
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
              title={isMuted ? 'आवाज़ चालू करें' : 'आवाज़ बंद करें'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-pink-500" />}
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
              title="सेटिंग्स"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* 2. MAIN VIEWPORT (FULL-SCREEN SECTIONS) */}
      {!isTeachingMode && (
        <main className="flex-1 max-w-5xl w-full mx-auto p-2 sm:p-4 flex flex-col pb-24">
        {/* Error Alert with Hindi retry button */}
        {errorMessage && (
          <div className="mb-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastFailedQuery && (
                <button
                  onClick={() => handleSend(lastFailedQuery.text, lastFailedQuery.style)}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-all flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>फिर से कोशिश करें</span>
                </button>
              )}
              <button onClick={() => setErrorMessage(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION A: CHAT FULL-SCREEN VIEW */}
        {activeNav === 'chat' && (
          <div className="flex-1 flex flex-col gap-3 min-h-[500px]">
            {/* Chat Messages Log */}
            <div className="flex-1 min-h-[380px] rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 sm:p-5 overflow-y-auto space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    सारा के साथ अध्ययन चैट
                  </span>
                </div>
                <button
                  onClick={handleClearChat}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> साफ़ करें
                </button>
              </div>

              {messages.map((m) => {
                const isSara = m.role === 'assistant';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${isSara ? 'justify-start' : 'justify-end'}`}
                  >
                    {isSara && (
                      <div className="mt-0.5 shrink-0">
                        <SaraAvatar mood={saraMood} size="xs" showMoodBadge={false} />
                      </div>
                    )}

                    <div className="max-w-[88%] sm:max-w-[80%] space-y-2">
                      <div
                        className={`rounded-3xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-xs ${
                          isSara
                            ? 'bg-pink-50/80 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-pink-100 dark:border-slate-700'
                            : 'bg-pink-500 text-white font-medium'
                        }`}
                      >
                        {m.image && (
                          <img
                            src={m.image}
                            alt="Student question"
                            className="max-h-56 rounded-2xl object-contain mb-2.5 border border-white/20"
                          />
                        )}

                        <div className="whitespace-pre-wrap">{m.content}</div>

                        {m.isStreaming && (
                          <span className="inline-block w-1.5 h-3 ml-1 bg-pink-500 animate-pulse" />
                        )}

                        {/* Expandable technical details section if there was an error */}
                        {m.errorDetails && (
                          <details className="mt-2 pt-2 border-t border-rose-200 dark:border-slate-700">
                            <summary className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 cursor-pointer flex items-center gap-1">
                              <span>विवरण (Technical Details)</span>
                              <ChevronDown className="w-3 h-3" />
                            </summary>
                            <pre className="mt-1 text-[10px] text-slate-500 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">
                              {m.errorDetails}
                            </pre>
                          </details>
                        )}
                      </div>

                      {/* "व्हाइटबोर्ड पर समझाओ" button under Sara's answers */}
                      {isSara && !m.error && (
                        <div className="flex items-center gap-2 pl-1 pt-0.5">
                          <button
                            onClick={() => handleLaunchTeachingMode(m.content, m.whiteboardLesson)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-extrabold shadow-sm transition-all hover:scale-102 active:scale-98"
                            title="फुल स्क्रीन व्हाइटबोर्ड पर समझें"
                          >
                            <Presentation className="w-4 h-4" />
                            <span>व्हाइटबोर्ड पर समझाओ ✨</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoadingAnswer && (
                <div className="flex items-center gap-2 text-xs text-pink-600 dark:text-pink-400 font-semibold p-2">
                  <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  <span>सारा आपके लिए उत्तर और व्हाइटबोर्ड तैयार कर रही है...</span>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Answer Style Buttons in Hindi */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none select-none shrink-0">
              <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 shrink-0 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> शैली:
              </span>
              {[
                { id: 'Explain simply', label: 'सरल भाषा में समझाओ' },
                { id: 'Explain in detail', label: 'विस्तार से समझाओ' },
                { id: 'Exam answer (points to write)', label: 'परीक्षा उत्तर (महत्वपूर्ण बिंदु)' },
                { id: 'Quick revision', label: 'त्वरित रिवीजन' },
                { id: 'Quiz me (MCQs)', label: 'प्रश्नोत्तरी (MCQs)' },
                { id: 'Why did I get this wrong?', label: 'मेरी क्या गलती हुई?' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleQuickStyle(item.id as AnswerStyle)}
                  disabled={isLoadingAnswer}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-pink-300 hover:text-pink-600 dark:hover:text-pink-400 shadow-2xs shrink-0 transition-all disabled:opacity-50"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Bottom Input Dock */}
            <div className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-pink-200 dark:border-slate-800 shadow-md space-y-2 shrink-0">
              {attachedImage && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-pink-50 dark:bg-slate-800 border border-pink-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <img src={attachedImage} alt="Attached" className="w-10 h-10 rounded-lg object-cover border" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      फोटो संलग्न है (भेजने पर सारा जांचेगी)
                    </span>
                  </div>
                  <button onClick={() => setAttachedImage(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setIsCameraOpen(true)}
                  className="p-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-pink-600 dark:text-pink-400 transition-colors"
                  title="कैमरा: सवाल की फोटो लें"
                >
                  <Camera className="w-5 h-5" />
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  title="गैलरी से फोटो चुनें"
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

                <button
                  onClick={handleToggleMic}
                  className={`p-2.5 rounded-xl transition-all ${
                    isListeningMic
                      ? 'bg-red-500 text-white ring-4 ring-red-200 dark:ring-red-900/40 animate-pulse'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                  title={isListeningMic ? 'सुन रही हूँ... रोकने के लिए दबाएं' : 'आवाज़ से पूछें (माइक)'}
                >
                  <Mic className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="सारा से कुछ भी पूछिए (जैसे: 'द्विघात सूत्र समझाइए', 'प्रकाश संश्लेषण क्या है')..."
                  className="flex-1 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />

                <button
                  onClick={() => handleSend()}
                  disabled={isLoadingAnswer || (!inputText.trim() && !attachedImage)}
                  className="p-2.5 sm:px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  title="भेजें"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">पूछें</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION B: WHITEBOARD VIEW */}
        {activeNav === 'whiteboard' && !isTeachingMode && (
          <div className="flex-1 flex flex-col h-full min-h-[520px]">
            <Whiteboard
              lesson={currentLesson}
              settings={settings}
              onCheckMyWork={handleCheckMyWork}
              onSaveLesson={handleSaveLesson}
              onSaraMoodChange={(mood) => setSaraMood(mood)}
              isCheckingWork={isCheckingWork}
              isFullScreenMode={false}
              onExitFullScreen={() => setActiveNav('chat')}
              isLoadingLesson={isLoadingWhiteboardLesson}
            />
          </div>
        )}
      </main>
      )}

      {/* FULL-SCREEN TEACHING MODE WHITEBOARD (100% viewport, no headers/navs) */}
      {isTeachingMode && (
        <Whiteboard
          lesson={currentLesson}
          settings={settings}
          onCheckMyWork={handleCheckMyWork}
          onSaveLesson={handleSaveLesson}
          onSaraMoodChange={(mood) => setSaraMood(mood)}
          isCheckingWork={isCheckingWork}
          isFullScreenMode={true}
          onExitFullScreen={handleExitTeachingMode}
          isLoadingLesson={isLoadingWhiteboardLesson}
        />
      )}

      {/* 3. BOTTOM NAVIGATION BAR (चैट, व्हाइटबोर्ड, कैमरा, प्रैक्टिस, सेटिंग्स) */}
      {!isTeachingMode && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-2 py-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto flex items-center justify-around">
            {/* 1. चैट */}
            <button
              onClick={() => setActiveNav('chat')}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition-all ${
                activeNav === 'chat'
                  ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[11px]">चैट</span>
            </button>

            {/* 2. व्हाइटबोर्ड (टैप करते ही फुल-स्क्रीन टीचिंग मोड शुरू) */}
            <button
              onClick={() => {
                handleLaunchTeachingMode(
                  currentLesson?.title || 'द्विघात सूत्र और समीकरण हल करना',
                  currentLesson || undefined
                );
              }}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition-all ${
                activeNav === 'whiteboard'
                  ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
              title="फुल-स्क्रीन लाइव व्हाइटबोर्ड"
            >
              <Presentation className="w-5 h-5" />
              <span className="text-[11px]">व्हाइटबोर्ड</span>
            </button>

            {/* 3. कैमरा */}
            <button
              onClick={() => setIsCameraOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-pink-600 transition-colors"
            >
              <Camera className="w-5 h-5" />
              <span className="text-[11px]">कैमरा</span>
            </button>

            {/* 4. प्रैक्टिस */}
            <button
              onClick={() => setIsExamPracticeOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-purple-600 transition-colors"
            >
              <Award className="w-5 h-5" />
              <span className="text-[11px]">प्रैक्टिस</span>
            </button>

            {/* 5. सेटिंग्स */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-pink-600 transition-colors"
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[11px]">सेटिंग्स</span>
            </button>
          </div>
        </nav>
      )}

      {/* 4. MODALS */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onSendCapture={(img, prompt) => {
          setAttachedImage(img);
          handleSend(prompt);
          setActiveNav('chat');
        }}
      />

      <LiveLookModal
        isOpen={isLiveLookOpen}
        onClose={() => setIsLiveLookOpen(false)}
        settings={settings}
      />

      <ExamPracticeModal
        isOpen={isExamPracticeOpen}
        onClose={() => setIsExamPracticeOpen(false)}
        settings={settings}
        onExplainOnWhiteboard={handleExplainMCQOnWhiteboard}
      />

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

      <SavedNotesModal
        isOpen={isSavedNotesOpen}
        onClose={() => setIsSavedNotesOpen(false)}
        savedLessons={savedLessons}
        weakTopics={weakTopics}
        onSelectLesson={(lesson) => {
          setCurrentLesson(lesson);
          setActiveNav('whiteboard');
        }}
        onDeleteLesson={handleDeleteSavedLesson}
        onReviseTopic={handleReviseTopic}
        onClearWeakTopics={handleClearWeakTopics}
      />
    </div>
  );
}
