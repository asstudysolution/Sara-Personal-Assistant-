/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SaraMood } from '../types';
import { audioPlayer } from '../services/audioPlayer';

interface SaraAvatarProps {
  mood?: SaraMood;
  onAvatarClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showMoodBadge?: boolean;
}

export const SaraAvatar: React.FC<SaraAvatarProps> = ({
  mood = 'idle',
  onAvatarClick,
  size = 'md',
  showMoodBadge = true,
}) => {
  const [mouthOpen, setMouthOpen] = useState<number>(0);
  const [imgError, setImgError] = useState<boolean>(false);

  // Monitor real-time audio amplitude from AnalyserNode
  useEffect(() => {
    let animId: number;
    const updateLipSync = () => {
      if (mood === 'talking' || audioPlayer.getIsPlaying()) {
        const level = audioPlayer.getAudioLevel();
        setMouthOpen(level);
      } else {
        setMouthOpen(0);
      }
      animId = requestAnimationFrame(updateLipSync);
    };
    animId = requestAnimationFrame(updateLipSync);
    return () => cancelAnimationFrame(animId);
  }, [mood]);

  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-10 h-10',
    md: 'w-14 h-14 sm:w-16 sm:h-16',
    lg: 'w-20 h-20 sm:w-24 sm:h-24',
    xl: 'w-28 h-28 sm:w-36 sm:h-36',
  }[size];

  // Dynamic voice aura scale & glow
  const isSpeaking = mood === 'talking' || mouthOpen > 0.05;
  const pulseScale = isSpeaking ? 1 + mouthOpen * 0.18 : 1;
  const auraGlow = isSpeaking
    ? `0 0 ${12 + mouthOpen * 25}px rgba(244, 63, 94, ${0.45 + mouthOpen * 0.5})`
    : '0 2px 10px rgba(244, 114, 182, 0.2)';

  return (
    <div
      onClick={onAvatarClick}
      className={`relative select-none ${sizeClasses} shrink-0 cursor-pointer group transition-transform duration-300 hover:scale-105 animate-cute-float`}
      title="सारा (Sara) - आपकी पढ़ाई वाली दोस्त"
    >
      {/* 1. Voice Pulsing Glow Ring */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-75 pointer-events-none"
        style={{
          transform: `scale(${pulseScale})`,
          boxShadow: auraGlow,
          border: isSpeaking ? '2.5px solid #FB7185' : '2px solid rgba(251, 113, 133, 0.4)',
        }}
      />

      {/* 2. Photo Portrait with center 25% crop */}
      <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-pink-200 dark:border-pink-500/40 shadow-sm bg-pink-100">
        {!imgError ? (
          <img
            src="/sara.jpg"
            alt="सारा (Sara)"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ objectPosition: 'center 25%' }}
            onError={() => setImgError(true)}
          />
        ) : (
          /* Pink gradient fallback with letter "S" */
          <div className="w-full h-full bg-gradient-to-tr from-pink-400 via-rose-400 to-pink-300 flex items-center justify-center text-white font-extrabold font-handwriting text-xl sm:text-2xl shadow-inner">
            S
          </div>
        )}
      </div>

      {/* 3. Mood Indicators (Emotes) */}
      {showMoodBadge && (
        <>
          {/* Thinking: Bouncing Dots Bubble */}
          {mood === 'thinking' && (
            <div className="absolute -top-3 -right-1 z-10 flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 rounded-full shadow-md border border-pink-200 pointer-events-none animate-bounce">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse delay-100" />
              <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse delay-200" />
            </div>
          )}

          {/* Happy: Floating Hearts & Sparkles */}
          {mood === 'happy' && (
            <div className="absolute -top-3 -right-2 z-10 pointer-events-none animate-sparkle">
              <span className="text-sm drop-shadow-md">💖</span>
            </div>
          )}

          {/* Sleepy: Floating Zzz */}
          {mood === 'sleepy' && (
            <div className="absolute -top-3 -right-1 z-10 flex flex-col items-center pointer-events-none">
              <span className="text-[10px] font-black text-indigo-400 animate-pulse">Z</span>
              <span className="text-xs font-black text-indigo-500 -mt-1 animate-pulse delay-150">z</span>
            </div>
          )}

          {/* Listening: Gentle soundwave dot */}
          {mood === 'listening' && (
            <div className="absolute -bottom-1 -right-1 z-10 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-xs flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full animate-ping" />
            </div>
          )}
        </>
      )}
    </div>
  );
};
