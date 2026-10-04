/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { SaraMood } from '../types';
import { audioPlayer } from '../services/audioPlayer';

interface SaraAvatarProps {
  mood: SaraMood;
  onAvatarClick?: () => void;
  compact?: boolean;
}

export const SaraAvatar: React.FC<SaraAvatarProps> = ({
  mood,
  onAvatarClick,
  compact = false,
}) => {
  const [mouthOpen, setMouthOpen] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);

  // Lip-sync loop when talking
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

  // Periodic natural blinking
  useEffect(() => {
    if (mood === 'sleepy') return;

    const scheduleBlink = () => {
      const nextBlinkDelay = 2500 + Math.random() * 3500;
      return window.setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          // 25% chance of a quick double-blink
          if (Math.random() < 0.25) {
            setTimeout(() => {
              setIsBlinking(true);
              setTimeout(() => setIsBlinking(false), 120);
            }, 160);
          }
          blinkTimer = scheduleBlink();
        }, 160);
      }, nextBlinkDelay);
    };

    let blinkTimer = scheduleBlink();
    return () => clearTimeout(blinkTimer);
  }, [mood]);

  const sizeClass = compact ? 'w-24 h-24' : 'w-32 h-32 sm:w-40 sm:h-40';

  // Eye heights based on state
  const eyeClosed = isBlinking || mood === 'sleepy';
  const happyEyes = mood === 'happy';

  // Dynamic mouth dimensions
  // When closed: width 12, height 2 (gentle smile curve)
  // When open: width 14-18, height 6-18 (rounded open mouth)
  const mouthHeight = Math.max(2, mouthOpen * 14);
  const mouthWidth = 10 + mouthOpen * 6;

  return (
    <div
      onClick={onAvatarClick}
      className={`relative select-none cursor-pointer group transition-transform duration-300 hover:scale-105 ${sizeClass} animate-cute-float`}
      title="Click me to hear Sara say hello! ✨"
    >
      {/* Floating Status Particle Bubbles */}
      {mood === 'sleepy' && (
        <div className="absolute -top-3 right-0 flex flex-col items-center pointer-events-none">
          <span className="text-xs font-bold text-indigo-400 animate-bounce duration-1000">Z</span>
          <span className="text-sm font-extrabold text-indigo-500 animate-pulse delay-200">z</span>
          <span className="text-base font-black text-indigo-600 delay-500">z...</span>
        </div>
      )}

      {mood === 'thinking' && (
        <div className="absolute -top-2 -left-1 pointer-events-none">
          <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shadow-md animate-pulse">
            <span className="text-xs font-bold text-amber-600">💡</span>
          </div>
        </div>
      )}

      {mood === 'happy' && (
        <div className="absolute -top-3 -right-1 pointer-events-none animate-sparkle">
          <span className="text-lg">💖</span>
        </div>
      )}

      {mood === 'listening' && (
        <div className="absolute -top-2 right-2 pointer-events-none flex items-center gap-0.5">
          <span className="w-1.5 h-3 bg-pink-400 rounded-full animate-pulse" />
          <span className="w-1.5 h-4 bg-pink-500 rounded-full animate-pulse delay-75" />
          <span className="w-1.5 h-2 bg-pink-400 rounded-full animate-pulse delay-150" />
        </div>
      )}

      {/* SVG Vector Anime Girl */}
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-md overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Hair Gradient */}
          <linearGradient id="saraHairGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7B5265" />
            <stop offset="60%" stopColor="#53354A" />
            <stop offset="100%" stopColor="#3E2737" />
          </linearGradient>

          {/* Hair Highlights */}
          <linearGradient id="hairShineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFC2D1" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFE5EC" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFC2D1" stopOpacity="0" />
          </linearGradient>

          {/* Eye Gradient */}
          <linearGradient id="saraEyeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>

          {/* Ribbon Bow Gradient */}
          <linearGradient id="saraBowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF9AA2" />
            <stop offset="100%" stopColor="#FFB7B2" />
          </linearGradient>

          {/* School Uniform Collar Gradient */}
          <linearGradient id="saraCollarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
        </defs>

        {/* Back Hair Strands & Ponytail Tails */}
        <path
          d="M 45 105 C 20 120, 15 155, 30 185 C 40 180, 50 160, 52 135 Z"
          fill="#442838"
        />
        <path
          d="M 155 105 C 180 120, 185 155, 170 185 C 160 180, 150 160, 148 135 Z"
          fill="#442838"
        />

        {/* Shoulders & School Uniform Body */}
        <ellipse cx="100" cy="188" rx="65" ry="32" fill="#E8D7F1" />
        {/* Uniform Vest */}
        <path
          d="M 60 165 L 140 165 L 148 200 L 52 200 Z"
          fill="#5E4B8B"
        />
        {/* White Sailor Collar */}
        <polygon points="72,165 100,185 128,165 140,172 100,195 60,172" fill="url(#saraCollarGrad)" stroke="#CBD5E1" strokeWidth="1" />
        {/* Red Bow Tie on Chest */}
        <path d="M 94 185 C 88 180, 85 190, 93 192 Z" fill="#E11D48" />
        <path d="M 106 185 C 112 180, 115 190, 107 192 Z" fill="#E11D48" />
        <circle cx="100" cy="186" r="3" fill="#BE123C" />

        {/* Neck */}
        <rect x="91" y="142" width="18" height="22" rx="6" fill="#FEE5D8" />
        {/* Neck shadow */}
        <path d="M 91 146 C 96 152, 104 152, 109 146 L 109 142 L 91 142 Z" fill="#F8C7B0" opacity="0.6" />

        {/* Cute Ears with Pearl Earrings */}
        <ellipse cx="50" cy="116" rx="8" ry="11" fill="#FEE5D8" />
        <ellipse cx="150" cy="116" rx="8" ry="11" fill="#FEE5D8" />
        {/* Pearl earring */}
        <circle cx="48" cy="123" r="2.5" fill="#FFFFFF" stroke="#FBCFE8" strokeWidth="0.8" />
        <circle cx="152" cy="123" r="2.5" fill="#FFFFFF" stroke="#FBCFE8" strokeWidth="0.8" />

        {/* Head / Face */}
        <path
          d="M 52 100 C 52 65, 148 65, 148 100 C 148 135, 128 154, 100 154 C 72 154, 52 135, 52 100 Z"
          fill="#FFF0E5"
        />

        {/* Cheerful Blush Cheeks */}
        <ellipse cx="68" cy="122" rx="10" ry="6" fill="#FFAAA6" opacity="0.55" />
        <ellipse cx="132" cy="122" rx="10" ry="6" fill="#FFAAA6" opacity="0.55" />
        {/* Blush accent hearts/lines */}
        <path d="M 64 122 L 67 119 M 68 123 L 71 120" stroke="#FF6B81" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <path d="M 129 122 L 132 119 M 133 123 L 136 120" stroke="#FF6B81" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

        {/* Eyes */}
        {eyeClosed ? (
          /* Sleeping / Blinking Eyes: Gentle happy arcs */
          <g>
            <path
              d="M 66 112 Q 76 119 86 112"
              fill="none"
              stroke="#3E2737"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M 114 112 Q 124 119 134 112"
              fill="none"
              stroke="#3E2737"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Eyelash flicks */}
            <path d="M 85 112 L 89 110" stroke="#3E2737" strokeWidth="2" strokeLinecap="round" />
            <path d="M 133 112 L 137 110" stroke="#3E2737" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : happyEyes ? (
          /* Happy curved anime eye squint */
          <g>
            <path
              d="M 65 114 Q 76 103 87 114"
              fill="none"
              stroke="#3E2737"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 113 114 Q 124 103 135 114"
              fill="none"
              stroke="#3E2737"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path d="M 87 114 L 91 116" stroke="#3E2737" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 135 114 L 139 116" stroke="#3E2737" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ) : (
          /* Open anime eyes: Large, expressive, sparkly */
          <g>
            {/* Left Eye White */}
            <ellipse cx="76" cy="111" rx="11" ry="14" fill="#FFFFFF" />
            {/* Left Iris */}
            <ellipse cx="77" cy="112" rx="9" ry="12" fill="url(#saraEyeGrad)" />
            {/* Pupil */}
            <ellipse cx="77" cy="113" rx="4.5" ry="6" fill="#1E1B4B" />
            {/* Main Catchlight shine */}
            <ellipse cx="74" cy="107" rx="3.5" ry="4" fill="#FFFFFF" />
            {/* Secondary bottom shine */}
            <circle cx="79" cy="116" r="1.8" fill="#FFFFFF" opacity="0.9" />
            {/* Eyelash line & flick */}
            <path d="M 64 108 C 67 101, 85 101, 88 108" fill="none" stroke="#2B1B26" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 87 107 L 91 104" stroke="#2B1B26" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 65 107 L 62 105" stroke="#2B1B26" strokeWidth="1.8" strokeLinecap="round" />

            {/* Right Eye White */}
            <ellipse cx="124" cy="111" rx="11" ry="14" fill="#FFFFFF" />
            {/* Right Iris */}
            <ellipse cx="123" cy="112" rx="9" ry="12" fill="url(#saraEyeGrad)" />
            {/* Pupil */}
            <ellipse cx="123" cy="113" rx="4.5" ry="6" fill="#1E1B4B" />
            {/* Main Catchlight shine */}
            <ellipse cx="120" cy="107" rx="3.5" ry="4" fill="#FFFFFF" />
            {/* Secondary bottom shine */}
            <circle cx="125" cy="116" r="1.8" fill="#FFFFFF" opacity="0.9" />
            {/* Eyelash line & flick */}
            <path d="M 112 108 C 115 101, 133 101, 136 108" fill="none" stroke="#2B1B26" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 135 107 L 139 104" stroke="#2B1B26" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 113 107 L 110 105" stroke="#2B1B26" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        )}

        {/* Soft Eyebrows */}
        <path
          d={
            mood === 'thinking'
              ? 'M 67 95 Q 76 98 85 96'
              : mood === 'listening'
              ? 'M 67 94 Q 76 91 85 95'
              : 'M 67 95 Q 76 92 85 95'
          }
          fill="none"
          stroke="#53354A"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d={
            mood === 'thinking'
              ? 'M 115 97 Q 124 93 133 96'
              : mood === 'listening'
              ? 'M 115 95 Q 124 91 133 94'
              : 'M 115 95 Q 124 92 133 95'
          }
          fill="none"
          stroke="#53354A"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Small Cute Nose */}
        <circle cx="100" cy="123" r="1.2" fill="#E2847A" />

        {/* Expressive Mouth (Synced to Web Audio Analyser when talking) */}
        {mouthOpen > 0.1 ? (
          /* Dynamic Open Talking Mouth */
          <g>
            <path
              d={`M ${100 - mouthWidth / 2} 133 Q 100 131 ${100 + mouthWidth / 2} 133 Q 100 ${133 + mouthHeight} ${100 - mouthWidth / 2} 133 Z`}
              fill="#BE123C"
              stroke="#881337"
              strokeWidth="1.5"
            />
            {/* Cute pink tongue inside */}
            <ellipse
              cx="100"
              cy={133 + mouthHeight * 0.7}
              rx={mouthWidth * 0.35}
              ry={mouthHeight * 0.3}
              fill="#FB7185"
            />
          </g>
        ) : (
          /* Gentle Cheerful Smile Curve */
          <path
            d="M 94 133 Q 100 138 106 133"
            fill="none"
            stroke="#9F1239"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* Front Hair Bangs & Cute Side Tendrils */}
        {/* Main bangs outline */}
        <path
          d="M 48 95 C 45 60, 80 50, 100 50 C 120 50, 155 60, 152 95 C 145 78, 138 88, 128 80 C 118 74, 112 88, 100 82 C 88 88, 82 74, 72 80 C 62 88, 55 78, 48 95 Z"
          fill="url(#saraHairGrad)"
        />
        {/* Left framing strand */}
        <path
          d="M 52 90 C 48 115, 52 140, 56 148 C 58 140, 60 120, 56 95 Z"
          fill="url(#saraHairGrad)"
        />
        {/* Right framing strand */}
        <path
          d="M 148 90 C 152 115, 148 140, 144 148 C 142 140, 140 120, 144 95 Z"
          fill="url(#saraHairGrad)"
        />
        {/* Hair shine halo band */}
        <path
          d="M 60 70 Q 100 64 140 70 Q 100 60 60 70 Z"
          fill="url(#hairShineGrad)"
        />

        {/* Big Pastel Hair Bow Ribbon (Upper Left) */}
        <g transform="translate(42, 45) rotate(-15)">
          {/* Left Wing */}
          <path d="M 0 0 C -25 -15, -28 15, 0 0 Z" fill="url(#saraBowGrad)" stroke="#FF85A1" strokeWidth="1.2" />
          {/* Right Wing */}
          <path d="M 0 0 C 25 -15, 28 15, 0 0 Z" fill="url(#saraBowGrad)" stroke="#FF85A1" strokeWidth="1.2" />
          {/* Ribbon Ends */}
          <path d="M -3 3 Q -15 20 -20 28 Q -8 22 0 4 Z" fill="#FFAAA6" />
          <path d="M 3 3 Q 12 22 18 30 Q 8 22 0 4 Z" fill="#FFAAA6" />
          {/* Center Knot */}
          <circle cx="0" cy="0" r="6" fill="#FF6B81" />
          <circle cx="-1.5" cy="-1.5" r="2" fill="#FFFFFF" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
};
