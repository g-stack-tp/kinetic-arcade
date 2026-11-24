import { AiModelId, BossDraft, HabitDraft, QuestDraft, QuestReference } from '../types';

export interface AiProfileContext {
  playerName: string;
  playerRole: string;
  dailyFocusGoalMinutes: number;
}

export interface AiQuestDraftsResult {
  drafts: QuestDraft[];
  modelUsed?: AiModelId;
  fallbackUsed?: boolean;
}

export interface AiHabitDraftsResult {
  drafts: HabitDraft[];
  modelUsed?: AiModelId;
  fallbackUsed?: boolean;
}

export interface AiBossDraftResult {
  draft: BossDraft;
  modelUsed?: AiModelId;
  fallbackUsed?: boolean;
}

export async function fetchAiQuestDrafts(params: {
  mode: 'aligned' | 'parse' | 'followups';
  inputText?: string;
  model?: AiModelId;
  autoFallback?: boolean;
  profile: AiProfileContext;
  activeQuestTitles: string[];
  bossTitle?: string;
  parentQuestId?: string;
  completedQuestTitle?: string;
  outcomeText?: string;
  references?: QuestReference[];
}): Promise<AiQuestDraftsResult> {
  const response = await fetch('/api/ai/suggest-quests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as {
    drafts?: QuestDraft[];
    modelUsed?: AiModelId;
    fallbackUsed?: boolean;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return {
    drafts: Array.isArray(data.drafts) ? data.drafts : [],
    modelUsed: data.modelUsed,
    fallbackUsed: Boolean(data.fallbackUsed),
  };
}

export async function fetchAiHabitDrafts(params: {
  mode: 'aligned' | 'parse';
  inputText?: string;
  model?: AiModelId;
  autoFallback?: boolean;
  profile: AiProfileContext;
  activeHabitTitles: string[];
  activeQuestTitles: string[];
}): Promise<AiHabitDraftsResult> {
  const response = await fetch('/api/ai/suggest-habits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as {
    drafts?: HabitDraft[];
    modelUsed?: AiModelId;
    fallbackUsed?: boolean;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return {
    drafts: Array.isArray(data.drafts) ? data.drafts : [],
    modelUsed: data.modelUsed,
    fallbackUsed: Boolean(data.fallbackUsed),
  };
}

export async function fetchAiBossDraft(params: {
  goalText?: string;
  model?: AiModelId;
  autoFallback?: boolean;
  profile: AiProfileContext;
  activeQuestTitles: string[];
}): Promise<AiBossDraftResult> {
  const response = await fetch('/api/ai/suggest-boss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as {
    draft?: BossDraft;
    modelUsed?: AiModelId;
    fallbackUsed?: boolean;
    error?: string;
  };

  if (!response.ok || !data.draft) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return {
    draft: data.draft,
    modelUsed: data.modelUsed,
    fallbackUsed: Boolean(data.fallbackUsed),
  };
}
