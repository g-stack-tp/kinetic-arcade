import {
  AiModelId,
  AppState,
  BossCommitment,
  BossDraft,
  BossEncounter,
  BossStep,
  FollowUpRule,
  Habit,
  HabitDraft,
  Quest,
  QuestCategory,
  QuestDraft,
  QuestPriority,
  QuestReference,
  QuestReferenceKind,
  ScheduledFollowUp,
} from '../types';
import {
  createBlankSlateState,
  createInitialState,
  formatDateKey,
} from '../data/initialData';

export type QuestFilterMode = 'all' | 'critical' | 'focus' | 'completed';

const ALLOWED_CATEGORIES: QuestCategory[] = [
  'Deep Work',
  'Engineering',
  'Design',
  'Writing',
  'Health',
];

const ALLOWED_PRIORITIES: QuestPriority[] = ['critical', 'focus', 'routine'];

const ALLOWED_HABIT_CATEGORIES = [
  'Deep Work',
  'Health',
  'Learning',
  'Operations',
];

export const DEFAULT_AI_MODEL: AiModelId = 'gemini-4-hydrogen';

export const AI_MODEL_OPTIONS: {
  id: AiModelId;
  label: string;
  tagline: string;
  description: string;
}[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    tagline: 'Balanced Default',
    description:
      'Stronger structured decomposition for complex milestone raids, follow-ups, and nuanced quest parsing.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    tagline: 'Fast · High Availability',
    description:
      'Lightweight, low-latency model ideal for rapid quest & habit drafting or bypassing temporary 503 demand spikes.',
  },
];

const ALLOWED_AI_MODELS = new Set<AiModelId>(AI_MODEL_OPTIONS.map((m) => m.id));

export function normalizeAiModel(raw: unknown): AiModelId {
  if (typeof raw === 'string' && ALLOWED_AI_MODELS.has(raw as AiModelId)) {
    return raw as AiModelId;
  }
  return DEFAULT_AI_MODEL;
}

export function getAiModelLabel(model: AiModelId): string {
  return AI_MODEL_OPTIONS.find((m) => m.id === model)?.label || 'Gemini 4 Hydrogen';
}

export function clampHabitDraft(draft: HabitDraft): HabitDraft {
  const rawXp =
    typeof draft.xpReward === 'number' && Number.isFinite(draft.xpReward)
      ? draft.xpReward
      : 35;
  const xpReward = Math.max(15, Math.min(80, Math.round(rawXp)));
  const rawCoin =
    typeof draft.coinReward === 'number' && Number.isFinite(draft.coinReward)
      ? draft.coinReward
      : Math.round(xpReward * 0.28);
  const coinReward = Math.max(5, Math.min(25, Math.round(rawCoin)));
  const rawDays =
    typeof draft.targetDaysPerWeek === 'number' && Number.isFinite(draft.targetDaysPerWeek)
      ? draft.targetDaysPerWeek
      : 5;
  const targetDaysPerWeek = Math.max(1, Math.min(7, Math.round(rawDays)));
  const category = ALLOWED_HABIT_CATEGORIES.includes(draft.category)
    ? draft.category
    : 'Deep Work';

  return {
    ...draft,
    title: draft.title.trim() || 'Daily Routine',
    category,
    xpReward,
    coinReward,
    targetDaysPerWeek,
  };
}

export function clampQuestDraft(draft: QuestDraft): QuestDraft {
  const rawXp =
    typeof draft.xpReward === 'number' && Number.isFinite(draft.xpReward)
      ? draft.xpReward
      : 90;
  const xpReward = Math.max(20, Math.min(200, Math.round(rawXp)));
  const rawCoin =
    typeof draft.coinReward === 'number' && Number.isFinite(draft.coinReward)
      ? draft.coinReward
      : Math.round(xpReward * 0.25);
  const coinReward = Math.max(10, Math.min(60, Math.round(rawCoin)));
  const category = ALLOWED_CATEGORIES.includes(draft.category)
    ? draft.category
    : 'Deep Work';
  const priority = ALLOWED_PRIORITIES.includes(draft.priority)
    ? draft.priority
    : 'focus';

  return {
    ...draft,
    title: draft.title.trim() || 'Untitled Quest',
    notes: draft.notes?.trim() || undefined,
    category,
    priority,
    xpReward,
    coinReward,
    dueLabel: draft.dueLabel?.trim() || 'Today',
  };
}

export function inferReferenceKind(location: string): QuestReferenceKind {
  const trimmed = location.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('~/') ||
    /^[A-Za-z]:\\/.test(trimmed) ||
    /^[^\s]+\/[^\s]+$/.test(trimmed)
  ) {
    return 'path';
  }
  return 'note';
}

export function sanitizeReferenceUrl(location: string): string | null {
  try {
    const parsed = new URL(location.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeQuestReference(
  raw: Partial<QuestReference> & { location: string }
): QuestReference | null {
  const location = raw.location.trim();
  if (!location) return null;
  const kind = raw.kind || inferReferenceKind(location);
  const label = raw.label?.trim() || (kind === 'url' ? 'Reference Link' : kind === 'path' ? 'File / Path' : 'Location');
  return {
    id: raw.id || `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: label.slice(0, 80),
    location: location.slice(0, 400),
    kind,
  };
}

export function hydrateWorkspaceState(parsed: Partial<AppState>): AppState {
  const defaults = createInitialState();
  const hasExplicitBoss = Object.prototype.hasOwnProperty.call(parsed, 'boss');
  const hydratedBoss = hasExplicitBoss
    ? parsed.boss && Array.isArray(parsed.boss.steps)
      ? parsed.boss
      : null
    : defaults.boss;

  const hasExplicitBossDraft = Object.prototype.hasOwnProperty.call(parsed, 'bossDraft');
  const hydratedBossDraft =
    hasExplicitBossDraft && parsed.bossDraft && Array.isArray(parsed.bossDraft.steps)
      ? parsed.bossDraft
      : null;

  return {
    ...defaults,
    ...parsed,
    playerName: parsed.playerName || defaults.playerName,
    playerRole: parsed.playerRole || defaults.playerRole,
    avatarEmblem: parsed.avatarEmblem || defaults.avatarEmblem,
    avatarTone: parsed.avatarTone || defaults.avatarTone,
    dailyFocusGoalMinutes:
      typeof parsed.dailyFocusGoalMinutes === 'number'
        ? parsed.dailyFocusGoalMinutes
        : defaults.dailyFocusGoalMinutes,
    defaultSprintMinutes:
      typeof parsed.defaultSprintMinutes === 'number'
        ? parsed.defaultSprintMinutes
        : defaults.defaultSprintMinutes,
    aiModel: normalizeAiModel(parsed.aiModel),
    aiAutoFallback:
      typeof parsed.aiAutoFallback === 'boolean'
        ? parsed.aiAutoFallback
        : defaults.aiAutoFallback,
    quests: Array.isArray(parsed.quests) ? parsed.quests : defaults.quests,
    questDrafts: Array.isArray(parsed.questDrafts)
      ? parsed.questDrafts.map(clampQuestDraft)
      : [],
    scheduledFollowUps: Array.isArray(parsed.scheduledFollowUps)
      ? parsed.scheduledFollowUps
      : [],
    habits: Array.isArray(parsed.habits) ? parsed.habits : defaults.habits,
    habitDrafts: Array.isArray(parsed.habitDrafts)
      ? parsed.habitDrafts.map(clampHabitDraft)
      : [],
    bounties: Array.isArray(parsed.bounties) ? parsed.bounties : defaults.bounties,
    focusSessions: Array.isArray(parsed.focusSessions)
      ? parsed.focusSessions
      : defaults.focusSessions,
    rewards: Array.isArray(parsed.rewards) ? parsed.rewards : defaults.rewards,
    redeemedRewards: Array.isArray(parsed.redeemedRewards)
      ? parsed.redeemedRewards
      : defaults.redeemedRewards,
    boss: hydratedBoss,
    bossDraft: hydratedBossDraft,
    deferredRaids: Array.isArray(parsed.deferredRaids) ? parsed.deferredRaids : [],
    raidHistory: Array.isArray(parsed.raidHistory) ? parsed.raidHistory : [],
  };
}

export function filterAndOrderQuests(
  quests: Quest[],
  filter: QuestFilterMode,
  searchQuery: string
): Quest[] {
  const qLower = searchQuery.trim().toLowerCase();
  const filtered = quests.filter((quest) => {
    if (filter === 'critical' && (quest.priority !== 'critical' || quest.completed)) return false;
    if (filter === 'focus' && (quest.priority !== 'focus' || quest.completed)) return false;
    if (filter === 'completed' && !quest.completed) return false;

    if (qLower) {
      const matchesTitle = quest.title.toLowerCase().includes(qLower);
      const matchesCat = quest.category.toLowerCase().includes(qLower);
      const matchesNotes = quest.notes ? quest.notes.toLowerCase().includes(qLower) : false;
      const matchesOutcome = quest.outcomeText
        ? quest.outcomeText.toLowerCase().includes(qLower)
        : false;
      const matchesParent = quest.triggeredFromTitle
        ? quest.triggeredFromTitle.toLowerCase().includes(qLower)
        : false;
      const matchesRefs = Array.isArray(quest.references)
        ? quest.references.some(
            (ref) =>
              ref.label.toLowerCase().includes(qLower) ||
              ref.location.toLowerCase().includes(qLower)
          )
        : false;
      return (
        matchesTitle ||
        matchesCat ||
        matchesNotes ||
        matchesOutcome ||
        matchesParent ||
        matchesRefs
      );
    }
    return true;
  });

  const priorityRank: Record<QuestPriority, number> = {
    critical: 0,
    focus: 1,
    routine: 2,
  };

  return [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed && b.completed) {
      const aTime = a.completedAt ? Date.parse(a.completedAt) : NaN;
      const bTime = b.completedAt ? Date.parse(b.completedAt) : NaN;
      const aValid = Number.isFinite(aTime);
      const bValid = Number.isFinite(bTime);
      if (aValid && bValid && aTime !== bTime) return bTime - aTime;
      if (aValid !== bValid) return aValid ? -1 : 1;
    }
    return priorityRank[a.priority] - priorityRank[b.priority];
  });
}

export function questHasOutcomeOrReferences(quest: Quest): boolean {
  const hasOutcome = Boolean(quest.outcomeText && quest.outcomeText.trim().length > 0);
  const hasRefs = Array.isArray(quest.references) && quest.references.length > 0;
  return hasOutcome || hasRefs;
}

export function clearCompletedQuestsState(
  state: AppState,
  options?: { preserveWithOutcomeOrRefs?: boolean }
): {
  nextState: AppState;
  removedCount: number;
  preservedCount: number;
} {
  const preserve = Boolean(options?.preserveWithOutcomeOrRefs);
  const remaining = state.quests.filter((q) => {
    if (!q.completed) return true;
    if (preserve && questHasOutcomeOrReferences(q)) return true;
    return false;
  });
  const removedCount = state.quests.length - remaining.length;
  const preservedCount = remaining.filter((q) => q.completed).length;
  return {
    nextState: {
      ...state,
      quests: remaining,
    },
    removedCount,
    preservedCount,
  };
}

/* ============================================================================
 * Quest Outcome Capture, Reference Locations & Follow-Up Trigger Reducers
 * ============================================================================ */

export function updateQuestOutcomeState(
  state: AppState,
  questId: string,
  patch: {
    outcomeText?: string;
    references?: QuestReference[];
  }
): AppState {
  let changed = false;
  const nextQuests = state.quests.map((q) => {
    if (q.id !== questId) return q;
    changed = true;
    const nextOutcome =
      patch.outcomeText !== undefined
        ? patch.outcomeText.trim() || undefined
        : q.outcomeText;
    const nextRefs =
      patch.references !== undefined
        ? patch.references
            .map((r) => normalizeQuestReference(r))
            .filter((r): r is QuestReference => r !== null)
        : q.references;
    return {
      ...q,
      outcomeText: nextOutcome,
      references: nextRefs && nextRefs.length > 0 ? nextRefs : undefined,
    };
  });

  if (!changed) return state;
  return {
    ...state,
    quests: nextQuests,
  };
}

export function addQuestFollowUpRuleState(
  state: AppState,
  questId: string,
  ruleInput: {
    title: string;
    notes?: string;
    category?: QuestCategory;
    priority?: QuestPriority;
    delayHours?: number;
    xpReward?: number;
    coinReward?: number;
  }
): AppState {
  const trimmedTitle = ruleInput.title.trim();
  if (!trimmedTitle) return state;

  const priority = ALLOWED_PRIORITIES.includes(ruleInput.priority as QuestPriority)
    ? (ruleInput.priority as QuestPriority)
    : 'focus';
  const category = ALLOWED_CATEGORIES.includes(ruleInput.category as QuestCategory)
    ? (ruleInput.category as QuestCategory)
    : 'Deep Work';
  const rawDelay =
    typeof ruleInput.delayHours === 'number' && Number.isFinite(ruleInput.delayHours)
      ? ruleInput.delayHours
      : 0;
  const delayHours = Math.max(0, Math.min(720, Math.round(rawDelay)));
  const rawXp =
    typeof ruleInput.xpReward === 'number' && Number.isFinite(ruleInput.xpReward)
      ? ruleInput.xpReward
      : priority === 'critical'
        ? 120
        : priority === 'focus'
          ? 85
          : 55;
  const xpReward = Math.max(20, Math.min(200, Math.round(rawXp)));
  const rawCoin =
    typeof ruleInput.coinReward === 'number' && Number.isFinite(ruleInput.coinReward)
      ? ruleInput.coinReward
      : Math.round(xpReward * 0.25);
  const coinReward = Math.max(10, Math.min(60, Math.round(rawCoin)));

  const newRule: FollowUpRule = {
    id: `fur-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: trimmedTitle.slice(0, 120),
    notes: ruleInput.notes?.trim() || undefined,
    category,
    priority,
    delayHours,
    xpReward,
    coinReward,
  };

  return {
    ...state,
    quests: state.quests.map((q) =>
      q.id === questId
        ? { ...q, followUpRules: [...(q.followUpRules || []), newRule] }
        : q
    ),
  };
}

export function removeQuestFollowUpRuleState(
  state: AppState,
  questId: string,
  ruleId: string
): AppState {
  return {
    ...state,
    quests: state.quests.map((q) => {
      if (q.id !== questId || !q.followUpRules) return q;
      const filtered = q.followUpRules.filter((r) => r.id !== ruleId);
      return {
        ...q,
        followUpRules: filtered.length > 0 ? filtered : undefined,
      };
    }),
  };
}

function buildActivatedFollowUpQuest(item: {
  parentQuestId: string;
  parentQuestTitle: string;
  parentOutcomeText?: string;
  parentReferences?: QuestReference[];
  title: string;
  notes?: string;
  category: QuestCategory;
  priority: QuestPriority;
  xpReward: number;
  coinReward: number;
  dueLabel: string;
}): Quest {
  const inheritedNotes = [
    item.notes?.trim(),
    item.parentOutcomeText?.trim()
      ? `Prior outcome: ${item.parentOutcomeText.trim()}`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    id: `q-fu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: item.title,
    notes: inheritedNotes || undefined,
    category: item.category,
    priority: item.priority,
    xpReward: item.xpReward,
    coinReward: item.coinReward,
    dueLabel: item.dueLabel,
    completed: false,
    parentQuestId: item.parentQuestId,
    triggeredFromTitle: item.parentQuestTitle,
    references:
      item.parentReferences && item.parentReferences.length > 0
        ? item.parentReferences.map((r) => ({ ...r }))
        : undefined,
  };
}

export function evaluateScheduledFollowUpsState(
  state: AppState,
  nowIso: string = new Date().toISOString()
): { nextState: AppState; activatedQuests: Quest[] } {
  if (state.scheduledFollowUps.length === 0) {
    return { nextState: state, activatedQuests: [] };
  }

  const nowMs = Date.parse(nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();

  const due: ScheduledFollowUp[] = [];
  const remaining: ScheduledFollowUp[] = [];

  for (const item of state.scheduledFollowUps) {
    const triggerMs = Date.parse(item.triggerAt);
    if (Number.isFinite(triggerMs) && triggerMs <= safeNowMs) {
      due.push(item);
    } else {
      remaining.push(item);
    }
  }

  if (due.length === 0) {
    return { nextState: state, activatedQuests: [] };
  }

  const activatedQuests = due.map((item) =>
    buildActivatedFollowUpQuest({
      ...item,
      dueLabel: 'Triggered Follow-Up',
    })
  );

  return {
    activatedQuests,
    nextState: {
      ...state,
      quests: [...activatedQuests, ...state.quests],
      scheduledFollowUps: remaining,
    },
  };
}

export function triggerScheduledFollowUpNowState(
  state: AppState,
  scheduledId: string
): { nextState: AppState; activatedQuest: Quest | null } {
  const target = state.scheduledFollowUps.find((s) => s.id === scheduledId);
  if (!target) {
    return { nextState: state, activatedQuest: null };
  }
  const activatedQuest = buildActivatedFollowUpQuest({
    ...target,
    dueLabel: 'Triggered Follow-Up',
  });
  return {
    activatedQuest,
    nextState: {
      ...state,
      quests: [activatedQuest, ...state.quests],
      scheduledFollowUps: state.scheduledFollowUps.filter((s) => s.id !== scheduledId),
    },
  };
}

export function discardScheduledFollowUpState(
  state: AppState,
  scheduledId: string
): AppState {
  return {
    ...state,
    scheduledFollowUps: state.scheduledFollowUps.filter((s) => s.id !== scheduledId),
  };
}

/* ============================================================================
 * Human-in-the-Loop (HITL) Quest Draft Staging Reducers
 * ============================================================================ */

export function stageQuestDraftsState(
  state: AppState,
  incomingDrafts: QuestDraft[]
): AppState {
  const clamped = incomingDrafts.map(clampQuestDraft);
  return {
    ...state,
    questDrafts: [...clamped, ...state.questDrafts],
  };
}

export function updateQuestDraftState(
  state: AppState,
  draftId: string,
  patch: Partial<QuestDraft>
): AppState {
  return {
    ...state,
    questDrafts: state.questDrafts.map((d) =>
      d.draftId === draftId ? clampQuestDraft({ ...d, ...patch }) : d
    ),
  };
}

export function approveQuestDraftState(
  state: AppState,
  draftId: string
): { nextState: AppState; approvedQuest: Quest | null } {
  const target = state.questDrafts.find((d) => d.draftId === draftId);
  if (!target) {
    return { nextState: state, approvedQuest: null };
  }
  const clean = clampQuestDraft(target);
  const actualQuest: Quest = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: clean.title,
    notes: clean.notes,
    category: clean.category,
    priority: clean.priority,
    xpReward: clean.xpReward,
    coinReward: clean.coinReward,
    dueLabel: clean.dueLabel,
    completed: false,
    parentQuestId: clean.parentQuestId,
    triggeredFromTitle: clean.triggeredFromTitle,
    references: clean.references,
  };
  return {
    approvedQuest: actualQuest,
    nextState: {
      ...state,
      quests: [actualQuest, ...state.quests],
      questDrafts: state.questDrafts.filter((d) => d.draftId !== draftId),
    },
  };
}

export function approveAllQuestDraftsState(state: AppState): {
  nextState: AppState;
  approvedCount: number;
} {
  if (state.questDrafts.length === 0) {
    return { nextState: state, approvedCount: 0 };
  }
  const newActuals: Quest[] = state.questDrafts.map((raw, idx) => {
    const clean = clampQuestDraft(raw);
    return {
      id: `q-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      title: clean.title,
      notes: clean.notes,
      category: clean.category,
      priority: clean.priority,
      xpReward: clean.xpReward,
      coinReward: clean.coinReward,
      dueLabel: clean.dueLabel,
      completed: false,
      parentQuestId: clean.parentQuestId,
      triggeredFromTitle: clean.triggeredFromTitle,
      references: clean.references,
    };
  });
  return {
    approvedCount: newActuals.length,
    nextState: {
      ...state,
      quests: [...newActuals, ...state.quests],
      questDrafts: [],
    },
  };
}

export function discardQuestDraftState(state: AppState, draftId: string): AppState {
  return {
    ...state,
    questDrafts: state.questDrafts.filter((d) => d.draftId !== draftId),
  };
}

export function clearQuestDraftsState(state: AppState): AppState {
  return {
    ...state,
    questDrafts: [],
  };
}

/* ============================================================================
 * Human-in-the-Loop (HITL) Habit Draft Staging Reducers
 * ============================================================================ */

export function stageHabitDraftsState(
  state: AppState,
  incomingDrafts: HabitDraft[]
): AppState {
  const clamped = incomingDrafts.map(clampHabitDraft);
  return {
    ...state,
    habitDrafts: [...clamped, ...state.habitDrafts],
  };
}

export function updateHabitDraftState(
  state: AppState,
  draftId: string,
  patch: Partial<HabitDraft>
): AppState {
  return {
    ...state,
    habitDrafts: state.habitDrafts.map((d) =>
      d.draftId === draftId ? clampHabitDraft({ ...d, ...patch }) : d
    ),
  };
}

export function approveHabitDraftState(
  state: AppState,
  draftId: string
): { nextState: AppState; approvedHabit: Habit | null } {
  const target = state.habitDrafts.find((d) => d.draftId === draftId);
  if (!target) {
    return { nextState: state, approvedHabit: null };
  }
  const clean = clampHabitDraft(target);
  const actualHabit: Habit = {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: clean.title,
    category: clean.category,
    xpReward: clean.xpReward,
    coinReward: clean.coinReward,
    targetDaysPerWeek: clean.targetDaysPerWeek,
    history: {},
  };
  return {
    approvedHabit: actualHabit,
    nextState: {
      ...state,
      habits: [actualHabit, ...state.habits],
      habitDrafts: state.habitDrafts.filter((d) => d.draftId !== draftId),
    },
  };
}

export function approveAllHabitDraftsState(state: AppState): {
  nextState: AppState;
  approvedCount: number;
} {
  if (state.habitDrafts.length === 0) {
    return { nextState: state, approvedCount: 0 };
  }
  const newActuals: Habit[] = state.habitDrafts.map((raw, idx) => {
    const clean = clampHabitDraft(raw);
    return {
      id: `h-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      title: clean.title,
      category: clean.category,
      xpReward: clean.xpReward,
      coinReward: clean.coinReward,
      targetDaysPerWeek: clean.targetDaysPerWeek,
      history: {},
    };
  });
  return {
    approvedCount: newActuals.length,
    nextState: {
      ...state,
      habits: [...newActuals, ...state.habits],
      habitDrafts: [],
    },
  };
}

export function discardHabitDraftState(state: AppState, draftId: string): AppState {
  return {
    ...state,
    habitDrafts: state.habitDrafts.filter((d) => d.draftId !== draftId),
  };
}

export function clearHabitDraftsState(state: AppState): AppState {
  return {
    ...state,
    habitDrafts: [],
  };
}

export function orderScheduledFollowUps(
  scheduledFollowUps: ScheduledFollowUp[]
): ScheduledFollowUp[] {
  return [...scheduledFollowUps].sort((a, b) => {
    const aTrigger = Date.parse(a.triggerAt);
    const bTrigger = Date.parse(b.triggerAt);
    const aValid = Number.isFinite(aTrigger);
    const bValid = Number.isFinite(bTrigger);
    if (aValid && bValid && aTrigger !== bTrigger) return aTrigger - bTrigger;
    if (aValid !== bValid) return aValid ? -1 : 1;

    const aCreated = Date.parse(a.createdAt);
    const bCreated = Date.parse(b.createdAt);
    if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
      return aCreated - bCreated;
    }
    return 0;
  });
}

/* ============================================================================
 * Boss Encounter & HITL Boss Draft Staging Reducers
 * ============================================================================ */

export function orderBossSteps(steps: BossStep[]): BossStep[] {
  const required = steps.filter((s) => !s.optional);
  const optional = steps.filter((s) => Boolean(s.optional));
  return [...required, ...optional];
}

export function getBossProgress(boss: BossEncounter): {
  requiredSteps: BossEncounter['steps'];
  optionalSteps: BossEncounter['steps'];
  completedRequiredCount: number;
  completedOptionalCount: number;
  requiredMaxHp: number;
  requiredDamageDealt: number;
  remainingRequiredHp: number;
  hpPct: number;
  bossDefeated: boolean;
  stretchBonusXp: number;
  stretchBonusCoins: number;
} {
  const rawRequired = boss.steps.filter((s) => !s.optional);
  const optionalSteps = boss.steps.filter((s) => Boolean(s.optional));
  const effectiveRequired = rawRequired.length > 0 ? rawRequired : boss.steps;

  const requiredMaxHp = Math.max(
    100,
    effectiveRequired.reduce((sum, s) => sum + s.damage, 0)
  );
  const requiredDamageDealt = effectiveRequired.reduce(
    (sum, s) => (s.completed ? sum + s.damage : sum),
    0
  );
  const remainingRequiredHp = Math.max(0, requiredMaxHp - requiredDamageDealt);
  const hpPct = Math.round((remainingRequiredHp / requiredMaxHp) * 100);
  const completedRequiredCount = effectiveRequired.filter((s) => s.completed).length;
  const completedOptionalCount = optionalSteps.filter((s) => s.completed).length;
  const bossDefeated = effectiveRequired.length > 0 && remainingRequiredHp === 0;

  return {
    requiredSteps: effectiveRequired,
    optionalSteps,
    completedRequiredCount,
    completedOptionalCount,
    requiredMaxHp,
    requiredDamageDealt,
    remainingRequiredHp,
    hpPct,
    bossDefeated,
    stretchBonusXp: completedOptionalCount * 25,
    stretchBonusCoins: completedOptionalCount * 10,
  };
}

export function createBossEncounterState(
  state: AppState,
  title: string,
  subtitle: string,
  stepTitles: string[],
  options?: {
    commitment?: BossCommitment;
    optionalStepIndices?: number[];
  }
): AppState {
  const optionalSet = new Set(options?.optionalStepIndices || []);
  const cleanSteps = stepTitles
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, idx) => ({
      id: `step-${Date.now()}-${idx}`,
      title: s,
      damage: 100,
      completed: false,
      optional: optionalSet.has(idx) ? true : undefined,
    }));

  const requiredCount = cleanSteps.filter((s) => !s.optional).length;
  const effectiveHpSteps = requiredCount > 0 ? requiredCount : cleanSteps.length;
  const maxHp = Math.max(100, effectiveHpSteps * 100);
  const boss: BossEncounter = {
    id: `boss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim() || 'Milestone Raid',
    subtitle: subtitle.trim() || 'Complete every required raid gate to claim the milestone bounty.',
    commitment: options?.commitment || 'required',
    maxHp,
    rewardXp: cleanSteps.length * 75,
    rewardCoins: cleanSteps.length * 30,
    bountyClaimed: false,
    steps: cleanSteps,
  };

  const nowIso = new Date().toISOString();
  let nextRaidHistory = state.raidHistory;
  let nextDeferredRaids = state.deferredRaids;

  if (state.boss) {
    if (state.boss.bountyClaimed) {
      nextRaidHistory = [
        state.boss,
        ...state.raidHistory.filter((r) => r.id !== state.boss!.id),
      ];
    } else {
      const parkedPrevious: BossEncounter = {
        ...state.boss,
        deferredAt: nowIso,
        deferReason: 'Paused to start a new raid',
      };
      nextDeferredRaids = [parkedPrevious, ...state.deferredRaids];
    }
  }

  return {
    ...state,
    boss,
    deferredRaids: nextDeferredRaids,
    raidHistory: nextRaidHistory,
  };
}

export function stageBossDraftState(state: AppState, draft: BossDraft): AppState {
  const cleanSteps = draft.steps
    .map((s) => ({ ...s, title: s.title.trim() }))
    .filter((s) => s.title.length > 0)
    .slice(0, 6);

  return {
    ...state,
    bossDraft: {
      ...draft,
      title: draft.title.trim() || 'Milestone Raid Draft',
      subtitle: draft.subtitle.trim() || 'Review raid gates before committing.',
      commitment: draft.commitment || 'required',
      steps: cleanSteps,
    },
  };
}

export function updateBossDraftState(
  state: AppState,
  patch: Partial<BossDraft>
): AppState {
  if (!state.bossDraft) return state;
  return {
    ...state,
    bossDraft: {
      ...state.bossDraft,
      ...patch,
    },
  };
}

export function approveBossDraftState(state: AppState): {
  nextState: AppState;
  approved: boolean;
} {
  if (!state.bossDraft) {
    return { nextState: state, approved: false };
  }
  const cleanSteps = state.bossDraft.steps
    .map((s) => ({ ...s, title: s.title.trim() }))
    .filter((s) => s.title.length > 0);
  if (cleanSteps.length === 0) {
    return { nextState: state, approved: false };
  }
  const optionalStepIndices = cleanSteps
    .map((s, idx) => (s.optional ? idx : -1))
    .filter((idx) => idx >= 0);

  const withBoss = createBossEncounterState(
    state,
    state.bossDraft.title,
    state.bossDraft.subtitle,
    cleanSteps.map((s) => s.title),
    {
      commitment: state.bossDraft.commitment || 'required',
      optionalStepIndices,
    }
  );
  return {
    approved: true,
    nextState: {
      ...withBoss,
      bossDraft: null,
    },
  };
}

export function discardBossDraftState(state: AppState): AppState {
  return {
    ...state,
    bossDraft: null,
  };
}

export function bossHasEvidence(boss: BossEncounter): boolean {
  if (boss.raidOutcomeText && boss.raidOutcomeText.trim().length > 0) return true;
  if (Array.isArray(boss.raidReferences) && boss.raidReferences.length > 0) return true;
  return boss.steps.some(
    (s) =>
      Boolean(s.outcomeText && s.outcomeText.trim().length > 0) ||
      (Array.isArray(s.references) && s.references.length > 0)
  );
}

export function computeBossDocumentationBonus(boss: BossEncounter): number {
  if (!bossHasEvidence(boss)) return 0;
  return Math.max(15, Math.round(boss.rewardCoins * 0.15));
}

export function updateBossStepOutcomeState(
  state: AppState,
  stepId: string,
  patch: {
    outcomeText?: string;
    references?: QuestReference[];
  }
): AppState {
  if (!state.boss) return state;
  let changed = false;
  const nextSteps = state.boss.steps.map((s) => {
    if (s.id !== stepId) return s;
    changed = true;
    const nextOutcome =
      patch.outcomeText !== undefined
        ? patch.outcomeText.trim() || undefined
        : s.outcomeText;
    const nextRefs =
      patch.references !== undefined
        ? patch.references
            .map((r) => normalizeQuestReference(r))
            .filter((r): r is QuestReference => r !== null)
        : s.references;
    return {
      ...s,
      outcomeText: nextOutcome,
      references: nextRefs && nextRefs.length > 0 ? nextRefs : undefined,
    };
  });

  if (!changed) return state;
  return {
    ...state,
    boss: {
      ...state.boss,
      steps: nextSteps,
    },
  };
}

export function updateBossRaidDebriefState(
  state: AppState,
  patch: {
    raidOutcomeText?: string;
    raidReferences?: QuestReference[];
  }
): AppState {
  if (!state.boss) return state;
  const nextOutcome =
    patch.raidOutcomeText !== undefined
      ? patch.raidOutcomeText.trim() || undefined
      : state.boss.raidOutcomeText;
  const nextRefs =
    patch.raidReferences !== undefined
      ? patch.raidReferences
          .map((r) => normalizeQuestReference(r))
          .filter((r): r is QuestReference => r !== null)
      : state.boss.raidReferences;

  return {
    ...state,
    boss: {
      ...state.boss,
      raidOutcomeText: nextOutcome,
      raidReferences: nextRefs && nextRefs.length > 0 ? nextRefs : undefined,
    },
  };
}

export function toggleBossCommitmentState(
  state: AppState,
  commitment?: BossCommitment
): AppState {
  if (!state.boss) return state;
  const nextCommitment: BossCommitment =
    commitment || (state.boss.commitment === 'optional' ? 'required' : 'optional');
  return {
    ...state,
    boss: {
      ...state.boss,
      commitment: nextCommitment,
    },
  };
}

export function toggleBossStepOptionalState(state: AppState, stepId: string): AppState {
  if (!state.boss) return state;
  let changed = false;
  const nextSteps = state.boss.steps.map((s) => {
    if (s.id !== stepId) return s;
    changed = true;
    return {
      ...s,
      optional: !s.optional ? true : undefined,
    };
  });
  if (!changed) return state;

  const candidateBoss: BossEncounter = {
    ...state.boss,
    steps: nextSteps,
  };
  const { requiredMaxHp } = getBossProgress(candidateBoss);
  return {
    ...state,
    boss: {
      ...candidateBoss,
      maxHp: requiredMaxHp,
    },
  };
}

export function toggleBossStepState(state: AppState, stepId: string): AppState {
  if (!state.boss) return state;
  return {
    ...state,
    boss: {
      ...state.boss,
      steps: state.boss.steps.map((s) =>
        s.id === stepId ? { ...s, completed: !s.completed } : s
      ),
    },
  };
}

export function claimBossBountyState(
  state: AppState,
  nowIso: string = new Date().toISOString()
): {
  nextState: AppState;
  claimed: boolean;
  bonusCoins: number;
  stretchBonusXp: number;
  stretchBonusCoins: number;
} {
  if (!state.boss || state.boss.bountyClaimed) {
    return {
      nextState: state,
      claimed: false,
      bonusCoins: 0,
      stretchBonusXp: 0,
      stretchBonusCoins: 0,
    };
  }
  const progress = getBossProgress(state.boss);
  if (!progress.bossDefeated) {
    return {
      nextState: state,
      claimed: false,
      bonusCoins: 0,
      stretchBonusXp: 0,
      stretchBonusCoins: 0,
    };
  }
  const bonusCoins = computeBossDocumentationBonus(state.boss);
  const { stretchBonusXp, stretchBonusCoins } = progress;
  return {
    claimed: true,
    bonusCoins,
    stretchBonusXp,
    stretchBonusCoins,
    nextState: {
      ...state,
      xp: state.xp + state.boss.rewardXp + stretchBonusXp,
      coins: state.coins + state.boss.rewardCoins + bonusCoins + stretchBonusCoins,
      boss: {
        ...state.boss,
        bountyClaimed: true,
        claimedAt: nowIso,
        bonusCoinsAwarded: bonusCoins,
        stretchBonusXpAwarded: stretchBonusXp,
        stretchBonusCoinsAwarded: stretchBonusCoins,
      },
    },
  };
}

export function deferBossEncounterState(
  state: AppState,
  options?: {
    delayHours?: number;
    reason?: string;
    nowIso?: string;
  }
): { nextState: AppState; deferredRaid: BossEncounter | null } {
  if (!state.boss) {
    return { nextState: state, deferredRaid: null };
  }
  const nowIso = options?.nowIso || new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const delayHours =
    typeof options?.delayHours === 'number' && Number.isFinite(options.delayHours)
      ? Math.max(0, Math.round(options.delayHours))
      : 0;

  const deferredRaid: BossEncounter = {
    ...state.boss,
    deferredAt: nowIso,
    resumeAt:
      delayHours > 0
        ? new Date(safeNowMs + delayHours * 3600 * 1000).toISOString()
        : undefined,
    deferReason: options?.reason?.trim() || undefined,
  };

  return {
    deferredRaid,
    nextState: {
      ...state,
      boss: null,
      deferredRaids: [deferredRaid, ...state.deferredRaids],
    },
  };
}

export function resumeDeferredRaidState(
  state: AppState,
  raidId: string,
  options?: {
    deferCurrentReason?: string;
    nowIso?: string;
  }
): {
  nextState: AppState;
  resumedRaid: BossEncounter | null;
  autoDeferredCurrent: boolean;
} {
  const target = state.deferredRaids.find((r) => r.id === raidId);
  if (!target) {
    return { nextState: state, resumedRaid: null, autoDeferredCurrent: false };
  }

  const nowIso = options?.nowIso || new Date().toISOString();
  const remainingDeferred = state.deferredRaids.filter((r) => r.id !== raidId);
  let autoDeferredCurrent = false;
  let nextDeferredList = remainingDeferred;
  let nextRaidHistory = state.raidHistory;

  if (state.boss) {
    if (state.boss.bountyClaimed) {
      nextRaidHistory = [
        state.boss,
        ...state.raidHistory.filter((r) => r.id !== state.boss!.id),
      ];
    } else {
      autoDeferredCurrent = true;
      const parkedCurrent: BossEncounter = {
        ...state.boss,
        deferredAt: nowIso,
        deferReason: options?.deferCurrentReason || 'Paused to resume another raid',
      };
      nextDeferredList = [parkedCurrent, ...remainingDeferred];
    }
  }

  const resumedRaid: BossEncounter = {
    ...target,
    deferredAt: undefined,
    resumeAt: undefined,
    deferReason: undefined,
  };

  return {
    resumedRaid,
    autoDeferredCurrent,
    nextState: {
      ...state,
      boss: resumedRaid,
      deferredRaids: nextDeferredList,
      raidHistory: nextRaidHistory,
    },
  };
}

export function discardDeferredRaidState(state: AppState, raidId: string): AppState {
  return {
    ...state,
    deferredRaids: state.deferredRaids.filter((r) => r.id !== raidId),
  };
}

export function getDueDeferredRaids(
  deferredRaids: BossEncounter[],
  nowIso: string = new Date().toISOString()
): BossEncounter[] {
  const nowMs = Date.parse(nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  return deferredRaids.filter((raid) => {
    if (!raid.resumeAt) return false;
    const resumeMs = Date.parse(raid.resumeAt);
    return Number.isFinite(resumeMs) && resumeMs <= safeNowMs;
  });
}

export function orderDeferredRaids(
  deferredRaids: BossEncounter[],
  nowIso: string = new Date().toISOString()
): BossEncounter[] {
  const nowMs = Date.parse(nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();

  return [...deferredRaids].sort((a, b) => {
    const aResume = a.resumeAt ? Date.parse(a.resumeAt) : NaN;
    const bResume = b.resumeAt ? Date.parse(b.resumeAt) : NaN;
    const aHasResume = Number.isFinite(aResume);
    const bHasResume = Number.isFinite(bResume);
    const aDue = aHasResume && aResume <= safeNowMs;
    const bDue = bHasResume && bResume <= safeNowMs;

    if (aDue !== bDue) return aDue ? -1 : 1;

    const aOptional = a.commitment === 'optional';
    const bOptional = b.commitment === 'optional';
    if (aOptional !== bOptional) return aOptional ? 1 : -1;

    if (aHasResume !== bHasResume) return aHasResume ? -1 : 1;
    if (aHasResume && bHasResume && aResume !== bResume) return aResume - bResume;

    const aDef = a.deferredAt ? Date.parse(a.deferredAt) : NaN;
    const bDef = b.deferredAt ? Date.parse(b.deferredAt) : NaN;
    if (Number.isFinite(aDef) && Number.isFinite(bDef) && aDef !== bDef) {
      return bDef - aDef;
    }
    return 0;
  });
}

export function archiveBossEncounterState(state: AppState): {
  nextState: AppState;
  archivedRaid: BossEncounter | null;
} {
  if (!state.boss || !state.boss.bountyClaimed) {
    return { nextState: state, archivedRaid: null };
  }
  const archivedRaid = state.boss;
  return {
    archivedRaid,
    nextState: {
      ...state,
      boss: null,
      raidHistory: [
        archivedRaid,
        ...state.raidHistory.filter((r) => r.id !== archivedRaid.id),
      ],
    },
  };
}

export function deleteArchivedRaidState(state: AppState, raidId: string): AppState {
  return {
    ...state,
    raidHistory: state.raidHistory.filter((r) => r.id !== raidId),
  };
}

export function clearBossEncounterState(state: AppState): AppState {
  if (state.boss?.bountyClaimed) {
    return archiveBossEncounterState(state).nextState;
  }
  return {
    ...state,
    boss: null,
  };
}

export function purgeWorkspaceState(
  currentState: AppState,
  keepPersonalization: boolean
): AppState {
  if (keepPersonalization) {
    return createBlankSlateState({
      playerName: currentState.playerName,
      playerRole: currentState.playerRole,
      avatarEmblem: currentState.avatarEmblem,
      avatarTone: currentState.avatarTone,
      dailyFocusGoalMinutes: currentState.dailyFocusGoalMinutes,
      defaultSprintMinutes: currentState.defaultSprintMinutes,
      soundEnabled: currentState.soundEnabled,
      aiModel: normalizeAiModel(currentState.aiModel),
      aiAutoFallback: currentState.aiAutoFallback,
    });
  }
  return createBlankSlateState();
}

export function parseAndHydrateWorkspaceJson(jsonText: string): {
  ok: boolean;
  state?: AppState;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText) as Partial<AppState>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.quests)) {
      return {
        ok: false,
        error: 'Invalid workspace file: missing expected quest data.',
      };
    }
    return {
      ok: true,
      state: hydrateWorkspaceState(parsed),
    };
  } catch {
    return {
      ok: false,
      error: 'Malformed JSON file. Please select a valid backup.',
    };
  }
}

export function toggleQuestCompletionState(
  state: AppState,
  questId: string,
  nowIso: string = new Date().toISOString()
): {
  nextState: AppState;
  completedNow: boolean;
  xpDelta: number;
  coinDelta: number;
  boostUsed: boolean;
  immediateFollowUps: Quest[];
  newlyScheduledCount: number;
} {
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest) {
    return {
      nextState: state,
      completedNow: false,
      xpDelta: 0,
      coinDelta: 0,
      boostUsed: false,
      immediateFollowUps: [],
      newlyScheduledCount: 0,
    };
  }

  const completing = !quest.completed;
  const boostUsed = completing && state.doubleXpCharges > 0;
  const xpDelta = completing
    ? boostUsed
      ? quest.xpReward * 2
      : quest.xpReward
    : -quest.xpReward;
  const coinDelta = completing ? quest.coinReward : -quest.coinReward;

  const immediateFollowUps: Quest[] = [];
  const newlyScheduled: ScheduledFollowUp[] = [];
  const nowMs = Date.parse(nowIso);
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();

  const nextFollowUpRules =
    completing && Array.isArray(quest.followUpRules)
      ? quest.followUpRules.map((rule) => {
          if (rule.triggeredAt) {
            return rule;
          }
          if (rule.delayHours <= 0) {
            immediateFollowUps.push(
              buildActivatedFollowUpQuest({
                parentQuestId: quest.id,
                parentQuestTitle: quest.title,
                parentOutcomeText: quest.outcomeText,
                parentReferences: quest.references,
                title: rule.title,
                notes: rule.notes,
                category: rule.category,
                priority: rule.priority,
                xpReward: rule.xpReward,
                coinReward: rule.coinReward,
                dueLabel: 'Triggered Follow-Up',
              })
            );
          } else {
            const triggerAt = new Date(
              safeNowMs + rule.delayHours * 3600 * 1000
            ).toISOString();
            newlyScheduled.push({
              id: `sfu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              parentQuestId: quest.id,
              parentQuestTitle: quest.title,
              parentOutcomeText: quest.outcomeText,
              parentReferences: quest.references
                ? quest.references.map((r) => ({ ...r }))
                : undefined,
              title: rule.title,
              notes: rule.notes,
              category: rule.category,
              priority: rule.priority,
              xpReward: rule.xpReward,
              coinReward: rule.coinReward,
              createdAt: nowIso,
              triggerAt,
            });
          }
          return {
            ...rule,
            triggeredAt: nowIso,
          };
        })
      : quest.followUpRules;

  const updatedQuests = state.quests.map((q) =>
    q.id === questId
      ? {
          ...q,
          completed: completing,
          completedAt: completing ? nowIso : undefined,
          followUpRules: nextFollowUpRules,
        }
      : q
  );

  return {
    completedNow: completing,
    xpDelta,
    coinDelta,
    boostUsed,
    immediateFollowUps,
    newlyScheduledCount: newlyScheduled.length,
    nextState: {
      ...state,
      xp: Math.max(0, state.xp + xpDelta),
      coins: Math.max(0, state.coins + coinDelta),
      quests: [...immediateFollowUps, ...updatedQuests],
      scheduledFollowUps: orderScheduledFollowUps([
        ...state.scheduledFollowUps,
        ...newlyScheduled,
      ]),
      questsCompletedToday: Math.max(
        0,
        state.questsCompletedToday + (completing ? 1 : -1)
      ),
      doubleXpCharges: boostUsed
        ? Math.max(0, state.doubleXpCharges - 1)
        : state.doubleXpCharges,
    },
  };
}

export function toggleHabitDayState(
  state: AppState,
  habitId: string,
  dateKey: string
): { nextState: AppState; checkedNow: boolean; isToday: boolean } {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return { nextState: state, checkedNow: false, isToday: false };

  const todayKey = formatDateKey(new Date());
  const nextVal = !habit.history[dateKey];
  const isToday = dateKey === todayKey;
  const xpDelta = isToday ? (nextVal ? habit.xpReward : -habit.xpReward) : 0;
  const coinDelta = isToday ? (nextVal ? habit.coinReward : -habit.coinReward) : 0;

  const updatedHabits = state.habits.map((h) =>
    h.id === habitId
      ? { ...h, history: { ...h.history, [dateKey]: nextVal } }
      : h
  );

  const todayCount = updatedHabits.filter((h) => h.history[todayKey]).length;

  return {
    checkedNow: nextVal,
    isToday,
    nextState: {
      ...state,
      xp: Math.max(0, state.xp + xpDelta),
      coins: Math.max(0, state.coins + coinDelta),
      habits: updatedHabits,
      habitsCheckedToday: todayCount,
    },
  };
}
