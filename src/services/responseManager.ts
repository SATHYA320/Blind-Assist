import { DetectedObject, SupportedLanguage } from '../types';

export interface AnnouncedObjectMemory {
  name: string;
  color?: string;
  position?: string;
  lastAnnouncedTime: number;
}

export interface AnswerDecision {
  shouldSpeak: boolean;
  speechText: string;
  reason: string;
}

export class ResponseManagerService {
  private recentAnnouncements: Map<string, AnnouncedObjectMemory> = new Map();
  private lastObstacleWarningTime: number = 0;
  private lastObstacleWarningText: string = '';
  private lastQuestionAnswered: string = '';
  private lastAnswerTimestamp: number = 0;

  // Cooldown in ms to prevent repeating the exact same object announcement unsolicited
  private readonly OBJECT_COOLDOWN_MS = 25000;
  // Cooldown in ms to avoid repeating identical obstacle alerts in quick succession
  private readonly OBSTACLE_COOLDOWN_MS = 10000;

  /**
   * Determine whether and how the assistant should vocalize in response to vision data.
   *
   * RULES:
   * 1. If user asked an explicit question (or tapped a specific action like "What color is this?", "What is in front of me?"):
   *    -> ALWAYS answer clearly, concisely, once.
   *    -> Never repeat until asked again.
   *
   * 2. If background surveillance (no direct user question):
   *    -> The assistant MUST REMAIN SILENT by default!
   *    -> ONLY announce when a critical immediate obstacle is directly ahead (< 1.5m) and not recently warned.
   *    -> Avoid announcing "Person detected" repeatedly.
   *    -> When a genuinely new major object appears in front, announce it at most ONCE quietly, then silence.
   */
  public processVisionResponse(params: {
    question?: string;
    mode?: string;
    speech: string;
    answer?: string;
    detectedObjects: DetectedObject[];
    obstacles: string[];
    language: SupportedLanguage;
  }): AnswerDecision {
    const { question, mode, speech, answer, detectedObjects, obstacles, language } = params;
    const now = Date.now();

    // Case 1: Direct user question or explicit command mode (e.g., 'ocr', 'currency', 'medicine', 'qa', or question provided)
    if (question || (mode && mode !== 'auto')) {
      const responseText = (answer || speech || '').trim();
      if (!responseText) {
        return { shouldSpeak: false, speechText: '', reason: 'Empty response' };
      }

      // Check if user just asked the exact same question within 3 seconds
      if (this.lastQuestionAnswered === question && now - this.lastAnswerTimestamp < 3000) {
        return { shouldSpeak: false, speechText: '', reason: 'Duplicate immediate question' };
      }

      this.lastQuestionAnswered = question || '';
      this.lastAnswerTimestamp = now;

      // Update memory for any objects mentioned in the answer
      if (detectedObjects && detectedObjects.length > 0) {
        detectedObjects.forEach((obj) => {
          this.recentAnnouncements.set(obj.name.toLowerCase(), {
            name: obj.name,
            color: obj.color,
            position: obj.position,
            lastAnnouncedTime: now,
          });
        });
      }

      return {
        shouldSpeak: true,
        speechText: responseText,
        reason: 'Direct answer to user question/action',
      };
    }

    // Case 2: Background surveillance (Routine loop)
    // Priority 2A: Urgent obstacles
    if (obstacles && obstacles.length > 0) {
      const obstacleSummary = obstacles[0].trim();
      const isNewObstacle = obstacleSummary !== this.lastObstacleWarningText;
      const cooldownElapsed = now - this.lastObstacleWarningTime > this.OBSTACLE_COOLDOWN_MS;

      if (isNewObstacle || cooldownElapsed) {
        this.lastObstacleWarningText = obstacleSummary;
        this.lastObstacleWarningTime = now;
        return {
          shouldSpeak: true,
          speechText: speech || obstacleSummary,
          reason: 'Critical obstacle alert',
        };
      } else {
        // Suppress repeated obstacle warning
        return { shouldSpeak: false, speechText: '', reason: 'Obstacle already warned recently' };
      }
    }

    // Priority 2B: Unsolicited object announcements in background
    // Requirement: "The assistant must remain silent unless information needs to be provided or the user asks a question."
    // "Avoid repeatedly announcing the same object. When a new object is detected, announce it only once."
    // Filter for brand new prominent objects (confidence > 0.85, close distance < 2.5m) that have never been announced recently
    const newProminentObjects = (detectedObjects || []).filter((obj) => {
      if (obj.confidence < 0.85) return false;
      const key = obj.name.toLowerCase();
      const existing = this.recentAnnouncements.get(key);
      if (!existing) return true;
      return now - existing.lastAnnouncedTime > this.OBJECT_COOLDOWN_MS;
    });

    if (newProminentObjects.length > 0) {
      const topNew = newProminentObjects[0];
      this.recentAnnouncements.set(topNew.name.toLowerCase(), {
        name: topNew.name,
        color: topNew.color,
        position: topNew.position,
        lastAnnouncedTime: now,
      });

      // Craft a single, non-intrusive notification only if prominent and close
      if (topNew.distanceMeters && topNew.distanceMeters <= 2.5) {
        let singleAnnouncement = '';
        if (language === 'ta') {
          singleAnnouncement = `உங்கள் அருகில் ${topNew.name} உள்ளது.`;
        } else if (language === 'hi') {
          singleAnnouncement = `आपके पास ${topNew.name} है।`;
        } else if (language === 'ml') {
          singleAnnouncement = `നിങ്ങളുടെ അരികിൽ ${topNew.name} ഉണ്ട്.`;
        } else if (language === 'te') {
          singleAnnouncement = `మీ దగ్గర ${topNew.name} ఉంది.`;
        } else if (language === 'kn') {
          singleAnnouncement = `ನಿಮ್ಮ ಹತ್ತಿರ ${topNew.name} ಇದೆ.`;
        } else {
          singleAnnouncement = `${topNew.name} detected near you.`;
        }

        return {
          shouldSpeak: true,
          speechText: singleAnnouncement,
          reason: 'New prominent object entered path (announced once)',
        };
      }
    }

    // Remain completely silent otherwise!
    return {
      shouldSpeak: false,
      speechText: '',
      reason: 'Silent background surveillance - waiting for user question',
    };
  }

  /**
   * Resets or clears memory (e.g., when the camera scene shifts completely or user requests)
   */
  public clearMemory() {
    this.recentAnnouncements.clear();
    this.lastObstacleWarningTime = 0;
    this.lastObstacleWarningText = '';
    this.lastQuestionAnswered = '';
    this.lastAnswerTimestamp = 0;
  }
}

export const responseManager = new ResponseManagerService();
