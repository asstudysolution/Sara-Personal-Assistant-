/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Download,
  Bookmark,
  Edit3,
  Eraser,
  Undo2,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
  Smartphone,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import {
  StructuredLesson,
  WhiteboardAction,
  UserSettings,
  StudentDrawingStroke,
} from '../types';
import { audioPlayer } from '../services/audioPlayer';
import { SaraAvatar } from './SaraAvatar';
import { SvgTeacherHand } from './TeacherHand';

interface WhiteboardProps {
  lesson: StructuredLesson | null;
  settings: UserSettings;
  onCheckMyWork: (snapshotBase64: string) => void;
  onSaveLesson: (lesson: StructuredLesson) => void;
  onSaraMoodChange?: (mood: 'idle' | 'talking' | 'thinking' | 'happy') => void;
  isCheckingWork?: boolean;
  isFullScreenMode?: boolean;
  onExitFullScreen?: () => void;
  isLoadingLesson?: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  lesson,
  settings,
  onCheckMyWork,
  onSaveLesson,
  onSaraMoodChange,
  isCheckingWork = false,
  isFullScreenMode = false,
  onExitFullScreen,
  isLoadingLesson = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 1. Step & Playback state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [hasSaved, setHasSaved] = useState<boolean>(false);
  const [isPageTurning, setIsPageTurning] = useState<boolean>(false);

  // 2. Auto-hiding control bar (3 seconds)
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // 3. Orientation hint on mobile
  const [showOrientationHint, setShowOrientationHint] = useState<boolean>(true);

  // 4. Writing Hand & Character Reveal State
  const [handState, setHandState] = useState<{
    x: number;
    y: number;
    isWriting: boolean;
    isPointing: boolean;
    markerColor: string;
    visible: boolean;
  }>({
    x: 180,
    y: 120,
    isWriting: false,
    isPointing: false,
    markerColor: '#2563EB',
    visible: true,
  });

  // Map of action index in current step -> revealed characters count
  const [revealedChars, setRevealedChars] = useState<Record<number, number>>({});
  const animationFrameRef = useRef<number | null>(null);

  // 5. Student Freehand Canvas State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#1E293B');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<StudentDrawingStroke[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StudentDrawingStroke | null>(null);

  // Auto-hide controls after 3 seconds of inactivity
  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3200);
  }, []);

  useEffect(() => {
    handleUserActivity();
    // Auto-dismiss orientation hint after 4.5 seconds
    const hintTimer = setTimeout(() => {
      setShowOrientationHint(false);
    }, 4500);

    return () => {
      clearTimeout(hintTimer);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [handleUserActivity]);

  // Derive current step & page
  const currentStep = lesson?.steps[currentStepIndex] || null;
  const currentPage = currentStep?.page || Math.floor(currentStepIndex / 4) + 1;
  const totalPages = useMemo(() => {
    if (!lesson || !lesson.steps.length) return 1;
    const maxPage = Math.max(
      ...lesson.steps.map((s, idx) => s.page || Math.floor(idx / 4) + 1)
    );
    return Math.max(1, maxPage);
  }, [lesson]);

  // Visible actions on current page up to current step
  const visiblePageActions = useMemo(() => {
    if (!lesson || !currentStep) return [];
    const actions: (WhiteboardAction & { stepIdx: number; actIdx: number })[] = [];

    for (let i = 0; i <= currentStepIndex; i++) {
      const step = lesson.steps[i];
      const stepPage = step.page || Math.floor(i / 4) + 1;
      if (stepPage === currentPage) {
        step.board.forEach((act, actIdx) => {
          actions.push({ ...act, stepIdx: i, actIdx });
        });
      }
    }
    return actions;
  }, [lesson, currentStepIndex, currentStep, currentPage]);

  // Hand writing animation loop for a step
  const startWritingAnimation = useCallback(
    (durationMs: number, actions: WhiteboardAction[]) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (!actions || actions.length === 0) {
        setHandState((prev) => ({
          ...prev,
          isWriting: false,
          isPointing: false,
          visible: true,
        }));
        return;
      }

      const startTime = performance.now();
      const activeWritingTime = Math.max(1500, durationMs * 0.82); // Finish writing at 82% of speech

      // Pre-calculate per-action durations
      const totalChars = actions.reduce(
        (sum, a) => sum + (a.content?.length || 16),
        0
      );
      const actionTimings = actions.map((act) => {
        const weight = (act.content?.length || 16) / totalChars;
        return Math.max(400, activeWritingTime * weight);
      });

      const tick = (now: number) => {
        const elapsed = now - startTime;

        if (elapsed >= activeWritingTime) {
          // Finished writing! Reveal all text and lift hand
          const allRevealed: Record<number, number> = {};
          actions.forEach((a, i) => {
            allRevealed[i] = a.content?.length || 999;
          });
          setRevealedChars(allRevealed);

          // Park hand gracefully
          const lastAct = actions[actions.length - 1];
          const lastX = Math.max(8, Math.min(92, lastAct.x));
          const lastY = Math.max(16, lastAct.y);
          setHandState({
            x: (lastX / 100) * 1000 + 40,
            y: (lastY / 100) * 650 + 35,
            isWriting: false,
            isPointing: false,
            markerColor: lastAct.color || '#2563EB',
            visible: true,
          });
          return;
        }

        // Determine which action is currently being written
        let accumulated = 0;
        let activeIdx = 0;
        let progressInAction = 0;

        for (let i = 0; i < actionTimings.length; i++) {
          if (elapsed <= accumulated + actionTimings[i]) {
            activeIdx = i;
            progressInAction = (elapsed - accumulated) / actionTimings[i];
            break;
          }
          accumulated += actionTimings[i];
          activeIdx = i;
          progressInAction = 1;
        }

        const currentAct = actions[activeIdx];
        const actChars = currentAct.content?.length || 16;
        const currentCharsRevealed = Math.min(
          actChars,
          Math.max(1, Math.floor(progressInAction * actChars))
        );

        // Update revealed chars state
        setRevealedChars((prev) => {
          const next = { ...prev };
          for (let i = 0; i < activeIdx; i++) {
            next[i] = actions[i].content?.length || 999;
          }
          next[activeIdx] = currentCharsRevealed;
          return next;
        });

        // Compute SVG coordinate for hand nib
        const clampedX = Math.max(6, Math.min(92, currentAct.x));
        const clampedY = Math.max(16, currentAct.y);
        const startPxX = (clampedX / 100) * 1000;
        const startPxY = (clampedY / 100) * 650;

        // Determine marker color based on role
        let strokeColor = currentAct.color || '#2563EB';
        if (currentAct.role === 'heading') strokeColor = '#2563EB';
        else if (currentAct.role === 'main') strokeColor = '#1E293B';
        else if (currentAct.role === 'important') strokeColor = '#DC2626';
        else if (currentAct.role === 'answer') strokeColor = '#059669';

        // Move hand tip horizontally along with the typed text
        const charWidthEst = Math.max(11, (currentAct.fontSize || 22) * 0.55);
        const handPxX = startPxX + currentCharsRevealed * charWidthEst;
        const handPxY = startPxY - 2;

        const isPointAction =
          currentAct.isPointing ||
          currentAct.type === 'point' ||
          (currentAct.content && currentAct.content.includes('यहाँ देखिए'));

        setHandState({
          x: handPxX,
          y: handPxY,
          isWriting: !isPointAction,
          isPointing: !!isPointAction,
          markerColor: strokeColor,
          visible: true,
        });

        animationFrameRef.current = requestAnimationFrame(tick);
      };

      animationFrameRef.current = requestAnimationFrame(tick);
    },
    []
  );

  // Play a specific step
  const playCurrentStep = useCallback(
    async (stepIdx: number) => {
      if (!lesson || !lesson.steps[stepIdx]) return;
      const step = lesson.steps[stepIdx];

      if (onSaraMoodChange) onSaraMoodChange('talking');

      // Check if page turn is required
      const nextStepPage = step.page || Math.floor(stepIdx / 4) + 1;
      const prevStepPage =
        stepIdx > 0
          ? lesson.steps[stepIdx - 1]?.page || Math.floor((stepIdx - 1) / 4) + 1
          : nextStepPage;

      if (nextStepPage !== prevStepPage && stepIdx > 0) {
        setIsPageTurning(true);
        setTimeout(() => setIsPageTurning(false), 450);
      }

      // Reset revealed chars for current step's actions
      setRevealedChars({});

      // Preload next step voice
      if (lesson.steps[stepIdx + 1]) {
        audioPlayer.preloadStepAudio(
          lesson.steps[stepIdx + 1].say,
          settings,
          `teach-step-${stepIdx + 1}`,
          true
        );
      }

      // Speak current step with teacher voice and schedule hand writing
      await audioPlayer.speakText(
        step.say,
        settings,
        `teach-step-${stepIdx}`,
        () => {
          // Speech ended!
          if (onSaraMoodChange) onSaraMoodChange('idle');

          // Ensure all characters on board are fully revealed
          const allRevealed: Record<number, number> = {};
          step.board.forEach((a, i) => {
            allRevealed[i] = a.content?.length || 999;
          });
          setRevealedChars(allRevealed);

          // Auto-advance 0.8 seconds after speech ends
          if (stepIdx < lesson.steps.length - 1) {
            const delay = 800 / playbackSpeed;
            setTimeout(() => {
              setCurrentStepIndex((prev) => {
                const next = prev + 1;
                playCurrentStep(next);
                return next;
              });
            }, delay);
          } else {
            setIsPlaying(false);
          }
        },
        (durationMs) => {
          // Duration received from audio player! Start writing animation
          startWritingAnimation(durationMs / playbackSpeed, step.board);
        },
        true // isTeaching: warm teacher voice
      );
    },
    [lesson, playbackSpeed, settings, onSaraMoodChange, startWritingAnimation]
  );

  // Autoplay on load without requiring user to press play
  useEffect(() => {
    if (lesson && lesson.steps.length > 0) {
      setCurrentStepIndex(0);
      setIsPlaying(true);
      setHasSaved(false);
      audioPlayer.clearCache();

      // Board wipes clean, Sara slides in, and step 0 begins after 1000ms
      const autoTimer = setTimeout(() => {
        playCurrentStep(0);
      }, 1000);

      return () => {
        clearTimeout(autoTimer);
        audioPlayer.stop();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }
  }, [lesson?.id]);

  // Controls Handlers
  const handleTogglePlay = () => {
    if (!lesson) return;
    if (isPlaying) {
      setIsPlaying(false);
      audioPlayer.stop();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (onSaraMoodChange) onSaraMoodChange('idle');
    } else {
      setIsPlaying(true);
      playCurrentStep(currentStepIndex);
    }
  };

  const handlePrevStep = () => {
    if (!lesson || currentStepIndex <= 0) return;
    audioPlayer.stop();
    setIsPlaying(false);
    const newIdx = currentStepIndex - 1;
    setCurrentStepIndex(newIdx);
    playCurrentStep(newIdx);
  };

  const handleNextStep = () => {
    if (!lesson || currentStepIndex >= lesson.steps.length - 1) return;
    audioPlayer.stop();
    setIsPlaying(false);
    const newIdx = currentStepIndex + 1;
    setCurrentStepIndex(newIdx);
    playCurrentStep(newIdx);
  };

  const handleReplay = () => {
    if (!lesson) return;
    audioPlayer.stop();
    setCurrentStepIndex(0);
    setIsPlaying(true);
    playCurrentStep(0);
  };

  // Student Freehand Drawing
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    const resizeCanvas = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [redrawCanvas]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isPointerDownRef.current = true;
    currentStrokeRef.current = {
      color: isEraser ? '#FCF9F2' : penColor,
      width: isEraser ? 22 : penWidth,
      points: [{ x, y }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    handleUserActivity();
    if (!isDrawingMode || !isPointerDownRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.points.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const pts = currentStrokeRef.current.points;
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = currentStrokeRef.current.color;
        ctx.lineWidth = currentStrokeRef.current.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingMode || !isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 1) {
      setStrokes((prev) => [...prev, currentStrokeRef.current!]);
    }
    currentStrokeRef.current = null;
  };

  const handleClearDrawing = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onCheckMyWork(dataUrl);
  };

  const handleSaveToNotes = () => {
    if (!lesson) return;
    onSaveLesson(lesson);
    setHasSaved(true);
    setTimeout(() => setHasSaved(false), 2500);
  };

  // Loading Screen if board is being prepared
  if (isLoadingLesson && !lesson) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#FCF9F2] text-slate-800 select-none">
        <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <SaraAvatar mood="thinking" size="xl" />
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-pink-600 font-handwriting">
              सारा बोर्ड तैयार कर रही है… 🌸
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              सुंदर नोट्स, रंगीन मार्कर और चित्र जोड़े जा रहे हैं
            </p>
          </div>
          <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handleUserActivity}
      onPointerDown={handleUserActivity}
      className={`relative w-full h-full select-none flex flex-col overflow-hidden ${
        isFullScreenMode
          ? 'fixed inset-0 z-50 w-screen h-screen bg-[#FCF9F2]'
          : 'relative rounded-3xl border border-pink-200 dark:border-slate-800 shadow-xl bg-[#FCF9F2]'
      }`}
      style={{
        backgroundColor: '#FCF9F2',
        backgroundImage: 'radial-gradient(#D8CEBE 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* 1. TOP HEADER & ORIENTATION HINT (Auto-hides or stays minimal) */}
      <div className="absolute top-2 left-2 right-2 z-40 flex items-center justify-between pointer-events-none px-2 pt-[env(safe-area-inset-top)]">
        {/* Sara's Round Portrait with pulsing audio aura in Top-Left */}
        <div className="flex items-center gap-2.5 pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1.5 pr-3.5 rounded-full border border-pink-200 shadow-xs">
          <SaraAvatar
            mood={isPlaying ? 'talking' : 'idle'}
            size="sm"
            onAvatarClick={() => {
              if (currentStep) {
                audioPlayer.speakText(currentStep.say, settings, undefined, undefined, undefined, true);
              }
            }}
          />
          <div className="hidden xs:block">
            <h4 className="text-xs font-bold text-pink-700 dark:text-pink-300 font-handwriting leading-none">
              सारा अध्यापिका 🌸
            </h4>
            <span className="text-[10px] text-slate-500 font-medium">
              {lesson?.title ? lesson.title.slice(0, 24) : 'लाइव बोर्ड'}
            </span>
          </div>
        </div>

        {/* Orientation Hint Pill for mobile */}
        {showOrientationHint && (
          <div className="pointer-events-auto animate-bounce hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-bold shadow-md">
            <Smartphone className="w-3.5 h-3.5 rotate-90" />
            <span>फोन को आड़ा करें तो बोर्ड और बड़ा दिखेगा</span>
            <button
              onClick={() => setShowOrientationHint(false)}
              className="ml-1 text-amber-200 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Exit Full-Screen Button ✕ */}
        {isFullScreenMode && onExitFullScreen && (
          <button
            onClick={onExitFullScreen}
            className="pointer-events-auto w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-rose-600 shadow-md border border-slate-200 flex items-center justify-center transition-all hover:scale-105"
            title="बोर्ड से बाहर निकलें (Exit Fullscreen)"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. FLOATING CONTROL BAR (Auto-hides after 3s, reappears on tap) */}
      <div
        className={`absolute top-14 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out ${
          showControls ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg">
          {/* Previous Step */}
          <button
            onClick={handlePrevStep}
            disabled={!lesson || currentStepIndex <= 0}
            className="p-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-30 text-slate-700 dark:text-slate-200 transition-colors"
            title="पिछला चरण"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={handleTogglePlay}
            disabled={!lesson}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-pink-500 hover:bg-pink-600 text-white shadow-xs transition-transform active:scale-95 disabled:opacity-40"
            title={isPlaying ? 'रोकें (Pause)' : 'शुरू करें (Play)'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          {/* Next Step */}
          <button
            onClick={handleNextStep}
            disabled={!lesson || currentStepIndex >= lesson.steps.length - 1}
            className="p-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-30 text-slate-700 dark:text-slate-200 transition-colors"
            title="अगला चरण"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Replay */}
          <button
            onClick={handleReplay}
            disabled={!lesson}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 dark:text-slate-200 transition-colors"
            title="शुरू से चलाएं (Replay)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Page Indicator */}
          <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 px-1 whitespace-nowrap">
            पृष्ठ {currentPage}/{totalPages}
          </span>

          {/* Speed Selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="text-xs font-semibold px-1.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 cursor-pointer"
            title="गति (Speed)"
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.5}>1.5x</option>
          </select>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Student Drawing Mode Toggle */}
          <button
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
              isDrawingMode
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="छात्र पेन से लिखें"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">पेन</span>
          </button>

          {/* Save to Notes */}
          <button
            onClick={handleSaveToNotes}
            disabled={!lesson}
            className={`p-1.5 rounded-xl transition-colors ${
              hasSaved
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-slate-600 hover:text-pink-600 hover:bg-slate-100'
            }`}
            title="नोट्स में सहेजें"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Student Pen Toolbar when Drawing Mode is active */}
      {isDrawingMode && (
        <div className="absolute top-26 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-blue-200 shadow-md animate-in fade-in">
          {['#1E293B', '#2563EB', '#DC2626', '#059669'].map((c) => (
            <button
              key={c}
              onClick={() => {
                setPenColor(c);
                setIsEraser(false);
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                penColor === c && !isEraser ? 'scale-125 border-white ring-2 ring-blue-500' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`p-1 rounded-lg ${isEraser ? 'bg-amber-100 text-amber-700' : 'text-slate-600'}`}
            title="रबर (Eraser)"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearDrawing}
            className="p-1 text-slate-400 hover:text-rose-600"
            title="साफ़ करें"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleCaptureSnapshot}
            disabled={isCheckingWork}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500 text-white text-[11px] font-bold shadow-xs"
            title="सारा से काम जांचें"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>जांचें</span>
          </button>
        </div>
      )}

      {/* 3. MAIN WHITEBOARD STAGE (100% of viewport with smooth page turns) */}
      <div
        className={`relative flex-1 w-full h-full overflow-hidden transition-all duration-400 ${
          isPageTurning ? 'opacity-0 scale-95 translate-x-8' : 'opacity-100 scale-100 translate-x-0'
        }`}
      >
        {/* Soft Red Notebook Margin Line at left 42px */}
        <div className="absolute top-0 bottom-0 left-10 w-px bg-rose-200/60 pointer-events-none" />

        {/* Sara's Scaled Vector Whiteboard Layer */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          viewBox="0 0 1000 650"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Welcome Prompt if empty */}
          {!lesson && (
            <g transform="translate(500, 320)" textAnchor="middle">
              <text
                x="0"
                y="0"
                className="font-board font-bold fill-pink-600"
                fontSize="32"
                style={{ fontFamily: "'Kalam', 'Caveat', cursive" }}
              >
                नमस्ते! मैं सारा हूँ, आपकी प्यारी पढ़ाई वाली दोस्त 🌸
              </text>
              <text
                x="0"
                y="45"
                className="font-ui font-semibold fill-slate-500"
                fontSize="18"
              >
                चैट में सवाल पूछिए या "व्हाइटबोर्ड पर समझाओ" दबाइए, मैं यहाँ लिखकर सिखाऊँगी!
              </text>
            </g>
          )}

          {/* Render All Actions on Current Page up to Current Step */}
          {visiblePageActions.map((act, idx) => {
            const isCurrentStepAction = act.stepIdx === currentStepIndex;
            const charsToReveal =
              isCurrentStepAction && revealedChars[act.actIdx] !== undefined
                ? revealedChars[act.actIdx]
                : act.content?.length || 999;

            const textToDisplay = act.content ? act.content.slice(0, charsToReveal) : '';

            // Layout coordinates
            const clampedX = Math.max(6, Math.min(92, act.x));
            const clampedY = Math.max(16, act.y);
            const pxX = (clampedX / 100) * 1000;
            const pxY = (clampedY / 100) * 650;

            // Determine stroke color
            let color = act.color || '#1E293B';
            if (act.role === 'heading') color = '#2563EB';
            else if (act.role === 'main') color = '#1E293B';
            else if (act.role === 'important') color = '#DC2626';
            else if (act.role === 'answer') color = '#059669';

            // Large font size (at least 22px on phones)
            const fontSize = Math.max(22, (act.fontSize || 22) * 1.05);

            switch (act.type) {
              case 'text':
              case 'label':
                return (
                  <text
                    key={idx}
                    x={pxX}
                    y={pxY}
                    fill={color}
                    fontSize={fontSize}
                    fontWeight={fontSize > 26 ? 'bold' : '600'}
                    className="font-board font-hindi-hand"
                    style={{ fontFamily: "'Kalam', 'Caveat', cursive" }}
                  >
                    {textToDisplay}
                  </text>
                );

              case 'formula':
                return (
                  <g key={idx}>
                    <rect
                      x={pxX - 12}
                      y={pxY - fontSize + 3}
                      width={Math.min(920 - pxX, (act.content?.length || 10) * (fontSize * 0.58) + 24)}
                      height={fontSize + 12}
                      rx="8"
                      fill={color}
                      fillOpacity="0.08"
                    />
                    <text
                      x={pxX}
                      y={pxY}
                      fill={color}
                      fontSize={fontSize * 1.15}
                      fontWeight="bold"
                      className="font-board font-hindi-hand"
                      style={{ fontFamily: "'Kalam', 'Caveat', cursive" }}
                    >
                      {textToDisplay}
                    </text>
                  </g>
                );

              case 'highlight':
                return (
                  <g key={idx}>
                    <rect
                      x={pxX - 10}
                      y={pxY - fontSize + 4}
                      width={Math.min(920, (act.content?.length || 12) * (fontSize * 0.6) + 20)}
                      height={fontSize + 8}
                      rx="6"
                      fill="#FEF08A"
                      fillOpacity="0.55"
                    />
                    <text
                      x={pxX}
                      y={pxY}
                      fill={color}
                      fontSize={fontSize}
                      fontWeight="bold"
                      className="font-board font-hindi-hand"
                      style={{ fontFamily: "'Kalam', 'Caveat', cursive" }}
                    >
                      {textToDisplay}
                    </text>
                  </g>
                );

              case 'underline':
                return (
                  <g key={idx}>
                    <text
                      x={pxX}
                      y={pxY}
                      fill={color}
                      fontSize={fontSize}
                      className="font-board font-hindi-hand"
                      style={{ fontFamily: "'Kalam', 'Caveat', cursive" }}
                    >
                      {textToDisplay}
                    </text>
                    <path
                      d={`M ${pxX} ${pxY + 8} Q ${pxX + 50} ${pxY + 11} ${pxX + (textToDisplay.length || 10) * (fontSize * 0.52)} ${pxY + 8}`}
                      stroke={color}
                      strokeWidth="3"
                      fill="none"
                    />
                  </g>
                );

              case 'line': {
                const w = ((act.width || 30) / 100) * 1000;
                return (
                  <line
                    key={idx}
                    x1={pxX}
                    y1={pxY}
                    x2={pxX + w}
                    y2={pxY}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                );
              }

              case 'arrow': {
                const w = ((act.width || 25) / 100) * 1000;
                return (
                  <g key={idx}>
                    <line
                      x1={pxX}
                      y1={pxY}
                      x2={pxX + w}
                      y2={pxY}
                      stroke={color}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <polygon
                      points={`${pxX + w},${pxY} ${pxX + w - 10},${pxY - 6} ${pxX + w - 10},${pxY + 6}`}
                      fill={color}
                    />
                    {act.content && (
                      <text
                        x={pxX + w / 2}
                        y={pxY - 8}
                        fill={color}
                        fontSize={fontSize * 0.85}
                        textAnchor="middle"
                        style={{ fontFamily: "'Kalam', cursive" }}
                      >
                        {textToDisplay}
                      </text>
                    )}
                  </g>
                );
              }

              case 'circle': {
                const r = (((act.width || 12) / 100) * 1000) / 2;
                return (
                  <g key={idx}>
                    <circle
                      cx={pxX + r}
                      cy={pxY + r}
                      r={r}
                      fill="none"
                      stroke={color}
                      strokeWidth="2.8"
                    />
                    {act.content && (
                      <text
                        x={pxX + r}
                        y={pxY + r + 6}
                        fill={color}
                        fontSize={fontSize * 0.85}
                        textAnchor="middle"
                        style={{ fontFamily: "'Kalam', cursive" }}
                      >
                        {textToDisplay}
                      </text>
                    )}
                  </g>
                );
              }

              case 'rectangle': {
                const w = ((act.width || 28) / 100) * 1000;
                const h = ((act.height || 18) / 100) * 650;
                return (
                  <g key={idx}>
                    <rect
                      x={pxX}
                      y={pxY}
                      width={w}
                      height={h}
                      rx="10"
                      fill={color}
                      fillOpacity="0.04"
                      stroke={color}
                      strokeWidth="2.8"
                    />
                    {act.content && (
                      <text
                        x={pxX + 16}
                        y={pxY + 28}
                        fill={color}
                        fontSize={fontSize * 0.9}
                        style={{ fontFamily: "'Kalam', cursive" }}
                      >
                        {textToDisplay}
                      </text>
                    )}
                  </g>
                );
              }

              case 'table': {
                const headers = act.data?.headers || ['चरण', 'विवरण'];
                const rows = act.data?.rows || [];
                const colW = 180;
                const rowH = 34;
                return (
                  <g key={idx} transform={`translate(${pxX}, ${pxY})`}>
                    {/* Header */}
                    {headers.map((h, hi) => (
                      <g key={hi} transform={`translate(${hi * colW}, 0)`}>
                        <rect
                          width={colW}
                          height={rowH}
                          fill="#EFF6FF"
                          stroke="#93C5FD"
                          strokeWidth="1.5"
                        />
                        <text
                          x={colW / 2}
                          y={rowH / 2 + 5}
                          fill="#1E40AF"
                          fontSize="15"
                          fontWeight="bold"
                          textAnchor="middle"
                          style={{ fontFamily: "'Kalam', cursive" }}
                        >
                          {h}
                        </text>
                      </g>
                    ))}
                    {/* Rows */}
                    {rows.map((row, ri) => (
                      <g key={ri} transform={`translate(0, ${(ri + 1) * rowH})`}>
                        {row.map((cell, ci) => (
                          <g key={ci} transform={`translate(${ci * colW}, 0)`}>
                            <rect
                              width={colW}
                              height={rowH}
                              fill={ri % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}
                              stroke="#CBD5E1"
                              strokeWidth="1"
                            />
                            <text
                              x={colW / 2}
                              y={rowH / 2 + 5}
                              fill="#334155"
                              fontSize="14"
                              textAnchor="middle"
                              style={{ fontFamily: "'Kalam', cursive" }}
                            >
                              {cell}
                            </text>
                          </g>
                        ))}
                      </g>
                    ))}
                  </g>
                );
              }

              default:
                return null;
            }
          })}

          {/* 4. FEMININE TEACHER HAND WRITING ON THE BOARD */}
          <SvgTeacherHand
            x={handState.x}
            y={handState.y}
            isWriting={handState.isWriting}
            isPointing={handState.isPointing}
            markerColor={handState.markerColor}
            visible={isPlaying && !isPageTurning}
          />
        </svg>

        {/* Student Drawing Overlay Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 w-full h-full ${
            isDrawingMode ? 'pointer-events-auto touch-none cursor-crosshair' : 'pointer-events-none'
          }`}
        />
      </div>

      {/* 4. BOTTOM SPOKEN SENTENCE CAPTION BAR */}
      {currentStep && (
        <div className="absolute bottom-3 left-3 right-3 z-30 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-2xl w-full px-4 py-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-pink-200/80 dark:border-slate-800 shadow-md flex items-center gap-2.5 pointer-events-auto">
            <span className="text-base shrink-0 select-none">👧</span>
            <p className="text-xs sm:text-sm font-semibold italic text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
              "{currentStep.say}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
