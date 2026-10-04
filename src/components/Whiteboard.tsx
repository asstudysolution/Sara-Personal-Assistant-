/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import {
  StructuredLesson,
  WhiteboardAction,
  UserSettings,
  StudentDrawingStroke,
} from '../types';
import { audioPlayer } from '../services/audioPlayer';

interface WhiteboardProps {
  lesson: StructuredLesson | null;
  settings: UserSettings;
  onCheckMyWork: (snapshotBase64: string) => void;
  onSaveLesson: (lesson: StructuredLesson) => void;
  onSaraMoodChange?: (mood: 'idle' | 'talking' | 'thinking' | 'happy') => void;
  isCheckingWork?: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  lesson,
  settings,
  onCheckMyWork,
  onSaveLesson,
  onSaraMoodChange,
  isCheckingWork = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Playback state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasSaved, setHasSaved] = useState<boolean>(false);

  // Student Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [penColor, setPenColor] = useState<string>('#1E293B');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<StudentDrawingStroke[]>([]);
  const isPointerDownRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StudentDrawingStroke | null>(null);

  // Reset step when lesson changes
  useEffect(() => {
    if (lesson) {
      setCurrentStepIndex(0);
      setIsPlaying(false);
      setHasSaved(false);
      audioPlayer.clearCache();
    }
  }, [lesson]);

  // Audio Playback & Auto-Advance
  const playCurrentStep = useCallback(
    async (stepIdx: number) => {
      if (!lesson || !lesson.steps[stepIdx]) return;
      const step = lesson.steps[stepIdx];

      if (onSaraMoodChange) onSaraMoodChange('talking');

      // Preload next step audio
      if (lesson.steps[stepIdx + 1]) {
        audioPlayer.preloadStepAudio(
          lesson.steps[stepIdx + 1].say,
          settings,
          `step-${stepIdx + 1}`
        );
      }

      await audioPlayer.speakText(
        step.say,
        settings,
        `step-${stepIdx}`,
        () => {
          if (onSaraMoodChange) onSaraMoodChange('idle');
          if (isPlaying && stepIdx < lesson.steps.length - 1) {
            // Auto advance after slight pause adjusted for playback speed
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
        }
      );
    },
    [lesson, isPlaying, playbackSpeed, settings, onSaraMoodChange]
  );

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (!lesson) return;
    if (isPlaying) {
      setIsPlaying(false);
      audioPlayer.stop();
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

  // Student Canvas Drawing Logic
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

  // Adjust canvas size to match container
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

  // Pointer event handlers for drawing
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isPointerDownRef.current = true;
    currentStrokeRef.current = {
      color: isEraser
        ? settings.whiteboardTheme === 'chalkboard'
          ? '#1A2924'
          : settings.whiteboardTheme === 'cream'
          ? '#FFFDF8'
          : '#FFFFFF'
        : penColor,
      width: isEraser ? 20 : penWidth,
      points: [{ x, y }],
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingMode || !isPointerDownRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.points.push({ x, y });

    // Draw live stroke segment
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
    if (!isDrawingMode || !isPointerDownRef.current || !currentStrokeRef.current) return;
    isPointerDownRef.current = false;
    setStrokes((prev) => [...prev, currentStrokeRef.current!]);
    currentStrokeRef.current = null;
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClearDrawing = () => {
    setStrokes([]);
  };

  // Capture board snapshot for "Check my work" or "Download"
  const generateBoardSnapshot = async (): Promise<string> => {
    const container = containerRef.current;
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    if (!container || !svg || !canvas) return '';

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Create an offscreen render canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = width * 2; // high-DPI
    offscreen.height = height * 2;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';
    ctx.scale(2, 2);

    // 1. Draw theme background
    ctx.fillStyle =
      settings.whiteboardTheme === 'chalkboard'
        ? '#1A2924'
        : settings.whiteboardTheme === 'cream'
        ? '#FFFDF8'
        : '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 2. Render SVG whiteboard to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(blobURL);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobURL);
        resolve();
      };
      img.src = blobURL;
    });

    // 3. Draw student drawing strokes on top
    ctx.drawImage(canvas, 0, 0, width, height);

    return offscreen.toDataURL('image/png');
  };

  const handleCheckWork = async () => {
    const snapshot = await generateBoardSnapshot();
    if (snapshot) {
      onCheckMyWork(snapshot);
    }
  };

  const handleDownloadBoard = async () => {
    const snapshot = await generateBoardSnapshot();
    if (!snapshot) return;
    const link = document.createElement('a');
    link.download = `Sara_Lesson_${(lesson?.title || 'Whiteboard').replace(/\s+/g, '_')}.png`;
    link.href = snapshot;
    link.click();
  };

  const handleSave = () => {
    if (lesson) {
      onSaveLesson(lesson);
      setHasSaved(true);
      setTimeout(() => setHasSaved(false), 2500);
    }
  };

  // Cumulative actions up to current step (or if step has clear, clears preceding)
  const currentStep = lesson?.steps[currentStepIndex];
  const visibleActions: WhiteboardAction[] = [];
  if (lesson) {
    for (let i = 0; i <= currentStepIndex; i++) {
      const step = lesson.steps[i];
      for (const act of step.board) {
        if (act.type === 'clear') {
          visibleActions.length = 0; // Wipe prior actions
        } else {
          visibleActions.push(act);
        }
      }
    }
  }

  // Theme styling constants
  const themeClasses = {
    cream: 'bg-[#FFFDF8] text-slate-800 border-[#E8E3D5]',
    chalkboard: 'bg-[#182823] text-emerald-100 border-[#2D453E]',
    clean: 'bg-white text-slate-900 border-slate-200',
  }[settings.whiteboardTheme || 'cream'];

  const gridDotColor = {
    cream: 'rgba(210, 195, 170, 0.35)',
    chalkboard: 'rgba(82, 126, 110, 0.25)',
    clean: 'rgba(203, 213, 225, 0.4)',
  }[settings.whiteboardTheme || 'cream'];

  return (
    <div
      className={`flex flex-col rounded-2xl border shadow-sm transition-all duration-300 relative overflow-hidden ${
        isFullscreen ? 'fixed inset-2 z-50 rounded-xl shadow-2xl' : 'w-full h-full min-h-[380px] sm:min-h-[440px]'
      } ${themeClasses}`}
    >
      {/* Top Whiteboard Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-inherit bg-black/5 backdrop-blur-xs select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse" />
          <h2 className="text-sm sm:text-base font-bold truncate tracking-tight font-handwriting">
            {lesson ? lesson.title : "Sara's Teaching Board"}
          </h2>
          {lesson && (
            <span className="text-xs text-slate-500 font-medium px-2 py-0.5 rounded-full bg-black/5 shrink-0 hidden sm:inline-block">
              Step {currentStepIndex + 1} of {lesson.steps.length}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Student Pen Mode Toggle */}
          <button
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              isDrawingMode
                ? 'bg-pink-500 text-white shadow-sm ring-2 ring-pink-300'
                : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-2xs'
            }`}
            title="Draw on the board with your own pen"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Student Pen</span>
          </button>

          {/* Check My Work */}
          <button
            onClick={handleCheckWork}
            disabled={isCheckingWork}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
            title="Sara evaluates your handwritten notes or solution"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Check My Work</span>
          </button>

          {/* Save Lesson */}
          {lesson && (
            <button
              onClick={handleSave}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                hasSaved
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-white/80 hover:bg-white text-slate-600 border-slate-200'
              }`}
              title="Save to My Notes"
            >
              <Bookmark className={`w-3.5 h-3.5 ${hasSaved ? 'fill-amber-500' : ''}`} />
            </button>
          )}

          {/* Download Image */}
          <button
            onClick={handleDownloadBoard}
            className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 border border-slate-200 transition-colors"
            title="Download board as image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 border border-slate-200 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Student Pen Drawing Palette (When Active) */}
      {isDrawingMode && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-pink-50/90 border-b border-pink-100 text-slate-800 text-xs gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-pink-900 hidden sm:inline">Pen:</span>
            {['#1E293B', '#2563EB', '#DC2626', '#059669', '#7C3AED'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  setPenColor(color);
                  setIsEraser(false);
                }}
                className={`w-5 h-5 rounded-full border border-white shadow-2xs transition-transform ${
                  !isEraser && penColor === color ? 'scale-125 ring-2 ring-pink-400' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              onClick={() => setIsEraser(!isEraser)}
              className={`p-1 rounded-md border text-xs ml-1 ${
                isEraser ? 'bg-pink-300 text-pink-950 font-bold border-pink-400' : 'bg-white border-slate-200'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="p-1 px-2 rounded-md bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              title="Undo stroke"
            >
              <Undo2 className="w-3.5 h-3.5 inline mr-1" />
              <span className="text-[10px]">Undo</span>
            </button>
            <button
              onClick={handleClearDrawing}
              disabled={strokes.length === 0}
              className="p-1 px-2 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
              title="Clear all drawings"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              <span className="text-[10px]">Clear</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas & SVG Stage */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full min-h-[300px] overflow-hidden cursor-crosshair"
      >
        {/* SVG Dot Grid Background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="wbGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill={gridDotColor} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wbGrid)" />
        </svg>

        {/* Sara's Animated SVG Drawing Layer */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          viewBox="0 0 1000 650"
          preserveAspectRatio="xMidYMid meet"
        >
          {visibleActions.length === 0 && !lesson && (
            <g transform="translate(500, 310)" textAnchor="middle">
              <text
                x="0"
                y="0"
                className="font-board text-2xl sm:text-3xl font-bold fill-slate-400"
                style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
              >
                Hi! Ask Sara anything or show your camera to start learning! ✨
              </text>
              <text
                x="0"
                y="35"
                className="font-ui text-sm fill-slate-400"
              >
                (Maths, Science, Bihar Board BSEB / CBSE concepts, graphs & formulas)
              </text>
            </g>
          )}

          {visibleActions.map((act, idx) => {
            const pxX = (act.x / 100) * 1000;
            const pxY = (act.y / 100) * 650;
            const color =
              act.color ||
              (settings.whiteboardTheme === 'chalkboard' ? '#6EE7B7' : '#1E293B');
            const fontSize = (act.fontSize || 18) * 1.25;

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
                    fontWeight={fontSize > 24 ? 'bold' : '600'}
                    className="font-board"
                    style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
                  >
                    {act.content}
                  </text>
                );

              case 'formula':
                return (
                  <g key={idx}>
                    {/* Soft background highlight for math formula */}
                    <rect
                      x={pxX - 10}
                      y={pxY - fontSize + 2}
                      width={Math.min(950 - pxX, (act.content?.length || 10) * (fontSize * 0.58) + 20)}
                      height={fontSize + 10}
                      rx="6"
                      fill={color}
                      fillOpacity="0.08"
                    />
                    <text
                      x={pxX}
                      y={pxY}
                      fill={color}
                      fontSize={fontSize * 1.1}
                      fontWeight="bold"
                      className="font-board"
                      style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
                    >
                      {act.content}
                    </text>
                  </g>
                );

              case 'highlight':
                return (
                  <g key={idx}>
                    <rect
                      x={pxX - 8}
                      y={pxY - fontSize + 4}
                      width={Math.min(900, (act.content?.length || 12) * (fontSize * 0.6) + 16)}
                      height={fontSize + 6}
                      rx="4"
                      fill="#FEF08A"
                      fillOpacity="0.45"
                    />
                    <text
                      x={pxX}
                      y={pxY}
                      fill={color}
                      fontSize={fontSize}
                      fontWeight="bold"
                      className="font-board"
                      style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
                    >
                      {act.content}
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
                      className="font-board"
                      style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
                    >
                      {act.content}
                    </text>
                    <path
                      d={`M ${pxX} ${pxY + 6} Q ${pxX + 50} ${pxY + 8} ${pxX + (act.content?.length || 10) * 11} ${pxY + 6}`}
                      stroke={color}
                      strokeWidth="2.5"
                      fill="none"
                      className="animate-draw"
                    />
                  </g>
                );

              case 'rectangle': {
                const w = ((act.width || 25) / 100) * 1000;
                const h = ((act.height || 15) / 100) * 650;
                return (
                  <g key={idx}>
                    <rect
                      x={pxX}
                      y={pxY}
                      width={w}
                      height={h}
                      rx="8"
                      stroke={color}
                      strokeWidth="2.5"
                      fill={color}
                      fillOpacity="0.04"
                      className="animate-draw"
                    />
                    {act.content && (
                      <text
                        x={pxX + w / 2}
                        y={pxY + h / 2 + 6}
                        textAnchor="middle"
                        fill={color}
                        fontSize={fontSize}
                        className="font-board"
                        style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
                      >
                        {act.content}
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
                      stroke={color}
                      strokeWidth="2.5"
                      fill={color}
                      fillOpacity="0.05"
                      className="animate-draw"
                    />
                    {act.content && (
                      <text
                        x={pxX + r}
                        y={pxY + r + 6}
                        textAnchor="middle"
                        fill={color}
                        fontSize={fontSize}
                        className="font-board"
                        style={{ fontFamily: "'Caveat', 'Kalam', cursive" }}
                      >
                        {act.content}
                      </text>
                    )}
                  </g>
                );
              }

              case 'arrow':
              case 'line': {
                const targetX = pxX + ((act.width || 15) / 100) * 1000;
                const targetY = pxY + ((act.height || 0) / 100) * 650;
                return (
                  <g key={idx}>
                    <line
                      x1={pxX}
                      y1={pxY}
                      x2={targetX}
                      y2={targetY}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="animate-draw"
                    />
                    {act.type === 'arrow' && (
                      <polygon
                        points={`${targetX},${targetY} ${targetX - 8},${targetY - 5} ${targetX - 8},${targetY + 5}`}
                        fill={color}
                      />
                    )}
                  </g>
                );
              }

              case 'graph': {
                // Cartesian coordinate plane with curve plotting
                const gx = pxX;
                const gy = pxY;
                const gw = ((act.width || 32) / 100) * 1000;
                const gh = ((act.height || 30) / 100) * 650;
                const originX = gx + gw / 2;
                const originY = gy + gh / 2;

                // Simple parabola/sine/linear curve generation
                const fnStr = act.data?.fn || 'x^2';
                const points: string[] = [];
                for (let px = -gw / 2 + 10; px <= gw / 2 - 10; px += 4) {
                  const normX = (px / (gw / 2)) * 3; // scaled x in [-3, 3]
                  let normY = 0;
                  if (fnStr.includes('sin')) normY = Math.sin(normX) * 1.5;
                  else if (fnStr.includes('^2')) normY = (normX * normX) / 2.5;
                  else normY = normX; // linear
                  const plotY = originY - (normY / 3) * (gh / 2);
                  if (plotY >= gy && plotY <= gy + gh) {
                    points.push(`${originX + px},${plotY}`);
                  }
                }

                return (
                  <g key={idx}>
                    {/* Background graph frame */}
                    <rect x={gx} y={gy} width={gw} height={gh} rx="6" fill="#F8FAFC" fillOpacity="0.7" stroke="#CBD5E1" strokeWidth="1.5" />
                    {/* X and Y axes */}
                    <line x1={gx + 8} y1={originY} x2={gx + gw - 8} y2={originY} stroke="#64748B" strokeWidth="1.8" />
                    <line x1={originX} y1={gy + gh - 8} x2={originX} y2={gy + 8} stroke="#64748B" strokeWidth="1.8" />
                    <text x={gx + gw - 16} y={originY - 4} fontSize="11" fill="#64748B">x</text>
                    <text x={originX + 6} y={gy + 14} fontSize="11" fill="#64748B">y</text>
                    {/* Plotted function path */}
                    {points.length > 1 && (
                      <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="animate-draw"
                      />
                    )}
                    {/* Curve Label */}
                    <text
                      x={gx + 12}
                      y={gy + 20}
                      fontSize="13"
                      fontWeight="bold"
                      fill="#1E40AF"
                      style={{ fontFamily: "'Caveat', cursive" }}
                    >
                      {act.data?.label || `f(x) = ${fnStr}`}
                    </text>
                  </g>
                );
              }

              case 'geometry': {
                // Geometric shapes with angle markings
                const geoX = pxX;
                const geoY = pxY;
                const size = ((act.width || 22) / 100) * 1000;
                const isRight = act.data?.shape === 'right-triangle';

                return (
                  <g key={idx}>
                    {isRight ? (
                      /* Right Triangle */
                      <g>
                        <polygon
                          points={`${geoX},${geoY + size} ${geoX + size * 1.2},${geoY + size} ${geoX},${geoY}`}
                          fill="#EFF6FF"
                          stroke={color}
                          strokeWidth="2.5"
                          className="animate-draw"
                        />
                        {/* 90 degree square mark */}
                        <path
                          d={`M ${geoX} ${geoY + size - 14} L ${geoX + 14} ${geoY + size - 14} L ${geoX + 14} ${geoY + size}`}
                          fill="none"
                          stroke={color}
                          strokeWidth="1.8"
                        />
                        <text x={geoX - 16} y={geoY + size / 2} fontSize="12" fill={color} fontWeight="bold">p</text>
                        <text x={geoX + size * 0.6} y={geoY + size + 16} fontSize="12" fill={color} fontWeight="bold">b</text>
                        <text x={geoX + size * 0.65} y={geoY + size * 0.45} fontSize="12" fill={color} fontWeight="bold">h</text>
                      </g>
                    ) : (
                      /* Standard Triangle with angle theta arc */
                      <g>
                        <polygon
                          points={`${geoX + size / 2},${geoY} ${geoX + size},${geoY + size * 0.9} ${geoX},${geoY + size * 0.9}`}
                          fill="#FDF2F8"
                          stroke={color}
                          strokeWidth="2.5"
                          className="animate-draw"
                        />
                        {/* Bottom angle arc */}
                        <path
                          d={`M ${geoX + 22} ${geoY + size * 0.9} A 18 18 0 0 0 ${geoX + 16} ${geoY + size * 0.9 - 14}`}
                          fill="none"
                          stroke="#EC4899"
                          strokeWidth="2"
                        />
                        <text x={geoX + 26} y={geoY + size * 0.9 - 6} fontSize="12" fill="#BE185D" fontWeight="bold">θ</text>
                      </g>
                    )}
                    {act.content && (
                      <text
                        x={geoX + size / 2}
                        y={geoY + size * 0.9 + 26}
                        textAnchor="middle"
                        fill={color}
                        fontSize={fontSize * 0.9}
                        className="font-board"
                        style={{ fontFamily: "'Caveat', cursive" }}
                      >
                        {act.content}
                      </text>
                    )}
                  </g>
                );
              }

              default:
                return null;
            }
          })}
        </svg>

        {/* Student Freehand Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 w-full h-full ${
            isDrawingMode ? 'pointer-events-auto touch-none' : 'pointer-events-none'
          }`}
        />
      </div>

      {/* Bottom Step Speech & Playback Deck */}
      {lesson && currentStep && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-4 py-2 bg-black/5 border-t border-inherit gap-2 select-none">
          {/* Sara's Spoken Speech for Current Step */}
          <div className="flex items-start gap-2 flex-1 min-w-0 w-full sm:w-auto">
            <span className="text-base shrink-0 select-none">👧</span>
            <p className="text-xs sm:text-sm font-medium leading-relaxed italic text-slate-700 dark:text-slate-200 line-clamp-2 sm:line-clamp-2">
              "{currentStep.say}"
            </p>
          </div>

          {/* Step Player Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrevStep}
              disabled={currentStepIndex <= 0}
              className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 disabled:opacity-40 transition-colors"
              title="Previous Step"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={handleTogglePlay}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500 hover:bg-pink-600 text-white shadow-xs transition-all"
              title={isPlaying ? 'Pause' : 'Play Lesson'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={handleNextStep}
              disabled={currentStepIndex >= lesson.steps.length - 1}
              className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 disabled:opacity-40 transition-colors"
              title="Next Step"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              onClick={handleReplay}
              className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 transition-colors"
              title="Replay Lesson"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed Selector */}
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-xs font-semibold px-1.5 py-1 rounded-md bg-white/80 border border-slate-200 text-slate-700"
              title="Playback Speed"
            >
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
