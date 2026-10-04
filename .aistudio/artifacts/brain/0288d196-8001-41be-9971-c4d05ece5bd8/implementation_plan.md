# Sara — Cute AI Study-Buddy & Live Whiteboard Teacher

Sara is a mobile-first, anime-inspired AI study-buddy web application designed to help students master any academic or competitive exam topic. Sara teaches step-by-step through speech, real-time camera inspection, and an animated live whiteboard that draws mathematical formulas, geometry diagrams, graphs, and structured notes like a real tutor.

***

### User Review & Critical Decisions

> [!IMPORTANT]
> The following product configurations have been confirmed based on user preferences and requirements:

- **Confirmed Curriculum & Academic Target**: Configured for **Bihar Board (BSEB Matric / Inter & NCERT)** with deep coverage for Class 9–12 subjects (Maths, Science/Physics/Chemistry/Biology, Social Science, English, Hindi, Computer) plus competitive exams.
- **Confirmed Language & Voice Persona**: Defaulting to **Hinglish** (warm conversational blend of Hindi & English) paired with **Gemini TTS Voice 'Leda'** at a Cheerful/Bubbly energy level.
- **Confirmed Whiteboard Aesthetic**: **Warm cream study paper** canvas (`#FFFDF7` / `#FAF6EB` grid) accented by soft pastel colored pens (Heading Coral, Working Cyan/Indigo, Highlight Honey, Answer Emerald).
- **Gemini SDK In-Browser Architecture**: As explicitly specified, Sara uses `@google/genai` directly in the browser with the user's saved Gemini API Key in `localStorage`. The key is never displayed again after saving, never committed to source, and can be changed or removed at any time in Settings.

***

## 1. Overview & Core Concept

- **What It Does**: Sara provides an interactive, multimodal tutoring environment where students can:
  1. Ask questions via text, voice recognition, camera snapshot, or uploaded photos/PDFs.
  2. Watch Sara write, diagram, and illustrate explanations line-by-line on an animated SVG/Canvas whiteboard while synchronously speaking the lesson.
  3. Draw on the board themselves and click "Check my work" to receive instant step-by-step verification.
  4. Launch **Live Look** mode to have a continuous, hands-free video and voice dialogue while solving problems on paper.
  5. Enter **Exam Practice** mode to generate 20 board-style MCQs with timers, instant scoring, whiteboard error reviews, and weak-topic tracking.
- **Target Audience**: Students preparing for school board examinations (CBSE, BSEB, ICSE, State Boards) and competitive entrance tests who need clear, patient, stigma-free guidance.
- **Key Value**: Replaces passive reading with interactive, visual, and verbal instruction tailored to the student's exact syllabus and language comfort.

***

## 2. User Experience & Visual Design

### Key User Flows
1. **Onboarding / Key Setup**:
   - Zero-state presents a pastel welcome card introducing Sara with a password-masked input: *"Paste your Google Gemini API key"*, a clear privacy guarantee (*"Your key stays only in this browser"*), and instant validation.
   - Upon saving, the interface transitions smoothly into Sara's Study Room without ever displaying the raw key again.
2. **Main Study Room & Whiteboard Interaction**:
   - The top navigation bar showcases the brand **"Sara"** with active status indicators (Idle, Thinking, Speaking, Sleepy) and quick access to Settings, Exam Practice, and Notes.
   - The center stage houses the responsive whiteboard with real-time animated stroke rendering, formula layout, and coordinate-aware diagramming.
   - Sara's animated avatar sits affectionately in the corner, with expressive eyes, blushing cheeks, floating ambient motion, and real-time lip-sync tied to audio analysis.
   - Below the board, quick-action chips allow single-tap tone switching: *"Explain simply"*, *"Explain in detail"*, *"Exam answer (points to write)"*, *"Quick revision"*, *"Quiz me (MCQs)"*, and *"Why did I get this wrong?"*.
3. **Camera & Multimodal Analysis**:
   - Tapping the Camera button activates a full-duplex live camera preview with front/back camera toggling and an unmissable *"Camera is on"* indicator.
   - The user taps *"Capture & Ask"* to snapshot textbook questions or handwritten math solutions. Sara inspects image clarity and either prompts for a clearer retake or breaks down the solution on the whiteboard.
4. **Live Look Mode**:
   - Streaming camera frames (1 FPS) combined with microphone audio provide continuous real-time guidance as the student writes equations or conducts experiments on paper.
5. **Exam Practice Mode**:
   - The user selects a subject and chapter (or takes a photo of notes). Sara generates 20 timed MCQs aligned with board exam marking schemes, computes final scores, breaks down mistakes on the whiteboard, and logs weak chapters to `localStorage`.

### Visual Identity & Theme
- **Color Palette**:
  - Background Atmosphere: Soft warm parchment cream (`#FAF7F0`) in light mode; velvety night slate (`#1A1B26`) in dark mode.
  - Whiteboard Surface: Warm cream notebook paper (`#FFFDF8`) with subtle dot-grid ruling (`#E8E3D7`).
  - Sara's Aesthetic Accents: Sakura pastel pink (`#FFB7B2`), gentle lavender (`#E2D4F0`), mint teal (`#A8E6CF`), and warm honey (`#FFD3B6`).
  - Pen Palettes: Heading Mulberry (`#883997`), Step Slate/Indigo (`#2B4C7E`), Accent Coral (`#E05D5D`), Answer Emerald (`#2E7D32`).
- **Typography & Handwriting**:
  - UI Display & Body: Friendly, rounded geometric sans (`Quicksand` / `Nunito`).
  - Whiteboard Text & Formulas: Authentic handwritten script font (`Caveat` / `Kalam`) combined with crisp serif math symbols.
- **Character Animation States**:
  - **Idle**: Gentle breathing float, natural double-blink cycles.
  - **Listening**: Head tilted curiously with attentive sparkle highlights.
  - **Thinking**: Hand to chin, swirling pastel particles.
  - **Talking**: Dynamic mouth shape and amplitude driven by Web Audio `AnalyserNode`.
  - **Happy**: Bouncy bobbing animation with floating heart and star particles.
  - **Sleepy**: After 60 seconds of inactivity, Sara rests her head with floating "Zzz" bubbles, waking up instantly upon interaction.

***

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Browser SDK `@google/genai` Execution**
  - *Chosen Approach*: The user's saved API key executes Gemini models directly within browser runtime using `new GoogleGenAI({ apiKey })`.
  - *Why*: User explicitly requested: *"Use the official @google/genai SDK in the browser... Save the key in localStorage and use it for ALL Gemini calls. Never hardcode a key or use a built-in one."*
  - *Trade-off*: Direct client-side calls require clear guidance to the user that their key stays exclusively in local browser storage and is never uploaded to any intermediary backend.
- **Decision 2: Dual-Pass Whiteboard Generation & Streaming Fallback**
  - *Chosen Approach*: When Sara explains complex concepts, she requests structured JSON with `{ title, steps: [ { say, board: [ actions ] } ] }`. While loading, she provides initial conversational feedback, and if JSON validation fails, seamlessly defaults to rich streaming markdown so learning is never interrupted.
  - *Why*: Ensures strict layout reliability without leaving the user stranded if complex mathematical schemas hit formatting anomalies.
- **Decision 3: Web Audio API PCM Decoding with SpeechSynthesis Fallback**
  - *Chosen Approach*: Unary & streaming TTS calls from Gemini audio models (`gemini-3.1-flash-tts-preview` or `gemini-3.8-flash-lite-tts`) return base64 raw 24kHz PCM / WAV. We process this through an `AudioContext`, connecting to an `AnalyserNode` for avatar mouth animation. If quota or network limits occur, we gracefully switch to browser `speechSynthesis` with elevated pitch.
  - *Why*: Delivers an ultra-cute anime voice while ensuring 100% voice reliability even under offline or low-quota conditions.
- **Decision 4: Geometry, Function Graphs, and Math Layout Stacking**
  - *Chosen Approach*: Built-in procedural rendering engine for Cartesian graphs ($f(x)$, quadratic curves, trigonometric waves), geometric triangles/circles with angle arc annotations, and automatic line-height collision detection to prevent text overlaps.
  - *Why*: Essential for secondary school (Matric) and intermediate physics, trigonometry, and calculus.

***

## 4. Technical Architecture & Data Strategy

### System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Sara Study Room (App)                            │
├──────────────────────────────────────┬──────────────────────────────────────┤
│               Header Bar             │       Avatar Component (Sara)        │
│ • Title "Sara" & Theme Toggle        │ • SVG Anime Vector Rig (Idle/Sleepy) │
│ • Settings Modal & Key Status        │ • AnalyserNode Lip-Sync / Particles  │
├──────────────────────────────────────┴──────────────────────────────────────┤
│                         Interactive Whiteboard Stage                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ • Procedural Vector Canvas (Handwriting, Graphs, Formulas, Shapes)       │ │
│ │ • Step Player (Play/Pause, Step ±1, Speed 0.75x–1.5x, Audio Sync)       │ │
│ │ • Student Drawing Tools (Pen, Color, Eraser, Undo, Clear)               │ │
│ │ • "Check My Work" Snapshot & "Download Board Image"                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Learning & Chat Deck                               │
│ • Answer Style Toggles (Explain Simply, Exam Points, Revision, Quiz)        │
│ • Chat History (20-message memory window, markdown rendering)               │
│ • Quick Actions: "Live Look", "Exam Practice", "My Saved Notes"             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Input & Multimodal Bar                              │
│ • Speech Recognition Mic (EN-IN, HI, EN-US)                                 │
│ • Live Camera Stream & Capture Modal (Front/Back switch, 1 FPS Live Look)   │
│ • Document / Gallery Upload (Images, PDF snapshot)                          │
│ • Prompt Textarea with Auto-Grow & Send Button                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Sara Gemini Service (@google/genai)                      │
│ ┌──────────────────────────┐ ┌────────────────────────┐ ┌─────────────────┐ │
│ │  Text & Vision Engine    │ │   Gemini TTS Engine    │ │ Live Look Stream│ │
│ │  (gemini-2.5/3.5-flash)  │ │ (gemini-3.1-flash-tts) │ │ (WebSocket/Web) │ │
│ └──────────────────────────┘ └────────────────────────┘ └─────────────────┘ │
│                     ▲                                                       │
│                     │ Storage: localStorage                                 │
│        [API Key, Settings, Saved Notes, Weak Topics]                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Data Models

```typescript
// Whiteboard Lesson Schema
interface WhiteboardAction {
  type: 'text' | 'formula' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'table' | 'label' | 'highlight' | 'underline' | 'clear' | 'graph' | 'geometry';
  x: number; // 0-100%
  y: number; // 0-100%
  content?: string;
  color?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  data?: any; // e.g. function expression, angle marks, table rows
}

interface WhiteboardStep {
  say: string;
  board: WhiteboardAction[];
}

interface StructuredLesson {
  title: string;
  steps: WhiteboardStep[];
}

// User Profile & Settings
interface UserSettings {
  apiKey: string;
  academicLevel: string; // e.g., "Class 10 (Bihar Board)"
  boardExam: string; // "Bihar Board (BSEB)"
  language: 'Hinglish' | 'English' | 'Hindi';
  textModel: string; // default: "gemini-2.5-flash"
  ttsModel: string; // default: "gemini-3.1-flash-tts-preview"
  voiceName: 'Leda' | 'Zephyr' | 'Puck' | 'Kore';
  voiceEnergy: 'Calm' | 'Cheerful' | 'Super bubbly';
  whiteboardTheme: 'cream' | 'chalkboard' | 'clean';
}
```

### Planned Verification & Testing
1. **Compilation Check**: Run `compile_applet` to confirm strict TypeScript compliance, Vite bundling, and valid imports.
2. **Audio & Lip-Sync Test**: Validate Web Audio context creation, PCM decoding, AnalyserNode frequency mapping, and fallback to `speechSynthesis`.
3. **Whiteboard Math & Geometry Test**: Verify function graph rendering, step-by-step math vertical alignment, and collision-free line stacking.
4. **Multimodal Flow Test**: Test camera capture, image downsampling to base64, file attachment handling, and error states (empty key, network drop, camera permission denied).
