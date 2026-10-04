/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { SaraAvatar } from './SaraAvatar';
import { validateAndDiscoverModels } from '../services/gemini';

interface ApiKeySetupCardProps {
  onSaveKey: (
    apiKey: string,
    discovered?: {
      bestFlashModel: string;
      bestTtsModel: string;
      availableTextModels: string[];
      availableTtsModels: string[];
    }
  ) => void;
}

export const ApiKeySetupCard: React.FC<ApiKeySetupCardProps> = ({ onSaveKey }) => {
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setErrorMessage('कृपया सारा के साथ पढ़ाई शुरू करने के लिए अपनी Gemini API चाबी (Key) दर्ज करें!');
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);

    const discovery = await validateAndDiscoverModels(cleanKey);
    setIsValidating(false);

    if (discovery.success) {
      onSaveKey(cleanKey, {
        bestFlashModel: discovery.bestFlashModel,
        bestTtsModel: discovery.bestTtsModel,
        availableTextModels: discovery.availableTextModels,
        availableTtsModels: discovery.availableTtsModels,
      });
    } else {
      setErrorMessage(discovery.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#FFFDF8] via-[#FAF7F0] to-[#F5ECE0] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100">
      <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl shadow-xl border border-pink-100 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Sara Greeting Avatar (Round photo portrait) */}
        <div className="flex flex-col items-center text-center space-y-3">
          <SaraAvatar mood="happy" size="lg" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-handwriting">
            नमस्ते! मैं सारा हूँ 🌸
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xs font-medium">
            आपकी प्यारी पढ़ाई वाली दोस्त! मैं बोलकर, कैमरे से आपकी किताब देखकर और लाइव व्हाइटबोर्ड पर लिखकर हर विषय आसानी से समझाती हूँ।
          </p>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              अपनी Google Gemini API चाबी (Key) पेस्ट करें:
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="AIzaSy..."
                className="w-full pl-3.5 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-pink-50/60 dark:bg-slate-800/60 border border-pink-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium text-[11px] leading-tight">
              आपकी चाबी केवल इसी ब्राउज़र में रहती है और कभी किसी बाहरी सर्वर पर नहीं भेजी जाती।
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={isValidating || !apiKeyInput.trim()}
            className="w-full py-3.5 rounded-2xl bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-extrabold text-sm shadow-md shadow-pink-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {isValidating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>आपकी चाबी जांची जा रही है...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>चाबी सहेजें और पढ़ाई शुरू करें</span>
              </>
            )}
          </button>
        </form>

        {/* Link to get key */}
        <div className="text-center pt-1">
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 dark:text-pink-400 font-semibold hover:underline"
          >
            <span>Google AI Studio से मुफ्त Gemini API चाबी प्राप्त करें</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
