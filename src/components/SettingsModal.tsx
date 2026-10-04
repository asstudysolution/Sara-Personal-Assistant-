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
  Languages,
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
      setKeyValidationMsg(discovery.message);
      setTimeout(() => setKeyValidationMsg(null), 3500);
    } else {
      setKeyValidationMsg(discovery.message);
    }
  };

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
      setKeyValidationMsg(`मॉडल सूची अपडेट हो गई! ${discovery.availableTextModels.length} मॉडल मिले।`);
      setTimeout(() => setKeyValidationMsg(null), 3000);
    } else {
      setKeyValidationMsg(discovery.message);
    }
  };

  const handleSaveAll = () => {
    onSaveSettings(formData);
    onClose();
  };

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
                सारा की पढ़ाई सेटिंग्स (Settings)
              </h3>
              <p className="text-xs text-slate-500">
                भाषा, बोर्ड, आवाज़ और मॉडल विकल्प
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
                  Google Gemini API चाबी (Key)
                </span>
              </div>
              {formData.apiKey && !isChangingKey && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3" /> चाबी सुरक्षित है ✓
                </span>
              )}
            </div>

            {formData.apiKey && !isChangingKey ? (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-slate-500">
                  आपकी चाबी केवल इसी ब्राउज़र में सुरक्षित रखी गई है।
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsChangingKey(true)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  >
                    <Edit2 className="w-3 h-3" /> बदलें
                  </button>
                  <button
                    onClick={() => {
                      onRemoveApiKey();
                      setFormData({ ...formData, apiKey: '' });
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                  >
                    <Trash2 className="w-3 h-3" /> हटाएं
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <input
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  placeholder="अपनी Google Gemini API चाबी यहाँ पेस्ट करें"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-pink-300 dark:text-white"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    आपकी चाबी केवल इसी ब्राउज़र में रहती है।
                  </span>
                  <div className="flex items-center gap-1">
                    {formData.apiKey && (
                      <button
                        onClick={() => setIsChangingKey(false)}
                        className="px-2.5 py-1 text-xs text-slate-500"
                      >
                        रद्द करें
                      </button>
                    )}
                    <button
                      onClick={handleSaveKey}
                      disabled={isValidatingKey || !newKeyInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
                    >
                      {isValidatingKey ? 'जांच जारी...' : 'चाबी सहेजें'}
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

          {/* SECTION 2: LANGUAGE SELECTION (हिंदी FIRST) */}
          <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-slate-800/40 border border-amber-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Languages className="w-4 h-4 text-amber-600" />
              <span>पढ़ाने की मुख्य भाषा (Language)</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'Hindi', label: 'हिंदी (डिफ़ॉल्ट)' },
                { id: 'Hinglish', label: 'Hinglish' },
                { id: 'English', label: 'English' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, language: lang.id as any })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    formData.language === lang.id
                      ? 'bg-pink-500 text-white border-pink-500 shadow-2xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              हिंदी में सारा हमेशा साफ़ देवनागरी लिपि में उत्तर देगी (तकनीकी शब्द कोष्ठक में अंग्रेजी में रहेंगे)।
            </p>
          </div>

          {/* SECTION 3: AI MODEL SELECTION */}
          <div className="p-4 rounded-2xl bg-purple-50/30 dark:bg-slate-800/30 border border-purple-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  सक्रिय Gemini मॉडल (आपकी चाबी से)
                </span>
              </div>
              {formData.apiKey && (
                <button
                  type="button"
                  onClick={handleRefreshModels}
                  disabled={isRefreshingModels}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline"
                  title="मॉडल सूची फिर से प्राप्त करें"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                  <span>रिफ्रेश करें</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                चैट, कैमरा और व्हाइटबोर्ड मॉडल:
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

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                आवाज़ (TTS) मॉडल:
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

          {/* SECTION 4: STUDENT ACADEMIC PROFILE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <GraduationCap className="w-4 h-4 text-pink-500" />
              <span>कक्षा और परीक्षा बोर्ड (Curriculum)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  कक्षा / स्तर:
                </label>
                <select
                  value={formData.academicLevel}
                  onChange={(e) => setFormData({ ...formData, academicLevel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Class 10 (Matric)">कक्षा 10 (मैट्रिक - BSEB / CBSE)</option>
                  <option value="Class 12 (Intermediate)">कक्षा 12 (इंटरमीडिएट - BSEB / CBSE)</option>
                  <option value="Class 9">कक्षा 9 (Class 9)</option>
                  <option value="Class 11 (Intermediate)">कक्षा 11 (Class 11)</option>
                  <option value="Competitive Exam (JEE/NEET)">प्रतियोगी परीक्षा (JEE / NEET / NDA)</option>
                  <option value="Middle School (Class 6-8)">मिडिल स्कूल (कक्षा 6–8)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  बोर्ड / पाठ्यक्रम:
                </label>
                <select
                  value={formData.boardExam}
                  onChange={(e) => setFormData({ ...formData, boardExam: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Bihar Board (BSEB)">बिहार बोर्ड (BSEB & NCERT)</option>
                  <option value="CBSE">CBSE (NCERT)</option>
                  <option value="ICSE / ISC">ICSE / ISC</option>
                  <option value="UP Board">यूपी बोर्ड (UP Board)</option>
                  <option value="State Board">अन्य राज्य बोर्ड</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 5: CUTE VOICE & TTS */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Volume2 className="w-4 h-4 text-pink-500" />
              <span>सारा की प्यारी आवाज़ और ऊर्जा</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  आवाज़ का चरित्र:
                </label>
                <select
                  value={formData.voiceName}
                  onChange={(e) => setFormData({ ...formData, voiceName: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Leda">Leda (युवा, प्यारी - डिफ़ॉल्ट)</option>
                  <option value="Zephyr">Zephyr (उत्साही, स्पष्ट)</option>
                  <option value="Puck">Puck (चुलबुली, तेज़)</option>
                  <option value="Kore">Kore (गंभीर, शिक्षक)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  आवाज़ की ऊर्जा:
                </label>
                <select
                  value={formData.voiceEnergy}
                  onChange={(e) => setFormData({ ...formData, voiceEnergy: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="Cheerful">उत्साही और प्यारी (Cheerful)</option>
                  <option value="Calm">शांत और सौम्य (Calm)</option>
                  <option value="Super bubbly">अति-ऊर्जावान (Super Bubbly)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 6: WHITEBOARD THEME & DARK MODE */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Palette className="w-4 h-4 text-pink-500" />
              <span>व्हाइटबोर्ड और थीम</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                व्हाइटबोर्ड कागज़ का प्रकार:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cream', name: 'हल्का क्रीम कागज़' },
                  { id: 'chalkboard', name: 'क्लासरूम चॉकबोर्ड' },
                  { id: 'clean', name: 'साफ़ सफ़ेद बोर्ड' },
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

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  डार्क मोड (Dark Mode):
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
                  माइक भाषा:
                </span>
                <select
                  value={formData.speechInputLang}
                  onChange={(e) => setFormData({ ...formData, speechInputLang: e.target.value })}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium dark:text-white"
                >
                  <option value="hi-IN">हिंदी (भारत - डिफ़ॉल्ट)</option>
                  <option value="en-IN">English (India)</option>
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
            रद्द करें
          </button>
          <button
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-md transition-all"
          >
            सभी सेटिंग्स सहेजें
          </button>
        </div>
      </div>
    </div>
  );
};
