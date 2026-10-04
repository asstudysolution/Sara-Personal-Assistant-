/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface TeacherHandProps {
  x: number; // pixel X coordinate on the board
  y: number; // pixel Y coordinate on the board
  isWriting: boolean;
  isPointing: boolean;
  markerColor?: string;
  visible?: boolean;
}

export const TeacherHand: React.FC<TeacherHandProps> = ({
  x,
  y,
  isWriting,
  isPointing,
  markerColor = '#2563EB',
  visible = true,
}) => {
  if (!visible) return null;

  // When lifting / idle, add slight offset and rotation
  const liftOffsetX = isWriting || isPointing ? 0 : 28;
  const liftOffsetY = isWriting || isPointing ? 0 : 24;
  const liftRotation = isWriting ? 0 : isPointing ? -5 : 6;
  const opacity = isWriting || isPointing ? 1 : 0.65;

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none z-30 transition-transform duration-100 ease-out will-change-transform"
      style={{
        transform: `translate3d(${x + liftOffsetX}px, ${y + liftOffsetY}px, 0) rotate(${liftRotation}deg)`,
        opacity,
      }}
    >
      {/* 1. Pointing Glow Halo if pointing */}
      {isPointing && (
        <div
          className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-yellow-300/40 border border-yellow-400 animate-ping pointer-events-none"
        />
      )}

      {/* 2. Hand SVG (Anchor / Nib Tip is at (0, 0)) */}
      <svg
        width="140"
        height="140"
        viewBox="-10 -10 140 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg filter"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Natural soft Indian skin tone gradient */}
          <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCD5B5" />
            <stop offset="40%" stopColor="#F7C196" />
            <stop offset="85%" stopColor="#E6A875" />
            <stop offset="100%" stopColor="#D99762" />
          </linearGradient>

          {/* Golden bangle gradient */}
          <linearGradient id="goldBangle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="80%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Marker pen body gradient */}
          <linearGradient id="penBody" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Soft shadow for fingers */}
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1.5" dy="3" stdDeviation="2" floodOpacity="0.18" />
          </filter>
        </defs>

        {isPointing ? (
          /* POINTING HAND: Index finger pointing directly at (0, 0) */
          <g transform="translate(0, 0)">
            {/* Wrist & Forearm */}
            <path
              d="M 45 40 C 60 55, 80 85, 95 115 C 80 125, 65 125, 45 105 C 35 75, 30 55, 45 40 Z"
              fill="url(#skinGrad)"
            />

            {/* Delicate Golden Bangle */}
            <ellipse
              cx="70"
              cy="95"
              rx="17"
              ry="7"
              fill="none"
              stroke="url(#goldBangle)"
              strokeWidth="3.5"
              transform="rotate(-25 70 95)"
            />
            <circle cx="62" cy="91" r="1.5" fill="#FFF" opacity="0.9" />

            {/* Hand Palm */}
            <path
              d="M 22 24 C 26 18, 38 22, 45 32 C 50 40, 48 52, 38 56 C 28 60, 20 50, 18 38 Z"
              fill="url(#skinGrad)"
              filter="url(#softShadow)"
            />

            {/* Bent other fingers */}
            <path
              d="M 20 28 C 16 32, 16 42, 24 45 C 30 47, 34 42, 34 35 Z"
              fill="#ECA87A"
            />
            <path
              d="M 24 38 C 21 42, 22 50, 29 52 C 34 53, 38 48, 38 42 Z"
              fill="#DF9A6C"
            />

            {/* Extended Index Finger pointing to (0, 0) */}
            <path
              d="M 2 2 C 0 0, 4 -2, 9 4 C 18 14, 25 22, 28 26 C 25 30, 19 28, 12 18 C 6 10, 3 4, 2 2 Z"
              fill="url(#skinGrad)"
              stroke="#D99762"
              strokeWidth="0.8"
            />
            {/* Cute polished fingernail */}
            <ellipse cx="4.5" cy="4" rx="2" ry="1.4" fill="#F472B6" opacity="0.85" />
          </g>
        ) : (
          /* WRITING HAND: Holding marker pen with nib right at (0, 0) */
          <g>
            {/* 1. Marker Pen (Angled from (0,0) down-right to (45, 45)) */}
            {/* Nib Tip touching (0, 0) */}
            <polygon
              points="0,0 4,8 1,11"
              fill={markerColor}
            />
            {/* Nib Collar / Metal Band */}
            <polygon
              points="2,10 6,7 10,11 6,14"
              fill="#64748B"
            />
            {/* Marker Barrel Body */}
            <path
              d="M 7 12 L 35 40 L 41 34 L 13 6 Z"
              fill="url(#penBody)"
              stroke="#CBD5E1"
              strokeWidth="0.8"
            />
            {/* Color Accent Ring on Marker */}
            <path
              d="M 16 21 L 20 25 L 23 22 L 19 18 Z"
              fill={markerColor}
            />

            {/* 2. Wrist & Forearm */}
            <path
              d="M 45 52 C 58 65, 78 95, 95 120 C 82 128, 68 126, 48 108 C 36 82, 32 64, 45 52 Z"
              fill="url(#skinGrad)"
            />

            {/* 3. Delicate Golden Bangle */}
            <ellipse
              cx="72"
              cy="100"
              rx="18"
              ry="7"
              fill="none"
              stroke="url(#goldBangle)"
              strokeWidth="3.5"
              transform="rotate(-25 72 100)"
            />
            <circle cx="64" cy="96" r="1.5" fill="#FFFFFF" opacity="0.9" />

            {/* 4. Hand Palm & Fingers gripping pen */}
            {/* Back of Hand */}
            <path
              d="M 22 36 C 26 28, 40 32, 48 44 C 54 54, 50 66, 38 68 C 26 70, 18 56, 22 36 Z"
              fill="url(#skinGrad)"
              filter="url(#softShadow)"
            />

            {/* Middle Finger resting under pen */}
            <path
              d="M 14 26 C 18 20, 26 24, 28 32 C 30 38, 24 44, 18 42 C 12 40, 10 32, 14 26 Z"
              fill="#DF9A6C"
            />

            {/* Index Finger on top of pen body */}
            <path
              d="M 6 14 C 4 10, 10 7, 18 14 C 26 22, 28 28, 25 32 C 20 34, 14 28, 9 20 C 7 17, 6 15, 6 14 Z"
              fill="url(#skinGrad)"
              stroke="#D99762"
              strokeWidth="0.8"
            />
            {/* Cute pink fingernail on index finger */}
            <ellipse cx="8.5" cy="13.5" rx="2.2" ry="1.5" fill="#F472B6" opacity="0.85" />

            {/* Thumb pressing gently against marker */}
            <path
              d="M 12 24 C 8 22, 10 16, 17 18 C 24 20, 26 26, 23 30 C 19 32, 15 28, 12 24 Z"
              fill="url(#skinGrad)"
              stroke="#D99762"
              strokeWidth="0.8"
            />
            {/* Cute pink fingernail on thumb */}
            <ellipse cx="15.5" cy="18.5" rx="1.8" ry="1.3" fill="#F472B6" opacity="0.85" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const SvgTeacherHand: React.FC<TeacherHandProps> = ({
  x,
  y,
  isWriting,
  isPointing,
  markerColor = '#2563EB',
  visible = true,
}) => {
  if (!visible) return null;

  const liftOffsetX = isWriting || isPointing ? 0 : 32;
  const liftOffsetY = isWriting || isPointing ? 0 : 26;
  const liftRotation = isWriting ? 0 : isPointing ? -5 : 6;
  const opacity = isWriting || isPointing ? 1 : 0.45;

  return (
    <g
      transform={`translate(${x + liftOffsetX}, ${y + liftOffsetY}) rotate(${liftRotation})`}
      opacity={opacity}
      className="transition-transform duration-100 ease-out"
      style={{ pointerEvents: 'none' }}
    >
      {/* Pointing glowing halo */}
      {isPointing && (
        <circle cx="0" cy="0" r="16" fill="#FDE047" fillOpacity="0.4" stroke="#EAB308" strokeWidth="2">
          <animate attributeName="r" values="12;24;12" dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}

      {isPointing ? (
        /* Pointing index finger */
        <g>
          {/* Forearm & Wrist */}
          <path
            d="M 35 32 C 48 45, 68 75, 82 105 C 70 112, 58 110, 38 92 C 28 65, 24 48, 35 32 Z"
            fill="url(#skinGrad)"
          />
          {/* Golden Bangle */}
          <ellipse
            cx="60"
            cy="84"
            rx="16"
            ry="6"
            fill="none"
            stroke="url(#goldBangle)"
            strokeWidth="3.2"
            transform="rotate(-25 60 84)"
          />
          <circle cx="53" cy="80" r="1.3" fill="#FFF" opacity="0.9" />

          {/* Hand Palm */}
          <path
            d="M 18 20 C 22 14, 32 18, 38 26 C 42 34, 40 44, 32 48 C 22 52, 16 42, 14 32 Z"
            fill="url(#skinGrad)"
          />
          {/* Bent fingers */}
          <path d="M 16 24 C 12 28, 13 36, 19 38 C 24 40, 28 36, 28 30 Z" fill="#ECA87A" />
          {/* Pointing index finger to (0, 0) */}
          <path
            d="M 1 1 C -1 -1, 3 -3, 8 2 C 16 12, 22 18, 24 22 C 21 25, 16 23, 10 14 C 5 8, 2 3, 1 1 Z"
            fill="url(#skinGrad)"
            stroke="#D99762"
            strokeWidth="0.8"
          />
          <ellipse cx="3.8" cy="3.2" rx="1.8" ry="1.2" fill="#F472B6" opacity="0.85" />
        </g>
      ) : (
        /* Writing hand with marker nib at (0, 0) */
        <g>
          {/* Marker Nib Tip exactly at (0, 0) */}
          <polygon points="0,0 4,8 1,11" fill={markerColor} />
          <polygon points="2,10 6,7 10,11 6,14" fill="#64748B" />
          <path d="M 7 12 L 35 40 L 41 34 L 13 6 Z" fill="url(#penBody)" stroke="#CBD5E1" strokeWidth="0.8" />
          <path d="M 16 21 L 20 25 L 23 22 L 19 18 Z" fill={markerColor} />

          {/* Forearm & Wrist */}
          <path
            d="M 38 45 C 50 56, 70 85, 84 108 C 72 115, 60 112, 42 96 C 30 72, 26 55, 38 45 Z"
            fill="url(#skinGrad)"
          />
          {/* Golden Bangle */}
          <ellipse
            cx="62"
            cy="88"
            rx="16"
            ry="6"
            fill="none"
            stroke="url(#goldBangle)"
            strokeWidth="3.2"
            transform="rotate(-25 62 88)"
          />
          <circle cx="55" cy="84" r="1.3" fill="#FFF" opacity="0.9" />

          {/* Hand Palm & Fingers */}
          <path
            d="M 18 30 C 22 24, 34 28, 42 38 C 46 46, 42 56, 32 58 C 22 60, 15 48, 18 30 Z"
            fill="url(#skinGrad)"
          />
          {/* Fingers gripping marker */}
          <path d="M 12 22 C 16 17, 22 20, 24 28 C 26 33, 20 38, 15 36 C 10 34, 8 28, 12 22 Z" fill="#DF9A6C" />
          <path
            d="M 5 12 C 3 8, 9 6, 16 12 C 22 18, 24 24, 21 28 C 17 30, 12 24, 8 17 C 6 15, 5 13, 5 12 Z"
            fill="url(#skinGrad)"
            stroke="#D99762"
            strokeWidth="0.8"
          />
          <ellipse cx="7.2" cy="11.5" rx="1.8" ry="1.2" fill="#F472B6" opacity="0.85" />
          <path
            d="M 10 20 C 7 18, 9 14, 15 15 C 21 17, 22 22, 20 26 C 16 28, 13 24, 10 20 Z"
            fill="url(#skinGrad)"
            stroke="#D99762"
            strokeWidth="0.8"
          />
          <ellipse cx="13.2" cy="15.5" rx="1.5" ry="1.1" fill="#F472B6" opacity="0.85" />
        </g>
      )}
    </g>
  );
};

