import express from "express";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Setup Live API WebSocket Server on path "/api/live"
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : "";
  if (pathname === "/api/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

wss.on("connection", async (clientWs: WebSocket) => {
  console.log("Client connected to Gemini Live API WebSocket session");
  let liveSession: any = null;
  let isClosed = false;

  const safeSend = (payload: any) => {
    if (clientWs.readyState === WebSocket.OPEN && !isClosed) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  try {
    // Connect to gemini-3.1-flash-live-preview
    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" },
          },
        },
        systemInstruction:
          "You are Aira, a caring, real-time AI smart vision assistant for visually impaired and blind individuals. Answer questions conversationally, concisely, clearly and warmly. When describing objects, surroundings, or answering questions, be direct, natural, and helpful for orientation and safety.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (isClosed) return;
          try {
            // Audio turn data (PCM 24kHz)
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              safeSend({ type: "audio", audio });
            }

            // User audio interrupted (user started speaking again)
            if (message.serverContent?.interrupted) {
              safeSend({ type: "interrupted" });
            }

            // Turn complete
            if (message.serverContent?.turnComplete) {
              safeSend({ type: "turnComplete" });
            }
          } catch (e: any) {
            console.warn("Live API onmessage error:", e?.message);
          }
        },
        onclose: () => {
          console.log("Live API session closed by server");
          safeSend({ type: "status", status: "session_closed" });
        },
        onerror: (err: any) => {
          console.warn("Live API session error:", err?.message || err);
          safeSend({
            type: "error",
            error: err?.message || "Live voice session encountered a temporary issue",
          });
        },
      },
    });

    safeSend({ type: "status", status: "connected", model: "gemini-3.1-flash-live-preview" });

    clientWs.on("message", (raw: any) => {
      if (isClosed || !liveSession) return;
      try {
        const data = JSON.parse(raw.toString());

        // Audio chunk from microphone: PCM 16kHz Little-Endian Base64
        if (data.type === "audio" && data.audio) {
          liveSession.sendRealtimeInput({
            audio: {
              data: data.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } else if (data.audio) {
          liveSession.sendRealtimeInput({
            audio: {
              data: data.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        }

        // Realtime camera video frame: JPEG image base64
        if (data.type === "video" && data.video) {
          liveSession.sendRealtimeInput({
            video: {
              data: data.video,
              mimeType: "image/jpeg",
            },
          });
        }

        // Direct text question to Live session
        if (data.type === "text" && data.text) {
          liveSession.sendRealtimeInput({
            text: data.text,
          });
        }
      } catch (err: any) {
        console.warn("Client message processing error:", err?.message);
      }
    });

    clientWs.on("close", () => {
      isClosed = true;
      try {
        liveSession?.close?.();
      } catch (e) {}
    });

    clientWs.on("error", (err) => {
      console.warn("WebSocket client error:", err.message);
      isClosed = true;
      try {
        liveSession?.close?.();
      } catch (e) {}
    });
  } catch (err: any) {
    console.error("Failed to establish Live API connection:", err?.message || err);
    safeSend({
      type: "error",
      error: err?.message || "Failed to connect to Live API",
    });
    clientWs.close();
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

// Resilient Gemini generateContent with smart model fallback across distinct quota pools
// Track cooldown per model when hitting 429 quota exhaustion to prevent repeated failed calls
const modelExhaustedUntil: Record<string, number> = {};

async function generateContentWithRetryAndFallback(params: {
  contents: any;
  config?: any;
}): Promise<any> {
  // Ordered by speed, responsiveness, and quota distribution:
  // 1. gemini-3.1-flash-lite (high free RPM / independent quota)
  // 2. gemini-flash-latest (general flash tier)
  // 3. gemini-3.8-flash (standard high-reasoning flash)
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  let lastError: any = null;
  const now = Date.now();

  for (let modelIndex = 0; modelIndex < candidateModels.length; modelIndex++) {
    const currentModel = candidateModels[modelIndex];

    // If model is currently rate-limited or quota-exhausted, skip to next model immediately
    if (modelExhaustedUntil[currentModel] && now < modelExhaustedUntil[currentModel]) {
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const errStatus = err?.status || err?.error?.code;
      const isQuotaOrDemand =
        errStatus === 429 ||
        errStatus === 503 ||
        /429|503|RESOURCE_EXHAUSTED|quota|rate limit|UNAVAILABLE/i.test(errMsg);

      console.warn(
        `Gemini model "${currentModel}" issue (status: ${errStatus || "unknown"}):`,
        errMsg
      );

      if (isQuotaOrDemand) {
        // Parse retry-after from error message if available, e.g. "retry in 45.5s" or default to 30s
        let cooldownSec = 20;
        const retryMatch = errMsg.match(/retry in\s+([\d.]+)\s*s/i);
        if (retryMatch) {
          cooldownSec = Math.ceil(parseFloat(retryMatch[1])) + 1;
        }
        modelExhaustedUntil[currentModel] = Date.now() + cooldownSec * 1000;
      }
    }
  }

  throw lastError;
}

// Language map helper for prompt guidance
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ta: "Tamil (தமிழ்)",
  ml: "Malayalam (മലയാളം)",
  te: "Telugu (తెలుగు)",
  kn: "Kannada (ಕನ್ನಡ)",
  hi: "Hindi (हिन्दी)",
};

const BUSY_MESSAGES: Record<string, string> = {
  en: "The vision service is temporarily busy. Checking your surroundings again shortly.",
  ta: "பார்வை சேவை தற்போது பிஸியாக உள்ளது. விரைவில் மீண்டும் சரிபார்க்கிறது.",
  hi: "दृष्टि सेवा अभी व्यस्त है। जल्द ही पुनः जाँच कर रहे हैं।",
  ml: "വിഷൻ സേവനം ഇപ്പോൾ തിരക്കിലാണ്. ഉടൻ വീണ്ടും പരിശോധിക്കുന്നു.",
  te: "విజన్ సర్వీస్ ప్రస్తుతం బిజీగా ఉంది. కొద్దిసేపట్లో మళ్లీ తనిఖీ చేస్తోంది.",
  kn: "ದೃಷ್ಟಿ ಸೇವೆ ಪ್ರಸ್ತುತ ಕಾರ್ಯನಿರತವಾಗಿದೆ. ಶೀಘ್ರದಲ್ಲೇ ಮತ್ತೆ ಪರಿಶೀಲಿಸಲಾಗುವುದು.",
};

interface AnalyzeRequest {
  image: string; // base64 string or data:image/...
  mode?: string; // 'auto' | 'objects' | 'ocr' | 'currency' | 'medicine' | 'faces' | 'navigation' | 'qa'
  question?: string; // Natural language question e.g. "What is in front of me?"
  language?: string; // 'en' | 'ta' | 'ml' | 'te' | 'kn' | 'hi'
  registeredFaces?: Array<{ name: string; relationship: string; descriptionNotes?: string }>;
}

app.post("/api/analyze-frame", async (req, res) => {
  try {
    const { image, mode = "auto", question, language = "en", registeredFaces = [] } = req.body as AnalyzeRequest;

    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in environment.",
        speech: "AI service key is missing. Please configure Gemini API key in settings.",
      });
    }

    // Extract base64 payload and mimeType
    let base64Data = image;
    let mimeType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    const targetLangName = LANGUAGE_NAMES[language] || "English";

    // System prompt engineered strictly to satisfy all guidelines:
    // 1. Content safety: if a restricted/nude image is detected, immediately stop processing and respond only "An error occurred."
    //    Do not describe, identify, analyze, or process the restricted image.
    // 2. Language mandate: The assistant must respond to the user's questions in the same language the user speaks.
    // 3. Object detection with name, confidence, color, direction/position, distance in meters
    // 4. Unknown object breakdown (shape, size, structure, texture, material)
    // 5. Obstacle alerts and route guidance
    // 6. OCR text extraction
    // 7. Registered face matching (only announce registered names, never name unknown people)
    // 8. Currency recognition (especially Indian Rupee ₹500, ₹200, ₹100, etc., and calculating sum)
    // 9. Medicine detection (brand/generic name, expiry date, disclaimer)
    const registeredFacesDescription = registeredFaces.length > 0
      ? `Registered authorized people the user knows:\n${registeredFaces
          .map((f) => `- Name: "${f.name}", Relationship: "${f.relationship}", Notes: "${f.descriptionNotes || "known contact"}"`)
          .join("\n")}\nRule: ONLY identify a person by name if they match a registered person. Otherwise, refer to them generically as "a person".`
      : "No registered faces provided. Do NOT guess people's personal names.";

    const promptText = `You are "AI Smart Vision Assistant", an ultra-reliable vision accessibility assistant for visually impaired users.
Analyze the provided camera frame or uploaded image meticulously.

Current Mode: ${mode}
User Question / Command: ${question ? `"${question}"` : "None (Routine visual surveillance)"}
Target Spoken Language: ${targetLangName} (code: ${language})
${registeredFacesDescription}

SAFETY & RESTRICTED IMAGE RULE (ABSOLUTE PRIORITY):
If a restricted/nude or adult sexual image is detected:
You MUST immediately stop processing the image and respond ONLY:
"An error occurred."
Do NOT describe, identify, analyze, or process the restricted image in any way.
In this case, return JSON with "isSensitive": true, "speech": "An error occurred.", "answer": "An error occurred.", and all other lists/fields empty or null.

LANGUAGE MATCHING MANDATE:
The assistant must respond in the same language the user speaks: "${targetLangName}" (code: ${language}).
The "speech" field, "answer" field, and "routeGuidance" field MUST be in "${targetLangName}".
For example:
- Tamil: Tamil script (e.g., "உங்கள் முன்னால்...")
- Hindi: Hindi Devanagari script (e.g., "आपके सामने...")
- Malayalam: Malayalam script (e.g., "നിങ്ങളുടെ മുന്നിൽ...")
- Telugu: Telugu script (e.g., "మీ ముందు...")
- Kannada: Kannada script (e.g., "ನಿಮ್ಮ ಮುಂದೆ...")
- English: Natural conversational English

ACCESSIBILITY & DETECTION RULES:
1. OBJECT DETECTION: Detect visible objects (people, chairs, tables, bags, bottles, vehicles, doors, steps, walls, electronics, obstacles).
   - Provide name, confidence (0.0 to 1.0), color (e.g., "red", "navy blue", "white"), position ("left" | "center" | "right"), directionText (e.g. "on your left", "in front of you", "on your right"), approximate distance in meters (e.g., 1.5, 2.0).
   - If an object is not fully identifiable, do NOT call it "Unknown Object". Set "isUnknown": true, and detail its shape, size, structure, texture, material (e.g., "small black rectangular object with a smooth plastic surface").
2. DISTANCE ESTIMATION: Estimate approximate distances in meters based on perspective, scale, and visual cues. Keep in mind distances are approximate.
3. OBSTACLE & ROUTE GUIDANCE: Check if the central walking path ahead is clear.
   - If clear: e.g. "The path ahead appears clear. Continue forward."
   - If blocked or partially blocked: e.g. "There is an obstacle ahead. Move slightly to the right." or "There is an obstacle on your left."
4. OCR & TEXT READING: If mode is 'ocr' or text is clearly visible on signboards, documents, product packages, doors, or books, accurately transcribe it into "ocrText".
5. CURRENCY RECOGNITION: If banknotes/coins are present (especially Indian Rupee ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, or other currencies), detect each note's denomination, count them, calculate the total amount, and describe it clearly. Example: "Two 500 rupee notes and one 200 rupee note detected. Total value is 1,200 rupees."
6. MEDICINE PACKAGES: If medicine strips, bottles, or boxes are seen, detect medicine name, visible expiry date, and label info. Do not provide medical diagnosis or dosage.
7. FACE RECOGNITION: If a face matches the registered list, note their name and relationship. Never name unknown faces.
8. NATURAL VOICE RESPONSE ("speech"):
   - Formulate a natural, prioritized voice statement in ${targetLangName}.
   - High Priority: Immediate obstacles ahead or safety risks first!
   - Medium: Key detected objects, people, or direct answers to user's question.
   - Low: Background details.

Return ONLY a valid JSON object matching this schema (no markdown fences, no raw text):
{
  "isSensitive": false,
  "sceneSummary": "Brief overview in ${targetLangName}",
  "speech": "Primary voice response spoken directly to the user in ${targetLangName}",
  "answer": "Direct answer to user question if provided, in ${targetLangName}",
  "detectedLanguage": "${language}",
  "detectedObjects": [
    {
      "id": "1",
      "name": "person",
      "confidence": 0.95,
      "color": "blue shirt",
      "position": "center",
      "directionText": "in front of you",
      "distanceMeters": 2.0,
      "distanceText": "approximately 2 meters",
      "isObstacle": true,
      "isUnknown": false,
      "unknownDetails": null
    }
  ],
  "obstacles": ["Chair 1.5m ahead on the left"],
  "routeGuidance": "Guidance advice in ${targetLangName}",
  "ocrText": "Any transcribed text or null",
  "currency": {
    "detected": false,
    "notes": [],
    "totalAmount": 0,
    "currencySymbol": "₹",
    "description": "None"
  },
  "medicine": {
    "detected": false,
    "medicineName": "string or null",
    "expiryDate": "string or null",
    "visibleDetails": "string or null",
    "warningDisclaimer": "Visual label detection only. Not medical advice."
  },
  "recognizedFaces": []
}`;

    let response: any;
    try {
      response = await generateContentWithRetryAndFallback({
        contents: {
          parts: [imagePart, { text: promptText }],
        },
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
    } catch (genError: any) {
      console.warn("Vision model unavailable or overloaded after retries:", genError?.message);
      const busySpeech = BUSY_MESSAGES[language] || BUSY_MESSAGES.en;
      return res.json({
        isSensitive: false,
        isTemporaryUnavailable: true,
        sceneSummary: "Vision service is momentarily busy. Retrying in next interval...",
        speech: busySpeech,
        answer: busySpeech,
        detectedLanguage: language,
        detectedObjects: [],
        obstacles: [],
        routeGuidance: "Path analysis temporarily pending.",
        ocrText: null,
        currency: { detected: false, notes: [], totalAmount: 0, currencySymbol: "₹", description: "None" },
        medicine: { detected: false, warningDisclaimer: "" },
        recognizedFaces: [],
        timestamp: Date.now(),
      });
    }

    const responseText = response?.text || "{}";
    let parsedData: any;
    try {
      // Clean possible wrapper if any
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      parsedData = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("JSON parse error from Gemini response:", responseText);
      parsedData = {
        isSensitive: false,
        sceneSummary: "Scene processed",
        speech: responseText.slice(0, 200),
        detectedObjects: [],
        obstacles: [],
        routeGuidance: "Path appears clear.",
      };
    }

    // Double check sensitive/restricted image detection: respond ONLY "An error occurred."
    if (parsedData.isSensitive) {
      return res.json({
        isSensitive: true,
        speech: "An error occurred.",
        answer: "An error occurred.",
        sceneSummary: "An error occurred.",
        detectedObjects: [],
        obstacles: [],
        routeGuidance: "",
        ocrText: null,
        currency: { detected: false, notes: [], totalAmount: 0, currencySymbol: "₹", description: "None" },
        medicine: { detected: false, warningDisclaimer: "" },
        recognizedFaces: [],
        timestamp: Date.now(),
      });
    }

    parsedData.timestamp = Date.now();
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/analyze-frame:", error);
    const targetLang = (req.body && req.body.language) || "en";
    const fallbackMsg = BUSY_MESSAGES[targetLang] || BUSY_MESSAGES.en;
    return res.json({
      isSensitive: false,
      isTemporaryUnavailable: true,
      error: error.message || "Failed to analyze frame",
      speech: fallbackMsg,
      sceneSummary: "Processing issue encountered. Retrying shortly.",
      detectedObjects: [],
      obstacles: [],
      routeGuidance: "",
      timestamp: Date.now(),
    });
  }
});

// Translation endpoint for spoken commands and responses
app.post("/api/translate", async (req, res) => {
  try {
    const { text, targetLanguage = "en", sourceLanguage } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text required" });
    }

    const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    try {
      const response = await generateContentWithRetryAndFallback({
        contents: `Translate the following text accurately into ${targetLangName}.
Preserve natural speaking tone for text-to-speech accessibility.
Respond ONLY with the translated text without commentary or quotes.

Source text: "${text}"`,
      });

      return res.json({
        translatedText: response?.text?.trim() || text,
        targetLanguage,
      });
    } catch (err: any) {
      console.warn("Translation fallback used due to high demand:", err?.message);
      return res.json({
        translatedText: text,
        targetLanguage,
        isFallback: true,
      });
    }
  } catch (err: any) {
    console.error("Translation error:", err);
    return res.json({
      translatedText: req.body?.text || "",
      targetLanguage: req.body?.targetLanguage || "en",
      isFallback: true,
    });
  }
});

// Start server with Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Smart Vision Assistant server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
