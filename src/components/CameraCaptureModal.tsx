/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RotateCw,
  X,
  Upload,
  Send,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendCapture: (imageBase64: string, questionText: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onSendCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setIsInitializing(true);
    setCameraError(null);

    if (stream) {
      stream?.getTracks?.()?.forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          "कैमरे की अनुमति नहीं मिली! कृपया ब्राउज़र में ऊपर ताले (Lock) वाले निशान पर क्लिक करके अनुमति दें 📷"
        );
      } else if (err.name === 'OverconstrainedError' && facing === 'environment') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(fallbackStream);
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
          }
          return;
        } catch (fbErr: any) {
          setCameraError(`कैमरा शुरू नहीं हो सका: ${fbErr.message || String(fbErr)}`);
        }
      } else {
        setCameraError(`कैमरा शुरू नहीं हो सका: ${err.message || String(err)}`);
      }
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    } else if (!isOpen && stream) {
      stream?.getTracks?.()?.forEach((track) => track.stop());
      setStream(null);
    }

    return () => {
      if (stream) {
        stream?.getTracks?.()?.forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode, capturedImage]);

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedImage(dataUrl);

    if (stream) {
      stream?.getTracks?.()?.forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCapturedImage(result);
        if (stream) {
          stream?.getTracks?.()?.forEach((t) => t.stop());
          setStream(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (!capturedImage) return;
    const prompt = questionText.trim() || 'कृपया इस चित्र में दिए गए सवाल या चित्र को व्हाइटबोर्ड पर क्रमबद्ध तरीके से समझाइए!';
    onSendCapture(capturedImage, prompt);
    handleClose();
  };

  const handleClose = () => {
    if (stream) {
      stream?.getTracks?.()?.forEach((track) => track.stop());
      setStream(null);
    }
    setCapturedImage(null);
    setQuestionText('');
    setCameraError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-pink-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-600 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                सारा को अपनी पढ़ाई दिखाइए
              </h3>
              <p className="text-xs text-slate-500">
                किताब का पन्ना, गणित का सवाल, या हस्तलिखित नोट्स
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] bg-black flex items-center justify-center overflow-hidden">
          {!capturedImage && !cameraError && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-md animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>कैमरा चालू है</span>
            </div>
          )}

          {cameraError ? (
            <div className="p-6 text-center text-white max-w-sm">
              <AlertCircle className="w-12 h-12 text-pink-400 mx-auto mb-3" />
              <p className="text-sm font-medium mb-4">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md transition-all inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                गैलरी से फोटो अपलोड करें
              </button>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedImage}
                alt="Captured question"
                className="max-h-[380px] w-auto object-contain"
              />
              <button
                onClick={handleRetake}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                दोबारा लें
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {isInitializing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
                  कैमरा शुरू हो रहा है...
                </div>
              )}

              <button
                onClick={handleFlipCamera}
                className="absolute bottom-4 right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-xs transition-colors"
                title="कैमरा बदलें (आगे / पीछे)"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {capturedImage ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="अपना सवाल लिखें (जैसे: 'दूसरा चरण हल करें', 'यह चित्र समझाइए')"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold shadow-md transition-all shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>सारा से पूछें</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                सारा तस्वीर देखकर तुरंत व्हाइटबोर्ड पर समझाएगी! ✨
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Upload className="w-4 h-4 text-pink-500" />
                <span>गैलरी से फोटो</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                onClick={handleCapture}
                disabled={!!cameraError || isInitializing}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 active:scale-95 text-white shadow-lg shadow-pink-200 dark:shadow-none transition-all disabled:opacity-50 ring-4 ring-pink-100 dark:ring-pink-900/30"
                title="फोटो खींचें"
              >
                <div className="w-6 h-6 rounded-full border-2 border-white" />
              </button>

              <div className="text-[11px] text-slate-400 text-right max-w-[100px] leading-tight">
                सवाल को बीच में सीधा रखें
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
