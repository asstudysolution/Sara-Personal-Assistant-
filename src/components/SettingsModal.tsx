/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Key,
  Check,
  Trash2,
  Edit2,
  Volume2,
  GraduationCap,
  Moon,
  Sun,
  X,
  Palette,
  ShieldCheck,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { UserSettings } from '../types';
import { validateAndDiscoverModels } from '../services/gemini';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  onRemoveApiKey: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onRemoveApiKey,
}) => {
  const [formData, setFormData] = useState<UserSettings>({ ...settings });
  const [isChangingKey, setIsChangingKey] = useState<boolean>(false);
  const [newKeyInput, setNewKeyInput] = useState<string>('');
  const [keyValidationMsg, setKeyValidationMsg] = useState<string | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState<boolean>(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState<boolean>(false);

  if (!isOpen) return null;

  // Validate key and discover real models via ai.models.list()
  const handleSaveKey = async () => {
    if (!newKeyInput.trim()) return;
    setIsValidatingKey(true);
    setKeyValidationMsg(null);

    const discovery = await validateAndDiscoverModels(newKeyInput.trim());
    setIsValidatingKey(false);

    if (discovery.success) {
      const updated: UserSettings = {
        ...formData,
        apiKey: newKeyInput.trim(),
        textModel: discovery.bestFlashModel,
        ttsModel: discovery.bestTtsModel,
        availableTextModels: discovery.availableTextModels,
        availableTtsModels: discovery.availableTtsModels,
      };
      setFormData(updated);
      onSaveSettings(updated);
      setIsChangingKey(false);
      setNewKeyInput('');
      setKeyValidationMsg(`Key saved! Discovered ${discovery.availableTextModels.length} models.`);
      setTimeout(() => setKeyValidationMsg(null), 3500);
    } else {
      setKeyValidationMsg(`Validation failed: ${discovery.message}`);
    }
  };

  // Re-detect available models with currently saved key
  const handleRefreshModels = async () => {
    if (!formData.apiKey) return;
    setIsRefreshingModels(true);
    setKeyValidationMsg(null);

    const discovery = await validateAndDiscoverModels(formData.apiKey);
    setIsRefreshingModels(false);

    if (discovery.success) {
      const updated: UserSettings = {
        ...formData,
        textModel: discovery.bestFlashModel,
        ttsModel: discovery.bestTtsModel,
        availableTextModels: discovery.availableTextModels,
        availableTtsModels: discovery.availableTtsModels,
      };
      setFormData(updated);
      onSaveSettings(updated);
      setKeyValidationMsg(`Updated model list! Found ${discovery.availableTextModels.length} models.`);
      setTimeout(() => setKeyValidationMsg(null), 3000);
    } else {
      setKeyValidationMsg(discovery.message);
    }
  };

  const handleSaveAll = () => {
    onSaveSettings(formData);
    onClose();
  };

  // Model lists with fallback defaults
  const textModelOptions =
    formData.availableTextModels && formData.availableTextModels.length > 0
      ? formData.availableTextModels
      : ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

  const ttsModelOptions =
    formData.availableTtsModels && formData.availableTtsModels.length > 0
      ? formData.availableTtsModels
      : ['gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-pink-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-600 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                Sara's Study Settings
              </h3>
              <p className="text-xs text-slate-500">
                Personalize your study buddy, curriculum & real models
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* SECTION 1: GEMINI API KEY */}
          <div className="p-4 rounded-2xl bg-pink-50/40 dark:bg-slate-800/40 border border-pink-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-pink-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Google Gemini API Key
                </span>
              </div>
              {formData.apiKey && !isChangingKey && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3" /> Key saved ✓
                </span>
              )}
            </div>

            {formData.apiKey && !isChangingKey ? (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-500">
                  Key is safely active in your browser's local storage.
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsChangingKey(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  >
                    <Edit2 className="w-3 h-3" /> Change
                  </button>
                  <button
                    onClick={() => {
                      onRemoveApiKey();
                      setFormData({ ...formData, apiKey: '' });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <input
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  placeholder="Paste your Google Gemini API key"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Your key stays only in this browser.
                  </span>
                  <div className="flex items-center gap-1">
                    {formData.apiKey && (
                      <button
                        onClick={() => setIsChangingKey(false)}
                        className="px-2.5 py-1 text-xs text-slate-500"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSaveKey}
                      disabled={isValidatingKey || !newKeyInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
                    >
                      {isValidatingKey ? 'Validating...' : 'Save Key'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {keyValidationMsg && (
              <p className="text-[11px] font-medium text-pink-600 dark:text-pink-400">
                {keyValidationMsg}
              </p>
            )}
          </div>

          {/* SECTION 2: AI MODEL SELECTION (DISCOVERED FROM USER KEY) */}
          <div className="p-4 rounded-2xl bg-purple-50/30 dark:bg-slate-800/30 border border-purple-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Active Gemini Models (From Your Key)
                </span>
              </div>
              {formData.apiKey && (
                <button
                  type="button"
                  onClick={handleRefreshModels}
                  disabled={isRefreshingModels}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline"
                  title="Re-query models list from Gemini API"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                  <span>Refresh list</span>
                </button>
              )}
            </div>

            {/* Chat & Vision Flash Model Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Chat, Vision & Whiteboard Model:
              </label>
              <select
                value={formData.textModel}
                onChange={(e) => setFormData({ ...formData, textModel: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono dark:text-white"
              >
                {!textModelOptions.includes(formData.textModel) && (
                  <option value={formData.textModel}>{formData.textModel} (Custom)</option>
                )}
                {textModelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            {/* TTS Speech Generation Model Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Speech Generation (Voice) Model:
              </label>
              <select
                value={formData.ttsModel}
                onChange={(e) => setFormData({ ...formData, ttsModel: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono dark:text-white"
              >
                {!ttsModelOptions.includes(formData.ttsModel) && (
                  <option value={formData.ttsModel}>{formData.ttsModel} (Custom)</option>
                )}
                {ttsModelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SECTION 3: STUDENT ACADEMIC PROFILE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <GraduationCap className="w-4 h-4 text-pink-500" />
              <span>Academic Curriculum & Exam Target</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Class / Level:
                </label>
                <select
                  value={formData.academicLevel}
                  onChange={(e) => setFormData({ ...formData, academicLevel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Class 9">Class 9 (Foundations)</option>
                  <option value="Class 10 (Matric)">Class 10 (Matriculation)</option>
                  <option value="Class 11 (Intermediate)">Class 11 (Intermediate Science/Arts/Commerce)</option>
                  <option value="Class 12 (Intermediate)">Class 12 (Board Intermediate)</option>
                  <option value="Competitive Exam (JEE/NEET)">Competitive Exams (JEE / NEET / NDA)</option>
                  <option value="Middle School (Class 6-8)">Middle School (Class 6–8)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Board / Curriculum:
                </label>
                <select
                  value={formData.boardExam}
                  onChange={(e) => setFormData({ ...formData, boardExam: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Bihar Board (BSEB)">Bihar Board (BSEB & NCERT)</option>
                  <option value="CBSE">CBSE (NCERT)</option>
                  <option value="ICSE / ISC">ICSE / ISC</option>
                  <option value="UP Board">UP Board</option>
                  <option value="State Board">Other State Board</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Preferred Teaching Language:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Hinglish', 'English', 'Hindi'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setFormData({ ...formData, language: lang })}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      formData.language === lang
                        ? 'bg-pink-500 text-white border-pink-500 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {lang === 'Hinglish' ? 'Hinglish (Mix)' : lang}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 4: CUTE VOICE & TTS */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Volume2 className="w-4 h-4 text-pink-500" />
              <span>Sara's Cute Voice & Personality</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Voice Persona:
                </label>
                <select
                  value={formData.voiceName}
                  onChange={(e) => setFormData({ ...formData, voiceName: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Leda">Leda (Youthful, sweet)</option>
                  <option value="Zephyr">Zephyr (Bright, cheerful)</option>
                  <option value="Puck">Puck (Upbeat, lively)</option>
                  <option value="Kore">Kore (Firm, supportive)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Voice Energy:
                </label>
                <select
                  value={formData.voiceEnergy}
                  onChange={(e) => setFormData({ ...formData, voiceEnergy: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Calm">Calm & Gentle</option>
                  <option value="Cheerful">Cheerful & Bubbly</option>
                  <option value="Super bubbly">Super Bubbly & Energetic</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 5: WHITEBOARD THEME & DARK MODE */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Palette className="w-4 h-4 text-pink-500" />
              <span>Whiteboard Surface & Theme</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Whiteboard Paper Style:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cream', name: 'Warm Cream Paper' },
                  { id: 'chalkboard', name: 'Dark Chalkboard' },
                  { id: 'clean', name: 'Clean White' },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, whiteboardTheme: th.id as any })}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                      formData.whiteboardTheme === th.id
                        ? 'bg-pink-500 text-white border-pink-500 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {th.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dark Mode & Speech input lang */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  App Dark Mode:
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, darkMode: !formData.darkMode })}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  {formData.darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mic Speech Lang:
                </span>
                <select
                  value={formData.speechInputLang}
                  onChange={(e) => setFormData({ ...formData, speechInputLang: e.target.value })}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Save Bar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-slate-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-md transition-all"
          >
            Save All Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
