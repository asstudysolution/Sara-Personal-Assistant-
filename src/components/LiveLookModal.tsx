/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Video,
  Mic,
  MicOff,
  Square,
  RotateCw,
  X,
  Volume2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { UserSettings } from '../types';
import { queryLiveLookFrame } from '../services/gemini';
import { audioPlayer } from '../services/audioPlayer';
import { SaraAvatar } from './SaraAvatar';

interface LiveLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
}

export const LiveLookModal: React.FC<LiveLookModalProps> = ({
  isOpen,
  onClose,
  settings,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const isLoopRunningRef = useRef<boolean>(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isListening, setIsListening] = useState<boolean>(true);
  const [isSaraResponding, setIsSaraResponding] = useState<boolean>(false);
  const [saraSubtitle, setSaraSubtitle] = useState<string>(
    'नमस्ते! मैं आपकी कॉपी देख रही हूँ। लिखते हुए कुछ भी पूछिए! 🌸'
  );
  const [userSpokenText, setUserSpokenText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize Camera Stream
  const initStream = useCallback(async (facing: 'environment' | 'user') => {
    if (streamRef.current) {
      streamRef.current?.getTracks?.()?.forEach((t) => t.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Live look camera error:', err);
      setErrorMsg(
        'कैमरे तक पहुँच नहीं मिली! कृपया ब्राउज़र में कैमरे की अनुमति दें 📷'
      );
    }
  }, []);

  // Initialize Speech Recognition for continuous hands-free dialogue
  useEffect(() => {
    if (!isOpen) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = settings.speechInputLang || 'hi-IN';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0].transcript.trim();
            if (final) {
              setUserSpokenText(final);
              // Trigger instant vision inspection on spoken question
              triggerFrameAnalysis(final);
            }
          } else {
            interim += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error in Live Look:', e);
      };

      recognition.onend = () => {
        if (isListening && isOpen) {
          try {
            recognition.start();
          } catch {}
        }
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch {}
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isOpen, isListening, settings.speechInputLang]);

  // Capture current video frame as base64 JPEG
  const captureCurrentFrame = (): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement('canvas');
    // Scale down to ~640x360 for fast 1 FPS streaming
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.75);
  };

  // Analyze frame with user's speech
  const triggerFrameAnalysis = async (userPrompt?: string) => {
    if (isSaraResponding) return;
    const frame = captureCurrentFrame();
    if (!frame) return;

    setIsSaraResponding(true);
    try {
      const response = await queryLiveLookFrame(
        frame,
        userPrompt || userSpokenText || 'सारा, आप सामने क्या देख रही हैं? समझाएं!',
        settings
      );
      setSaraSubtitle(response);
      await audioPlayer.speakText(response, settings, undefined, () => {
        setIsSaraResponding(false);
      });
    } catch (err: any) {
      console.warn('Live Look analysis error:', err);
      setIsSaraResponding(false);
    }
  };

  // Interrupt Sara button
  const handleInterrupt = () => {
    audioPlayer.stop();
    setIsSaraResponding(false);
    setSaraSubtitle('रुक गई हूँ! जब भी आप तैयार हों, पूछिए! ✨');
  };

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    initStream(nextFacing);
  };

  useEffect(() => {
    if (isOpen) {
      initStream(facingMode);
      setSaraSubtitle('नमस्ते! मैं आपकी कॉपी देख रही हूँ। लिखते हुए कुछ भी पूछिए! 🌸');
    } else {
      if (streamRef.current) {
        streamRef.current?.getTracks?.()?.forEach((t) => t.stop());
        streamRef.current = null;
      }
      audioPlayer.stop();
      setIsSaraResponding(false);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current?.getTracks?.()?.forEach((t) => t.stop());
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-white z-10">
          <div className="flex items-center gap-2">
            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-md animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>लाइव लुक · कैमरा चालू है</span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              कॉपी पर लिखते हुए बोलकर सारा से सीखें
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFlipCamera}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              title="कैमरा बदलें"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            }`}
          />

          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-black/80">
              <AlertCircle className="w-10 h-10 text-pink-400 mb-2" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Sara Avatar in Corner */}
          <div className="absolute bottom-4 right-4 z-20 flex flex-col items-center drop-shadow-xl pointer-events-none">
            <SaraAvatar mood={isSaraResponding ? 'talking' : 'listening'} size="sm" showMoodBadge={false} />
          </div>

          {/* Real-time Subtitle Banner */}
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-center">
            <div className="max-w-md px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/10 text-white text-center shadow-lg">
              <p className="text-xs sm:text-sm font-medium leading-relaxed italic text-pink-200">
                "{saraSubtitle}"
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 text-white">
          {/* Ask Now / Trigger Frame Analysis */}
          <button
            onClick={() => triggerFrameAnalysis()}
            disabled={isSaraResponding}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>देखकर समझाओ</span>
          </button>

          {/* Interrupt Button */}
          {isSaraResponding && (
            <button
              onClick={handleInterrupt}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all animate-bounce"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>सारा को रोकें</span>
            </button>
          )}

          {/* Status Label */}
          <div className="text-right text-xs text-slate-400">
            {isSaraResponding ? (
              <span className="text-pink-400 font-semibold animate-pulse">सारा बोल रही है...</span>
            ) : (
              <span>आपकी आवाज़ सुन रही हूँ 🎙️</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
