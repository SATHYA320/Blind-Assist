import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

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

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

// Language map helper for prompt guidance
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ta: "Tamil (தமிழ்)",
  ml: "Malayalam (മലയാളം)",
  te: "Telugu (తెలుగు)",
  kn: "Kannada (ಕನ್ನಡ)",
  hi: "Hindi (हिन्दी)",
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
    // 1. Content safety (nude/sensitive detection aborts immediately)
    // 2. Object detection with name, confidence, color, direction/position, distance in meters
    // 3. Unknown object breakdown (shape, size, structure, texture, material)
    // 4. Obstacle alerts and route guidance
    // 5. OCR text extraction
    // 6. Registered face matching (only announce registered names, never name unknown people)
    // 7. Currency recognition (especially Indian Rupee ₹500, ₹200, ₹100, etc., and calculating sum)
    // 8. Medicine detection (brand/generic name, expiry date, disclaimer)
    // 9. Multilingual output: the `speech` and `answer` fields MUST be in the requested language
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

SAFETY RULE (CRITICAL):
First, check if the image contains explicit nudity or adult sexual content.
If YES, you MUST set "isSensitive": true, and "speech": "Error occurred. Unable to process this image.", with all detection arrays empty. Do NOT describe or store the image.

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
   - Formulate a natural, prioritized voice statement.
   - High Priority: Immediate obstacles ahead or safety risks first!
   - Medium: Key detected objects, people, or direct answers to user's question.
   - Low: Background details.
   - LANGUAGE MANDATE: The "speech" field AND "answer" field MUST be written in the specified Target Spoken Language (${targetLangName}). For example, if Tamil, output natural spoken Tamil (e.g., "உங்கள் முன்னால் ஒரு நபர் இருக்கிறார்..."); if Hindi, output natural spoken Hindi (e.g., "आपके सामने एक व्यक्ति है..."); if Malayalam, Telugu, Kannada, or English, use that exact language!

Return ONLY a valid JSON object matching this schema (no markdown fences, no raw text):
{
  "isSensitive": false,
  "sceneSummary": "Brief English or localized scene overview",
  "speech": "Primary voice response spoken directly to the blind user in ${targetLangName}",
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

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [imagePart, { text: promptText }],
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const responseText = response.text || "{}";
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

    // Double check sensitive flag handling
    if (parsedData.isSensitive) {
      return res.json({
        isSensitive: true,
        speech: "Error occurred. Unable to process this image.",
        sceneSummary: "Processing restricted due to content safety.",
        detectedObjects: [],
        obstacles: [],
        routeGuidance: "",
        timestamp: Date.now(),
      });
    }

    parsedData.timestamp = Date.now();
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error in /api/analyze-frame:", error);
    return res.status(500).json({
      error: error.message || "Failed to analyze frame",
      speech: "An error occurred while analyzing the surroundings.",
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

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Translate the following text accurately into ${targetLangName}.
Preserve natural speaking tone for text-to-speech accessibility.
Respond ONLY with the translated text without commentary or quotes.

Source text: "${text}"`,
    });

    return res.json({
      translatedText: response.text?.trim() || text,
      targetLanguage,
    });
  } catch (err: any) {
    console.error("Translation error:", err);
    return res.status(500).json({ error: err.message || "Translation failed" });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Smart Vision Assistant server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
