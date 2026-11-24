import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getCliPort(): number | undefined {
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && process.argv[idx + 1]) {
    const parsed = Number(process.argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

const PORT =
  getCliPort() ||
  Number(process.env.DEFAULT_APP_PORT) ||
  (process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT
    ? 3000
    : Number(process.env.PORT) || 3000);

const ALLOWED_CATEGORIES = new Set([
  'Deep Work',
  'Engineering',
  'Design',
  'Writing',
  'Health',
]);

const ALLOWED_PRIORITIES = new Set(['critical', 'focus', 'routine']);

type AiModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

const DEFAULT_AI_MODEL: AiModelId = 'gemini-4-hydrogen';
const ALLOWED_AI_MODELS = new Set<AiModelId>([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);
const FALLBACK_MODEL_MAP: Record<AiModelId, AiModelId> = {
  'gemini-4-hydrogen': 'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite': 'gemini-4-hydrogen',
};

function normalizeAiModel(raw: unknown): AiModelId {
  if (typeof raw === 'string' && ALLOWED_AI_MODELS.has(raw as AiModelId)) {
    return raw as AiModelId;
  }
  return DEFAULT_AI_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRawAiError(err: unknown): {
  status: number;
  statusText: string;
  rawMessage: string;
} {
  const errObj = err as { status?: number; code?: number; message?: string };
  let status =
    typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.code === 'number'
        ? errObj.code
        : 500;
  let statusText = '';
  let rawMessage = err instanceof Error ? err.message : String(err || 'Unknown AI error');

  const trimmed = rawMessage.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') status = parsed.error.code;
        if (typeof parsed.error.status === 'string') statusText = parsed.error.status;
        if (typeof parsed.error.message === 'string' && parsed.error.message.trim()) {
          rawMessage = parsed.error.message.trim();
        }
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  return { status, statusText, rawMessage };
}

function isRetryableDemandError(err: unknown): boolean {
  const { status, statusText, rawMessage } = parseRawAiError(err);
  const lower = `${statusText} ${rawMessage}`.toLowerCase();
  return (
    status === 503 ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  );
}

function formatAiErrorResponse(
  err: unknown,
  modelUsed: AiModelId,
  fallbackMessage: string
): { status: number; message: string } {
  const { status, statusText, rawMessage } = parseRawAiError(err);
  const lower = `${statusText} ${rawMessage}`.toLowerCase();

  if (status === 503 || lower.includes('unavailable') || lower.includes('high demand')) {
    const alternate =
      modelUsed === 'gemini-4-hydrogen' ? 'Gemini 3.1 Flash Lite' : 'Gemini 4 Hydrogen';
    return {
      status: 503,
      message: `${modelUsed} is temporarily experiencing high demand (503). Switch to ${alternate} in Experience or retry shortly.`,
    };
  }
  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'AI rate limit reached (429). Please wait a moment and try again.',
    };
  }
  if (status === 403 || lower.includes('permission_denied')) {
    return {
      status: 403,
      message: 'AI service permission error (403). Check your Gemini API key configuration.',
    };
  }
  if (status === 400 || lower.includes('invalid_argument')) {
    return {
      status: 400,
      message: rawMessage || 'Invalid AI request payload (400).',
    };
  }
  if (status === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      message: `Model "${modelUsed}" was not found. Select another model in Experience.`,
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage || fallbackMessage,
  };
}

async function generateContentWithResilience(params: {
  ai: Awaited<ReturnType<typeof getAiClient>>['ai'];
  requestedModel: AiModelId;
  autoFallback: boolean;
  contents: string;
  config: Record<string, unknown>;
}): Promise<{
  response: { text?: string };
  modelUsed: AiModelId;
  fallbackUsed: boolean;
}> {
  const { ai, requestedModel, autoFallback, contents, config } = params;

  try {
    const response = await ai.models.generateContent({
      model: requestedModel,
      contents,
      config,
    });
    return { response, modelUsed: requestedModel, fallbackUsed: false };
  } catch (firstErr) {
    if (!isRetryableDemandError(firstErr)) {
      throw firstErr;
    }

    // Brief backoff retry on the user's chosen model for transient 503 spikes
    await sleep(500);
    try {
      const retryResponse = await ai.models.generateContent({
        model: requestedModel,
        contents,
        config,
      });
      return { response: retryResponse, modelUsed: requestedModel, fallbackUsed: false };
    } catch (secondErr) {
      if (!autoFallback || !isRetryableDemandError(secondErr)) {
        throw secondErr;
      }

      const fallbackModel = FALLBACK_MODEL_MAP[requestedModel];
      const fallbackResponse = await ai.models.generateContent({
        model: fallbackModel,
        contents,
        config,
      });
      return {
        response: fallbackResponse,
        modelUsed: fallbackModel,
        fallbackUsed: true,
      };
    }
  }
}

let genaiModulePromise: Promise<typeof import('@google/genai')> | null = null;

async function getGenAiSdk() {
  if (!genaiModulePromise) {
    genaiModulePromise = import('@google/genai');
  }
  return genaiModulePromise;
}

async function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Check your Settings > Secrets panel.'
    );
  }
  const { GoogleGenAI, ThinkingLevel, Type } = await getGenAiSdk();
  return {
    ai: new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    }),
    ThinkingLevel,
    Type,
  };
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function normalizeCategory(raw: unknown): 'Deep Work' | 'Engineering' | 'Design' | 'Writing' | 'Health' {
  if (typeof raw === 'string' && ALLOWED_CATEGORIES.has(raw)) {
    return raw as 'Deep Work' | 'Engineering' | 'Design' | 'Writing' | 'Health';
  }
  return 'Deep Work';
}

function normalizePriority(raw: unknown): 'critical' | 'focus' | 'routine' {
  if (typeof raw === 'string' && ALLOWED_PRIORITIES.has(raw)) {
    return raw as 'critical' | 'focus' | 'routine';
  }
  return 'focus';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/ai/suggest-quests', async (req, res) => {
    const requestedModel = normalizeAiModel(req.body?.model);
    const autoFallback = req.body?.autoFallback !== false;
    try {
      const {
        mode,
        inputText,
        profile,
        activeQuestTitles,
        bossTitle,
        parentQuestId,
        completedQuestTitle,
        outcomeText,
        references,
      } = req.body ?? {};
      const { ai, ThinkingLevel, Type } = await getAiClient();

      const playerName =
        typeof profile?.playerName === 'string' && profile.playerName.trim()
          ? profile.playerName.trim()
          : 'Player';
      const playerRole =
        typeof profile?.playerRole === 'string' && profile.playerRole.trim()
          ? profile.playerRole.trim()
          : 'Product Builder';
      const focusGoal = clampInt(profile?.dailyFocusGoalMinutes, 15, 480, 90);
      const existingTitles = Array.isArray(activeQuestTitles)
        ? activeQuestTitles.filter((t): t is string => typeof t === 'string').slice(0, 12)
        : [];
      const userPrompt = typeof inputText === 'string' ? inputText.trim() : '';
      const cleanCompletedTitle =
        typeof completedQuestTitle === 'string' ? completedQuestTitle.trim() : '';
      const cleanOutcome =
        typeof outcomeText === 'string' ? outcomeText.trim() : '';
      const cleanRefs = Array.isArray(references)
        ? references
            .filter(
              (r): r is { label?: string; location?: string } =>
                Boolean(r && typeof r === 'object')
            )
            .slice(0, 8)
            .map((r) => `${r.label || 'Location'}: ${r.location || ''}`)
            .filter(Boolean)
        : [];

      const isFollowUpMode = mode === 'followups' && cleanCompletedTitle.length > 0;
      const isParseMode = !isFollowUpMode && mode === 'parse' && userPrompt.length > 0;

      const systemInstruction = [
        'You are a high-precision productivity architect for Kinetic Arcade.',
        'Return strictly valid JSON matching the schema.',
        'Categories MUST be one of: Deep Work, Engineering, Design, Writing, Health.',
        'Priorities MUST be one of: critical, focus, routine.',
        'Keep titles crisp, concrete, and outcome-driven (under 85 characters).',
        'Keep xpReward between 30 and 180, and coinReward roughly 25% of xpReward (between 10 and 50).',
        'Every draft will be reviewed by a human before becoming an actual task.',
      ].join(' ');

      const prompt = isFollowUpMode
        ? [
            `Player: ${playerName} (${playerRole}), daily focus budget: ${focusGoal}m.`,
            `Completed Parent Quest: "${cleanCompletedTitle}".`,
            cleanOutcome ? `Captured Action Result: "${cleanOutcome}".` : '',
            cleanRefs.length > 0 ? `Referenced Locations: ${cleanRefs.join(' | ')}.` : '',
            existingTitles.length > 0
              ? `Existing active quests on board (avoid duplicates): ${existingTitles.join(' | ')}.`
              : '',
            'Propose 2 to 3 concrete follow-up quest drafts logically triggered by this completion outcome and references (with realistic dueLabel such as Tomorrow, In 2 days, or Next Sprint).',
          ]
            .filter(Boolean)
            .join('\n')
        : isParseMode
          ? [
              `Player: ${playerName} (${playerRole}), daily focus budget: ${focusGoal}m.`,
              bossTitle ? `Active Milestone Raid: ${bossTitle}.` : '',
              existingTitles.length > 0
                ? `Existing quests on board (avoid duplicates): ${existingTitles.join(' | ')}.`
                : '',
              `Convert the following raw human notes/input into 1 to 5 clean, actionable quest drafts:`,
              `"""${userPrompt}"""`,
            ]
              .filter(Boolean)
              .join('\n')
          : [
              `Player: ${playerName} (${playerRole}), daily focus budget: ${focusGoal}m.`,
              bossTitle ? `Active Milestone Raid: ${bossTitle}.` : '',
              userPrompt ? `Focus direction from user: ${userPrompt}` : '',
              existingTitles.length > 0
                ? `Existing quests on board (suggest complementary, non-duplicate next actions): ${existingTitles.join(' | ')}.`
                : '',
              'Suggest 3 tailored, high-leverage quest drafts aligned with the player role and focus capacity.',
            ]
              .filter(Boolean)
              .join('\n');

      const { response, modelUsed, fallbackUsed } = await generateContentWithResilience({
        ai,
        requestedModel,
        autoFallback,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              drafts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    category: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    xpReward: { type: Type.INTEGER },
                    coinReward: { type: Type.INTEGER },
                    dueLabel: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['title', 'category', 'priority', 'xpReward', 'coinReward', 'dueLabel'],
                },
              },
            },
            required: ['drafts'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"drafts":[]}').trim()) as {
        drafts?: Record<string, unknown>[];
      };
      const rawDrafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];

      const drafts = rawDrafts.slice(0, 6).map((item, idx) => {
        const xpReward = clampInt(item.xpReward, 20, 200, 90);
        const coinReward = clampInt(
          item.coinReward,
          10,
          60,
          Math.max(10, Math.round(xpReward * 0.25))
        );
        return {
          draftId: `draft-${Date.now()}-${idx}`,
          title:
            typeof item.title === 'string' && item.title.trim()
              ? item.title.trim().slice(0, 120)
              : 'Untitled Suggested Quest',
          notes:
            typeof item.notes === 'string' && item.notes.trim()
              ? item.notes.trim().slice(0, 220)
              : undefined,
          category: normalizeCategory(item.category),
          priority: normalizePriority(item.priority),
          xpReward,
          coinReward,
          dueLabel:
            typeof item.dueLabel === 'string' && item.dueLabel.trim()
              ? item.dueLabel.trim().slice(0, 40)
              : 'Today',
          rationale:
            typeof item.rationale === 'string' && item.rationale.trim()
              ? item.rationale.trim().slice(0, 140)
              : isFollowUpMode
                ? `Follow-up from "${cleanCompletedTitle}"`
                : isParseMode
                  ? 'Parsed from your input for review'
                  : `Aligned with ${playerRole}`,
          sourceMode: isFollowUpMode
            ? ('followup' as const)
            : isParseMode
              ? ('parsed' as const)
              : ('aligned' as const),
          ...(isFollowUpMode && typeof parentQuestId === 'string'
            ? {
                parentQuestId,
                triggeredFromTitle: cleanCompletedTitle.slice(0, 120),
                references: Array.isArray(references) ? references.slice(0, 6) : undefined,
              }
            : {}),
        };
      });

      res.json({ drafts, modelUsed, fallbackUsed });
    } catch (err) {
      const formatted = formatAiErrorResponse(
        err,
        requestedModel,
        'Failed to generate quest drafts.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/suggest-habits', async (req, res) => {
    const requestedModel = normalizeAiModel(req.body?.model);
    const autoFallback = req.body?.autoFallback !== false;
    try {
      const { mode, inputText, profile, activeHabitTitles, activeQuestTitles } = req.body ?? {};
      const { ai, ThinkingLevel, Type } = await getAiClient();

      const playerName =
        typeof profile?.playerName === 'string' && profile.playerName.trim()
          ? profile.playerName.trim()
          : 'Player';
      const playerRole =
        typeof profile?.playerRole === 'string' && profile.playerRole.trim()
          ? profile.playerRole.trim()
          : 'Product Builder';
      const focusGoal = clampInt(profile?.dailyFocusGoalMinutes, 15, 480, 90);
      const existingHabits = Array.isArray(activeHabitTitles)
        ? activeHabitTitles.filter((t): t is string => typeof t === 'string').slice(0, 12)
        : [];
      const existingQuests = Array.isArray(activeQuestTitles)
        ? activeQuestTitles.filter((t): t is string => typeof t === 'string').slice(0, 8)
        : [];
      const userPrompt = typeof inputText === 'string' ? inputText.trim() : '';
      const isParseMode = mode === 'parse' && userPrompt.length > 0;

      const ALLOWED_HABIT_CATEGORIES = new Set([
        'Deep Work',
        'Health',
        'Learning',
        'Operations',
      ]);

      const systemInstruction = [
        'You are a sustainable daily habit architect for Kinetic Arcade.',
        'Return strictly valid JSON matching the schema.',
        'Categories MUST be one of: Deep Work, Health, Learning, Operations.',
        'Keep titles crisp, concrete, and repeatable daily or weekly (under 75 characters).',
        'targetDaysPerWeek MUST be an integer between 1 and 7.',
        'xpReward MUST be between 15 and 80, and coinReward between 5 and 25.',
        'Every draft will be reviewed by a human before becoming an active habit.',
      ].join(' ');

      const prompt = isParseMode
        ? [
            `Player: ${playerName} (${playerRole}), daily focus budget: ${focusGoal}m.`,
            existingHabits.length > 0
              ? `Existing habits (avoid duplicates): ${existingHabits.join(' | ')}.`
              : '',
            `Convert the following raw routine goals or notes into 1 to 5 repeatable habit drafts:`,
            `"""${userPrompt}"""`,
          ]
            .filter(Boolean)
            .join('\n')
        : [
            `Player: ${playerName} (${playerRole}), daily focus budget: ${focusGoal}m.`,
            existingQuests.length > 0
              ? `Active quests for alignment: ${existingQuests.join(' | ')}.`
              : '',
            existingHabits.length > 0
              ? `Existing habits (suggest complementary, non-duplicate routines): ${existingHabits.join(' | ')}.`
              : '',
            userPrompt ? `Focus direction from user: ${userPrompt}` : '',
            'Suggest 3 sustainable, high-leverage recurring habit drafts aligned with the player role and active goals.',
          ]
            .filter(Boolean)
            .join('\n');

      const { response, modelUsed, fallbackUsed } = await generateContentWithResilience({
        ai,
        requestedModel,
        autoFallback,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              drafts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    targetDaysPerWeek: { type: Type.INTEGER },
                    xpReward: { type: Type.INTEGER },
                    coinReward: { type: Type.INTEGER },
                    rationale: { type: Type.STRING },
                  },
                  required: ['title', 'category', 'targetDaysPerWeek', 'xpReward', 'coinReward'],
                },
              },
            },
            required: ['drafts'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"drafts":[]}').trim()) as {
        drafts?: Record<string, unknown>[];
      };
      const rawDrafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];

      const drafts = rawDrafts.slice(0, 6).map((item, idx) => {
        const xpReward = clampInt(item.xpReward, 15, 80, 35);
        const coinReward = clampInt(
          item.coinReward,
          5,
          25,
          Math.max(5, Math.round(xpReward * 0.28))
        );
        const targetDaysPerWeek = clampInt(item.targetDaysPerWeek, 1, 7, 5);
        const rawCat = typeof item.category === 'string' ? item.category : '';
        const category = ALLOWED_HABIT_CATEGORIES.has(rawCat) ? rawCat : 'Deep Work';

        return {
          draftId: `hdraft-${Date.now()}-${idx}`,
          title:
            typeof item.title === 'string' && item.title.trim()
              ? item.title.trim().slice(0, 100)
              : 'Daily Focus Ritual',
          category,
          targetDaysPerWeek,
          xpReward,
          coinReward,
          rationale:
            typeof item.rationale === 'string' && item.rationale.trim()
              ? item.rationale.trim().slice(0, 140)
              : isParseMode
                ? 'Parsed from your input for review'
                : `Aligned with ${playerRole}`,
          sourceMode: isParseMode ? ('parsed' as const) : ('aligned' as const),
        };
      });

      res.json({ drafts, modelUsed, fallbackUsed });
    } catch (err) {
      const formatted = formatAiErrorResponse(
        err,
        requestedModel,
        'Failed to generate habit drafts.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/suggest-boss', async (req, res) => {
    const requestedModel = normalizeAiModel(req.body?.model);
    const autoFallback = req.body?.autoFallback !== false;
    try {
      const { goalText, profile, activeQuestTitles } = req.body ?? {};
      const { ai, ThinkingLevel, Type } = await getAiClient();

      const playerName =
        typeof profile?.playerName === 'string' && profile.playerName.trim()
          ? profile.playerName.trim()
          : 'Player';
      const playerRole =
        typeof profile?.playerRole === 'string' && profile.playerRole.trim()
          ? profile.playerRole.trim()
          : 'Product Builder';
      const goal = typeof goalText === 'string' ? goalText.trim() : '';
      const existingTitles = Array.isArray(activeQuestTitles)
        ? activeQuestTitles.filter((t): t is string => typeof t === 'string').slice(0, 10)
        : [];

      const systemInstruction = [
        'You are a milestone decomposition architect for Kinetic Arcade.',
        'Decompose a major project goal into 3 to 5 sequential, verifiable Boss Raid gates.',
        'Each gate must represent a concrete deliverable (under 90 characters).',
        'Return strictly valid JSON matching the schema.',
      ].join(' ');

      const prompt = [
        `Player: ${playerName} (${playerRole}).`,
        goal
          ? `Target milestone objective: "${goal}"`
          : `Propose a high-impact milestone raid tailored for a ${playerRole}.`,
        existingTitles.length > 0
          ? `Current active quests for context: ${existingTitles.join(' | ')}.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const { response, modelUsed, fallbackUsed } = await generateContentWithResilience({
        ai,
        requestedModel,
        autoFallback,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['title', 'subtitle', 'steps'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        title?: unknown;
        subtitle?: unknown;
        steps?: unknown[];
      };

      const cleanSteps = (Array.isArray(parsed.steps) ? parsed.steps : [])
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .slice(0, 5)
        .map((s, idx) => ({
          id: `bd-step-${Date.now()}-${idx}`,
          title: s.trim().slice(0, 110),
        }));

      if (cleanSteps.length === 0) {
        cleanSteps.push(
          { id: `bd-step-${Date.now()}-0`, title: 'Scope core milestone requirements' },
          { id: `bd-step-${Date.now()}-1`, title: 'Execute primary deliverable' },
          { id: `bd-step-${Date.now()}-2`, title: 'Verify quality and ship release' }
        );
      }

      const draft = {
        draftId: `boss-draft-${Date.now()}`,
        title:
          typeof parsed.title === 'string' && parsed.title.trim()
            ? parsed.title.trim().slice(0, 80)
            : goal || `${playerRole} Milestone Raid`,
        subtitle:
          typeof parsed.subtitle === 'string' && parsed.subtitle.trim()
            ? parsed.subtitle.trim().slice(0, 160)
            : 'AI-proposed milestone gates ready for your review.',
        steps: cleanSteps,
      };

      res.json({ draft, modelUsed, fallbackUsed });
    } catch (err) {
      const formatted = formatAiErrorResponse(
        err,
        requestedModel,
        'Failed to generate boss encounter draft.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const httpServer = http.createServer(app);
  let viteInstance: import('vite').ViteDevServer | null = null;

  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vitePromise = (async () => {
      const { createServer: createViteServer } = await import('vite');
      const server = await createViteServer({
        plugins: hmrDisabled
          ? [
              {
                name: 'disable-hmr-client-websocket',
                transform(code, id) {
                  if (id.replace(/\\/g, '/').endsWith('/vite/dist/client/client.mjs')) {
                    return code.replace(
                      'transport.connect(createHMRHandler(handleMessage));',
                      '/* HMR disabled: WebSocket transport suppressed */'
                    );
                  }
                },
              },
            ]
          : [],
        server: {
          middlewareMode: true,
          hmr: !hmrDisabled,
          ws: hmrDisabled ? false : { server: httpServer },
        },
        appType: 'spa',
      });
      viteInstance = server;
      return server;
    })();

    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite middleware:', err);
      process.exit(1);
    });

    app.use((req, res, next) => {
      vitePromise
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err);
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinetic Arcade server listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    const forceTimer = setTimeout(() => process.exit(0), 2000);
    forceTimer.unref();
    Promise.resolve(viteInstance?.close())
      .catch(() => {})
      .finally(() => {
        httpServer.close(() => process.exit(0));
      });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
