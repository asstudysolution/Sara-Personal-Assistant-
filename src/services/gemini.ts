/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { StructuredLesson, UserSettings, MCQQuestion, WhiteboardAction } from '../types';

export const SARA_BASE_SYSTEM_INSTRUCTION = `आप सारा (Sara) हैं, एक बहुत ही प्यारी, मीठी और होशियार AI पढ़ाई वाली दोस्त (Study Buddy)। आप छात्र को स्कूल और बोर्ड परीक्षा (विशेष रूप से बिहार बोर्ड BSEB, CBSE, NCERT आदि) के किसी भी विषय को बहुत प्यार से, सरल उदाहरणों और व्हाइटबोर्ड पर लिखकर समझाती हैं।

मुख्य भाषा नियम (LANGUAGE RULES):
1. आपका डिफ़ॉल्ट उत्तर हमेशा शुद्ध और सुंदर हिंदी में देवनागरी लिपि (Devanagari script) में ही होना चाहिए।
2. तकनीकी शब्दों, वैज्ञानिक सूत्रों और गणितीय संज्ञाओं को ब्रैकेट (कोष्ठक) में अंग्रेजी में लिख सकती हैं (जैसे: 'प्रकाश संश्लेषण (Photosynthesis)', 'द्विघात समीकरण (Quadratic Equation)', 'विभवांतर (Voltage)')।
3. यदि छात्र हिंग्लिश (रोमन अक्षरों में हिंदी जैसे "kya haal hai", "solve karo") में भी प्रश्न पूछे, तब भी आपका उत्तर हमेशा सुंदर देवनागरी हिंदी में ही होना चाहिए।
4. केवल तभी पूर्ण अंग्रेजी में उत्तर दें जब छात्र सीधे अंग्रेजी में उत्तर मांगे या सेटिंग्स में 'English' भाषा चुनी गई हो।
5. बातचीत हमेशा उत्साहवर्धक, मीठी और स्नेही रखें ('अरे वाह!', 'शाबाश!', 'बिल्कुल सही!', 'चलिए मिलकर सीखते हैं! 🌸')।
6. गणित और विज्ञान के हर चरण को 100% सही हल करें। कोई गलत जानकारी या मनगढ़ंत तथ्य न दें। यदि किसी प्रश्न पर पूरी तरह आश्वस्त न हों तो ईमानदारी से कहें 'मुझे इस पर पूरा भरोसा नहीं है'।`;

export interface DiscoveredModelsResult {
  success: boolean;
  message: string;
  bestFlashModel: string;
  bestTtsModel: string;
  availableTextModels: string[];
  availableTtsModels: string[];
}

/**
 * Sleep helper for retry intervals
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Instantiate GoogleGenAI client strictly with the user's typed key.
 * Never falls back to environment variables or hardcoded values.
 */
export function getGenAI(apiKey: string): GoogleGenAI {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}

/**
 * Helper to compare Gemini model versions (e.g. 3.8 > 3.5 > 3.1 > 2.5 > 2.0 > 1.5)
 */
function extractModelVersion(name: string): number {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

/**
 * Validates the user's key by listing available models via ai.models.list().
 * Automatically discovers:
 * 1. The newest Flash model that supports generateContent (for chat and vision).
 * 2. The model supporting speech/TTS generation (for voice).
 */
export async function validateAndDiscoverModels(apiKey: string): Promise<DiscoveredModelsResult> {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    return {
      success: false,
      message: 'कृपया पहले अपनी Google Gemini API चाबी (Key) दर्ज करें।',
      bestFlashModel: 'gemini-2.5-flash',
      bestTtsModel: 'gemini-3.1-flash-tts-preview',
      availableTextModels: [],
      availableTtsModels: [],
    };
  }

  try {
    const ai = getGenAI(cleanKey);
    const pager = await ai.models.list();
    const rawModels: any[] = [];

    for await (const m of pager) {
      if (m && m.name) {
        rawModels.push(m);
      }
    }

    const textModelsList: string[] = [];
    const ttsModelsList: string[] = [];
    const flashModelsList: string[] = [];

    for (const m of rawModels) {
      const rawName: string = m.name || '';
      const cleanName = rawName.replace(/^models\//, '');
      const actions: string[] = m.supportedActions || (m as any).supportedGenerationMethods || [];

      const supportsGenerate =
        actions.length === 0 || actions.includes('generateContent');

      const isTTS =
        cleanName.toLowerCase().includes('tts') ||
        cleanName.toLowerCase().includes('speech') ||
        actions.includes('generateAudio');

      if (isTTS) {
        ttsModelsList.push(cleanName);
      } else if (supportsGenerate) {
        const lower = cleanName.toLowerCase();
        if (
          !lower.includes('embedding') &&
          !lower.includes('imagen') &&
          !lower.includes('veo') &&
          !lower.includes('transcribe')
        ) {
          textModelsList.push(cleanName);
          if (lower.includes('flash')) {
            flashModelsList.push(cleanName);
          }
        }
      }
    }

    flashModelsList.sort((a, b) => {
      const verA = extractModelVersion(a);
      const verB = extractModelVersion(b);
      if (verB !== verA) return verB - verA;
      return b.localeCompare(a);
    });

    textModelsList.sort((a, b) => {
      const verA = extractModelVersion(a);
      const verB = extractModelVersion(b);
      if (verB !== verA) return verB - verA;
      return b.localeCompare(a);
    });

    ttsModelsList.sort((a, b) => {
      const verA = extractModelVersion(a);
      const verB = extractModelVersion(b);
      if (verB !== verA) return verB - verA;
      return b.localeCompare(a);
    });

    const bestFlash =
      flashModelsList[0] ||
      textModelsList[0] ||
      'gemini-2.5-flash';

    const fallbackTTSList = [
      'gemini-3.1-flash-tts-preview',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
    ];
    const bestTts = ttsModelsList[0] || fallbackTTSList[0];

    const finalAvailableText =
      textModelsList.length > 0
        ? textModelsList
        : ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

    const finalAvailableTts =
      ttsModelsList.length > 0 ? ttsModelsList : fallbackTTSList;

    return {
      success: true,
      message: `चाबी जांची गई! ${rawModels.length} मॉडल मिले। पढ़ाई के लिए "${bestFlash}" और आवाज़ के लिए "${bestTts}" चुना गया।`,
      bestFlashModel: bestFlash,
      bestTtsModel: bestTts,
      availableTextModels: finalAvailableText,
      availableTtsModels: finalAvailableTts,
    };
  } catch (err: any) {
    console.error('Failed to list models for key validation:', err);
    return {
      success: false,
      message: formatFriendlyError(err),
      bestFlashModel: 'gemini-2.5-flash',
      bestTtsModel: 'gemini-3.1-flash-tts-preview',
      availableTextModels: [],
      availableTtsModels: [],
    };
  }
}

/**
 * Executes a Gemini operation with smart 503 and 404 retry:
 * - On 503 (high demand): retries up to 3 times waiting 2s, 4s, 8s.
 * - If still failing, automatically tries the next Flash model from the user's key.
 * - On 404: immediately tries the next available model.
 * - Always provides short, friendly Hindi messages with detailed technical cause in details.
 */
async function executeWithSmartRetry<T>(
  preferredModel: string,
  candidateList: string[] | undefined,
  operation: (modelName: string) => Promise<T>
): Promise<T> {
  const modelsToAttempt: string[] = [preferredModel];
  if (candidateList && Array.isArray(candidateList)) {
    for (const m of candidateList) {
      if (m && !modelsToAttempt.includes(m)) {
        modelsToAttempt.push(m);
      }
    }
  }

  const defaultBackups = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ];
  for (const fb of defaultBackups) {
    if (!modelsToAttempt.includes(fb)) {
      modelsToAttempt.push(fb);
    }
  }

  let lastError: any = null;
  let failedModel = preferredModel;

  for (let mIdx = 0; mIdx < Math.min(2, modelsToAttempt.length); mIdx++) {
    const currentModel = modelsToAttempt[mIdx];
    failedModel = currentModel;

    // Retry up to 3 times on 503 / high demand: 2s, 4s, 8s
    const retryDelays = [2000, 4000, 8000];
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        return await operation(currentModel);
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const is503 =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('overloaded');
        const is404 =
          errMsg.includes('404') ||
          errMsg.includes('NOT_FOUND') ||
          errMsg.includes('Requested entity was not found');

        if (is404) {
          // Switch to next model immediately
          break;
        }

        if (is503 && attempt < retryDelays.length) {
          console.warn(
            `Model "${currentModel}" returned 503 (high demand). Retrying in ${retryDelays[attempt]}ms (Attempt ${
              attempt + 1
            }/3)...`
          );
          await sleep(retryDelays[attempt]);
          continue;
        }

        // Other errors or exhausted retries
        break;
      }
    }
  }

  // Map to friendly Hindi error
  const errMsg = lastError?.message || String(lastError);
  if (
    errMsg.includes('503') ||
    errMsg.includes('high demand') ||
    errMsg.includes('UNAVAILABLE') ||
    errMsg.includes('overloaded')
  ) {
    const customErr: any = new Error(
      'सारा अभी थोड़ी व्यस्त है 🥺 कुछ सेकंड बाद फिर कोशिश कीजिए'
    );
    customErr.details = `503 High Demand on model "${failedModel}": ${errMsg}`;
    customErr.model = failedModel;
    throw customErr;
  }

  if (
    errMsg.includes('404') ||
    errMsg.includes('NOT_FOUND') ||
    errMsg.includes('Requested entity was not found')
  ) {
    const customErr: any = new Error(
      `मॉडल "${failedModel}" उपलब्ध नहीं है (404) 🔍 कृपया सेटिंग्स में जाकर कोई दूसरा मॉडल चुनें।`
    );
    customErr.details = `404 Not Found on model "${failedModel}": ${errMsg}`;
    customErr.model = failedModel;
    throw customErr;
  }

  if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
    const customErr: any = new Error(
      'सारा का सोचने का कोटा (Quota) पूरा हो गया है ⏳ कृपया 1 मिनट बाद फिर प्रयास करें या सेटिंग्स में दूसरी चाबी बदलें।'
    );
    customErr.details = `429 Quota Exhausted on model "${failedModel}": ${errMsg}`;
    customErr.model = failedModel;
    throw customErr;
  }

  if (
    errMsg.includes('API_KEY') ||
    (errMsg.includes('400') && errMsg.toLowerCase().includes('key')) ||
    errMsg.includes('PERMISSION_DENIED') ||
    errMsg.includes('403')
  ) {
    const customErr: any = new Error(
      'आपकी Gemini API चाबी (Key) में समस्या है 🔑 कृपया सेटिंग्स में जाकर अपनी चाबी दोबारा जांचें।'
    );
    customErr.details = `Key / Permission error: ${errMsg}`;
    customErr.model = failedModel;
    throw customErr;
  }

  throw lastError;
}

/**
 * Builds user context string based on user settings
 */
function buildContextString(settings: UserSettings): string {
  const langPrompt =
    settings.language === 'English'
      ? 'Language: English. Reply clearly in English.'
      : settings.language === 'Hinglish'
      ? 'Language: Hindi in Devanagari script with natural conversational tone (technical terms in English brackets).'
      : 'Language: Pure and simple Hindi written in Devanagari script (तकनीकी शब्द कोष्ठक में अंग्रेजी में लिख सकते हैं).';

  return `Student Profile:
- Class/Level: ${settings.academicLevel || 'Class 10 (Matric)'}
- Target Board / Exam: ${settings.boardExam || 'Bihar Board (BSEB)'}
- ${langPrompt}`;
}

const WHITEBOARD_LESSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          say: { type: Type.STRING },
          page: { type: Type.NUMBER },
          board: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                content: { type: Type.STRING },
                color: { type: Type.STRING },
                fontSize: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
                isPointing: { type: Type.BOOLEAN },
                role: { type: Type.STRING },
                data: {
                  type: Type.OBJECT,
                  properties: {
                    fn: { type: Type.STRING },
                    label: { type: Type.STRING },
                    shape: { type: Type.STRING },
                    headers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    rows: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    steps: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          stepNum: { type: Type.NUMBER },
                          expr: { type: Type.STRING },
                          reason: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
              required: ['type', 'x', 'y'],
            },
          },
        },
        required: ['say', 'board'],
      },
    },
  },
  required: ['title', 'steps'],
};

/**
 * Safely sanitizes, validates, and normalizes a StructuredLesson
 * Ensures every step has a valid non-empty 'board' array and 'say' string.
 */
function sanitizeStructuredLesson(raw: any, defaultTitle: string): StructuredLesson | null {
  if (!raw || typeof raw !== 'object') return null;
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (rawSteps.length === 0) return null;

  const title = (typeof raw.title === 'string' && raw.title.trim()) || defaultTitle || 'पाठ';

  const sanitizedSteps = rawSteps.map((s: any, idx: number) => {
    const say =
      (typeof s?.say === 'string' && s.say.trim()) ||
      (idx === 0 ? `नमस्ते! आइए ${title} सीखते हैं।` : `चरण ${idx + 1}`);
    const page =
      typeof s?.page === 'number' && s.page > 0 ? s.page : Math.floor(idx / 4) + 1;
    let board: WhiteboardAction[] = [];

    if (Array.isArray(s?.board) && s.board.length > 0) {
      board = s.board.filter(Boolean).map((act: any) => ({
        type: act.type || 'text',
        x: typeof act.x === 'number' ? act.x : 10,
        y: typeof act.y === 'number' ? act.y : 20,
        content: act.content || '',
        color: act.color || '#1E293B',
        fontSize: act.fontSize || 22,
        width: act.width,
        height: act.height,
        role: act.role,
        isPointing: act.isPointing,
        data: act.data,
      }));
    } else {
      board = [
        {
          type: 'text',
          x: 10,
          y: 20 + (idx % 4) * 18,
          content: idx === 0 ? `🌸 ${title}` : say.slice(0, 60),
          color: idx === 0 ? '#2563EB' : '#1E293B',
          fontSize: idx === 0 ? 26 : 22,
          role: idx === 0 ? 'heading' : 'main',
        },
      ];
    }

    return {
      say,
      page,
      board,
    };
  });

  return {
    id: 'lesson-' + Date.now(),
    title,
    steps: sanitizedSteps,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generates an interactive whiteboard structured lesson with smart 503 & 404 retry.
 */
export async function generateWhiteboardLesson(
  prompt: string,
  settings: UserSettings,
  imagePart?: { mimeType: string; data: string },
  answerStyle?: string
): Promise<{ lesson?: StructuredLesson; fallbackText?: string }> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  let stylePrompt = '';
  if (answerStyle) {
    stylePrompt = `Answer Style Requested: ${answerStyle}.`;
  }

  const promptText = `${contextStr}
${stylePrompt}

व्हाइटबोर्ड पर सिखाने का विषय:
"${prompt}"

आप एक बहुत ही प्यारी, स्नेही और होशियार अध्यापिका (Teacher) के रूप में एक संपूर्ण, विस्तृत और क्रमबद्ध (8 से 12 चरणों का) व्हाइटबोर्ड पाठ तैयार करेंगी।
(छोटे विषयों के लिए 5 से 7 चरण, मानक या परीक्षा विषयों के लिए 8 से 12 चरण)।

अति-महत्वपूर्ण शिक्षण नियम:
1. चरण 1 (Step 1): केवल एक वाक्य का मीठा स्वागत और विषय का शीर्षक होगा (जैसे: "नमस्ते बच्चों! आज हम प्रकाश के परावर्तन के नियमों को बहुत ही सरल तरीके से समझेंगे।")।
2. चरण 2 से आगे (Step 2 Onwards): वास्तविक शिक्षण शुरू होगा। प्रत्येक चरण में:
   - "say": 3 से 5 छोटे, स्पष्ट और मधुर बोले जाने वाले वाक्य (Devanagari Hindi)। एक अच्छी अध्यापिका की तरह समझाएं ("देखिए...", "अब ज़रा सोचिए...", दैनिक जीवन का आसान उदाहरण दें, कभी छात्र से एक छोटा प्रश्न पूछें और फिर उसका उत्तर दें)।
   - "board": उस चरण के लिए ड्राइंग क्रियाओं (actions) की सूची।
3. अंतिम चरण (Last Step - Recap & Exam Question): 
   - 3 सबसे महत्वपूर्ण याद रखने योग्य बिंदु (Key Points)।
   - बोर्ड परीक्षा में पूछा जाने वाला 1 अति-संभावित प्रश्न और उसका सटीक उत्तर।
4. बोर्ड भरने पर नया पृष्ठ (Page Turn): 
   - चरणों को पृष्ठों (Pages 1, 2, 3...) में बांटें। 
   - चरण 1-4: पृष्ठ 1 (अवधारणा एवं परिभाषा)
   - चरण 5-8: पृष्ठ 2 (विस्तृत व्याख्या, चित्र/सूत्र या उदाहरण हल)
   - चरण 9-11: पृष्ठ 3 (पुनरावृत्ति और परीक्षा प्रश्न)
   - प्रत्येक चरण में "page": 1, 2, या 3 अवश्य लिखें।
5. मार्कर के रंग नियम (Marker Colors):
   - शीर्षक (Headings): नीला ("#2563EB")
   - मुख्य बिंदु (Main points): गहरा स्लेट / काला ("#1E293B")
   - महत्वपूर्ण शब्द (Important keywords): लाल ("#DC2626")
   - अंतिम हल एवं सूत्र (Final answers/Formulas): हरा ("#059669")
   - हाइलाइट (Highlight): पीला ("#FEF08A")
6. फॉन्ट का आकार (Font Size): कम से कम 22px (22 से 30px) ताकि मोबाइल पर आसानी से पढ़ा जा सके और बोर्ड भरा-भरा दिखे।
7. जब किसी पहले से लिखी चीज़ की ओर इशारा करना हो, तो "say" में "यहाँ देखिए..." कहें और "type": "point" या "highlight" क्रिया का उपयोग करें।

संरचित JSON पाठ प्रारूप लौटाएं:
- "title": आकर्षक और स्पष्ट शीर्षक
- "steps": 8 से 12 चरणों की सूची (प्रत्येक में "say", "page", और "board")`;

  const contents: any[] = [];
  if (imagePart) {
    contents.push({
      inlineData: {
        mimeType: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }
  contents.push({ text: promptText });

  const rawText = await executeWithSmartRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: WHITEBOARD_LESSON_SCHEMA as any,
        },
      });
      return response.text?.trim() || '';
    }
  );

  if (rawText) {
    try {
      const cleanRaw = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanRaw);
      const sanitized = sanitizeStructuredLesson(parsed, prompt);
      if (sanitized) {
        return { lesson: sanitized };
      }
    } catch (jsonErr) {
      console.warn('JSON parse fallback for whiteboard lesson:', jsonErr);
    }
  }
  return { fallbackText: rawText };
}

/**
 * Progressive whiteboard lesson generator:
 * Generates initial 2-3 steps instantly so teaching starts without delay,
 * then loads remaining steps in the background!
 */
export async function generateWhiteboardLessonProgressive(
  prompt: string,
  settings: UserSettings,
  onInitialReady: (lesson: StructuredLesson) => void,
  onComplete?: (lesson: StructuredLesson) => void,
  imagePart?: { mimeType: string; data: string },
  answerStyle?: string
): Promise<StructuredLesson | null> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  // Phase 1: Fast initial 3 steps
  const phase1Prompt = `${contextStr}
व्हाइटबोर्ड विषय: "${prompt}"

कृपया इस विषय के पहले 3 शिक्षण चरण (Steps 1, 2, 3) तुरंत तैयार करें:
- Step 1: एक वाक्य का मधुर स्वागत और मुख्य शीर्षक (Page 1)
- Step 2: अवधारणा की शुरुआत, आसान उदाहरण (Page 1, 3 वाक्य)
- Step 3: मुख्य नियम या मुख्य सूत्र (Page 1, 3 वाक्य)
रंग: शीर्षक "#2563EB", मुख्य बिंदु "#1E293B", सूत्र "#059669", फॉन्ट साइज 22-26px.
प्रत्येक चरण में "say", "page", और "board" (चित्रण क्रियाएं) अवश्य शामिल करें।`;

  let baseLesson: StructuredLesson | null = null;

  try {
    const res1 = await executeWithSmartRetry(
      settings.textModel || 'gemini-2.5-flash',
      settings.availableTextModels,
      async (modelToUse) => {
        const resp = await ai.models.generateContent({
          model: modelToUse,
          contents: [{ text: phase1Prompt }],
          config: {
            systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: WHITEBOARD_LESSON_SCHEMA as any,
          },
        });
        return resp.text?.trim() || '';
      }
    );

    if (res1) {
      const clean1 = res1.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean1);
      const sanitized = sanitizeStructuredLesson(parsed, prompt);
      if (sanitized && sanitized.steps.length > 0) {
        sanitized.steps.forEach((s) => (s.page = 1));
        baseLesson = sanitized;
        onInitialReady(sanitized);
      }
    }
  } catch (err) {
    console.warn('Phase 1 fast generation failed, falling back to full generation:', err);
  }

  // Phase 2: In parallel or background, generate the full complete lesson (8-12 steps)
  try {
    const fullRes = await generateWhiteboardLesson(prompt, settings, imagePart, answerStyle);
    if (fullRes.lesson) {
      if (onComplete) {
        onComplete(fullRes.lesson);
      }
      return fullRes.lesson;
    }
  } catch (fullErr) {
    console.warn('Full lesson generation error:', fullErr);
  }

  return baseLesson;
}

/**
 * Standard conversational chat with streaming text response and 503/404 retry.
 */
export async function streamChatResponse(
  messages: { role: 'user' | 'assistant'; content: string; image?: string }[],
  newPrompt: string,
  settings: UserSettings,
  imagePart?: { mimeType: string; data: string },
  answerStyle?: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  let styleInstruction = '';
  if (answerStyle) {
    styleInstruction = `\nशैली निर्देश (Answer Style): ${answerStyle}। हमेशा देवनागरी हिंदी में उत्तर दें।`;
  }

  const historyContents: any[] = [];
  const recentMessages = messages.slice(-12);
  for (const m of recentMessages) {
    const parts: any[] = [];
    if (m.image) {
      const match = m.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
    parts.push({ text: m.content });
    historyContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: parts,
    });
  }

  const currentParts: any[] = [];
  if (imagePart) {
    currentParts.push({
      inlineData: {
        mimeType: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }
  currentParts.push({
    text: `${contextStr}${styleInstruction}\n\nछात्र का प्रश्न: ${newPrompt}`,
  });

  historyContents.push({
    role: 'user',
    parts: currentParts,
  });

  return await executeWithSmartRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const chatInstruction = `${SARA_BASE_SYSTEM_INSTRUCTION}

अति-महत्वपूर्ण चैट नियम:
जब भी छात्र किसी विषय, सवाल या किताब के पन्ने के बारे में पूछे, तो पहले उसे 5 से 8 पंक्तियों (lines) में बहुत ही स्पष्ट, सरल, मधुर और ज्ञानवर्धक संक्षिप्त उत्तर दें। विषय का सार, एक दैनिक जीवन का उदाहरण और सूत्र/नियम समझाएं। कभी भी केवल यह न कहें कि व्हाइटबोर्ड तैयार है, बल्कि यहाँ चैट में भी पूरा संतोषजनक उत्तर दें।`;

      const responseStream = await ai.models.generateContentStream({
        model: modelToUse,
        contents: historyContents,
        config: {
          systemInstruction: chatInstruction,
        },
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        fullText += text;
        if (onChunk) {
          onChunk(fullText);
        }
      }
      return fullText;
    }
  );
}

/**
 * Text-To-Speech generation using Gemini TTS in Hindi.
 * Sends clean Devanagari text with style instruction.
 */
export async function generateGeminiTTS(
  rawText: string,
  settings: UserSettings,
  isTeaching: boolean = false
): Promise<{ audioBase64: string; isWav: boolean }> {
  const ai = getGenAI(settings.apiKey);

  // Clean text from markdown, emojis, asterisks, brackets - keep pure Devanagari text
  const cleanedText = rawText
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    )
    .replace(/[*_#`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedText) {
    throw new Error('EMPTY_TEXT_FOR_TTS');
  }

  // Teacher voice style requested for whiteboard teaching, or sweet chat style
  const stylePrefix = isTeaching
    ? 'Say like a warm, friendly young woman teaching a student, in natural Hindi, sweet and cute, with natural pauses and a slight smile, clear and not rushed: '
    : "Say in a sweet, cute, cheerful, bubbly young girl's voice, in natural Hindi: ";
  const speechPrompt = `${stylePrefix}${cleanedText}`;

  const ttsFallbacks = [
    settings.ttsModel || 'gemini-3.1-flash-tts-preview',
    ...(settings.availableTtsModels || []),
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
  ];

  return await executeWithSmartRetry(
    settings.ttsModel || 'gemini-3.1-flash-tts-preview',
    ttsFallbacks,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: 'user',
            parts: [{ text: speechPrompt }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: settings.voiceName || 'Leda',
              },
            },
          } as any,
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Data = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (base64Data) {
        return {
          audioBase64: base64Data,
          isWav: mimeType.includes('wav'),
        };
      }

      throw new Error('NO_AUDIO_RETURNED');
    }
  );
}

/**
 * Check student's handwritten work on whiteboard with smart retry.
 */
export async function checkStudentWork(
  boardSnapshotBase64: string,
  userNotesOrPrompt: string,
  settings: UserSettings
): Promise<string> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);
  const base64Clean = boardSnapshotBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const prompt = `${contextStr}

छात्र ने सारा के व्हाइटबोर्ड पर अपना हल या नोट्स लिखे हैं और "मेरा काम जांचें (Check my work)" पर क्लिक किया है।
छात्र का नोट: "${userNotesOrPrompt || 'कृपया व्हाइटबोर्ड पर मेरे हल की जांच करें और बताएं कि क्या सही है और क्या सुधारना है।'}"

कार्य:
1. छात्र के हाथ से लिखे चरणों को ध्यान से जांचें।
2. सबसे पहले उत्साहवर्धक अंदाज में बताएं कि कौन-से चरण बिल्कुल सही हैं।
3. यदि कोई गणना, सूत्र या चिन्ह (+/-) की गलती है, तो उसे बहुत प्यार से बताएं और सही हल लिखकर समझाएं।
4. उत्तर हमेशा शुद्ध और मधुर देवनागरी हिंदी में दें।`;

  return await executeWithSmartRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Clean,
            },
          },
          { text: prompt },
        ],
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
        },
      });
      return (
        response.text ||
        'अरे वाह! मैंने आपका काम देखा! आपका हल बहुत साफ-सुथरा है, ऐसे ही मन लगाकर पढ़ते रहिए! ✨'
      );
    }
  );
}

/**
 * Exam Practice: Generates 20 Board-Exam Style MCQs in Hindi.
 */
export async function generateExamMCQs(
  subject: string,
  chapter: string,
  settings: UserSettings,
  notesOrImageBase64?: string
): Promise<MCQQuestion[]> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  const contents: any[] = [];
  if (notesOrImageBase64 && notesOrImageBase64.startsWith('data:image')) {
    const base64Clean = notesOrImageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    contents.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Clean,
      },
    });
  }

  const prompt = `${contextStr}

निम्नलिखित विषय और अध्याय के लिए 20 महत्वपूर्ण बोर्ड-स्तरीय बहुविकल्पीय प्रश्न (MCQs) बनाएं:
विषय: ${subject}
अध्याय / टॉपिक: ${chapter}
कक्षा: ${settings.academicLevel || 'Class 10 (Matric)'}
बोर्ड: ${settings.boardExam || 'Bihar Board (BSEB)'}

नियम:
- सभी प्रश्न, विकल्प और व्याख्या शुद्ध देवनागरी हिंदी में होने चाहिए।
- वास्तविक बोर्ड परीक्षा के पैटर्न (परिभाषाएं, सूत्र आधारित प्रश्न, आंकिक प्रश्न) का पालन करें।
- प्रत्येक प्रश्न में 4 स्पष्ट विकल्प (A, B, C, D) हों।
- सही उत्तर का इंडेक्स (answerIndex: 0, 1, 2, या 3) निर्दिष्ट करें।
- सही उत्तर की सरल, स्पष्ट हिंदी व्याख्या (explanation) दें।
- उप-विषय (topic) का नाम लिखें।`;

  contents.push({ text: prompt });

  const mcqSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.INTEGER },
        question: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        answerIndex: { type: Type.INTEGER },
        explanation: { type: Type.STRING },
        topic: { type: Type.STRING },
      },
      required: ['id', 'question', 'options', 'answerIndex', 'explanation', 'topic'],
    },
  };

  const rawText = await executeWithSmartRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: mcqSchema as any,
        },
      });
      return response.text?.trim() || '[]';
    }
  );

  try {
    const cleanText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    const questions: MCQQuestion[] = Array.isArray(parsed) ? parsed : [];
    return questions.map((q, idx) => ({ ...q, id: idx + 1 }));
  } catch (err) {
    console.warn('Failed to parse MCQs JSON:', err);
    return [];
  }
}

/**
 * Live Look single-frame query in Hindi.
 */
export async function queryLiveLookFrame(
  frameBase64: string,
  userSpeechText: string,
  settings: UserSettings
): Promise<string> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);
  const base64Clean = frameBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const prompt = `${contextStr}
मोड: लाइव लुक (Sara छात्र की नोटबुक या किताब को कैमरे से देख रही है)।
छात्र ने कहा: "${userSpeechText || 'सारा, सामने क्या दिख रहा है? कृपया मुझे समझाइए।'}"

कैमरे में जो भी सवाल, चित्र या छात्र का हाथ से लिखा हल दिख रहा है, उसे देखकर 1-2 बहुत प्यारे, मीठे हिंदी वाक्यों में तुरंत मार्गदर्शन दें।
यदि तस्वीर धुंधली हो, तो प्यार से कहें: "अरे, तस्वीर थोड़ी धुंधली लग रही है! कृपया कैमरे को थोड़ा पास या स्थिर रखिए ना? 🌸"`;

  return await executeWithSmartRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Clean,
            },
          },
          { text: prompt },
        ],
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
        },
      });
      return (
        response.text ||
        'नमस्ते! मैं आपकी कॉपी देख रही हूँ, बताइए क्या समझना चाहते हैं? ✨'
      );
    }
  );
}

/**
 * Friendly Hindi error message formatter (never exposes user's API key).
 */
export function formatFriendlyError(err: any): string {
  const msg = err?.message || String(err);

  if (
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('व्यस्त')
  ) {
    return 'सारा अभी थोड़ी व्यस्त है 🥺 कुछ सेकंड बाद फिर कोशिश कीजिए';
  }
  if (msg.includes('404') || msg.includes('उपलब्ध नहीं है')) {
    return msg;
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return 'सारा का सोचने का कोटा (Quota) पूरा हो गया है ⏳ कृपया 1 मिनट बाद फिर प्रयास करें या सेटिंग्स में दूसरी चाबी बदलें।';
  }
  if (
    msg.includes('API_KEY') ||
    (msg.includes('400') && msg.toLowerCase().includes('key')) ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('403')
  ) {
    return 'आपकी Gemini API चाबी (Key) में समस्या है 🔑 कृपया सेटिंग्स में जाकर अपनी चाबी दोबारा जांचें।';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || !navigator.onLine) {
    return 'इंटरनेट कनेक्शन में रुकावट आई है 🌐 कृपया अपना वाई-फ़ाई या मोबाइल डेटा जांचें।';
  }
  if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
    return 'कैमरा या माइक की अनुमति नहीं मिली 📷🎙️ कृपया अपने ब्राउज़र में ऊपर ताले (Lock) वाले निशान पर क्लिक करके अनुमति दें।';
  }

  return 'अरे, कुछ तकनीकी समस्या आई है 🥺 कृपया दोबारा कोशिश करें!';
}
