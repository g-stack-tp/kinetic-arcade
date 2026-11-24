import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import {
  AiModelId,
  AppState,
  AvatarEmblem,
  AvatarTone,
  BossCommitment,
  BossDraft,
  FocusSession,
  HabitDraft,
  Quest,
  QuestCategory,
  QuestDraft,
  QuestPriority,
  QuestReference,
  ScreenId,
  ToastEvent,
} from './types';
import {
  createInitialState,
  createStudyPresetState,
  formatDateKey,
  getLevelInfo,
} from './data/initialData';
import {
  addQuestFollowUpRuleState,
  approveAllHabitDraftsState,
  approveAllQuestDraftsState,
  approveBossDraftState,
  approveHabitDraftState,
  approveQuestDraftState,
  claimBossBountyState,
  clearBossEncounterState,
  clearCompletedQuestsState,
  clearHabitDraftsState,
  clearQuestDraftsState,
  createBossEncounterState,
  deferBossEncounterState,
  deleteArchivedRaidState,
  discardBossDraftState,
  discardDeferredRaidState,
  discardHabitDraftState,
  discardQuestDraftState,
  discardScheduledFollowUpState,
  evaluateScheduledFollowUpsState,
  getAiModelLabel,
  hydrateWorkspaceState,
  parseAndHydrateWorkspaceJson,
  purgeWorkspaceState,
  removeQuestFollowUpRuleState,
  resumeDeferredRaidState,
  stageBossDraftState,
  stageHabitDraftsState,
  stageQuestDraftsState,
  toggleBossCommitmentState,
  toggleBossStepOptionalState,
  toggleBossStepState,
  toggleHabitDayState,
  toggleQuestCompletionState,
  triggerScheduledFollowUpNowState,
  updateBossDraftState,
  updateBossRaidDebriefState,
  updateBossStepOutcomeState,
  updateHabitDraftState,
  updateQuestDraftState,
  updateQuestOutcomeState,
} from './utils/workspaceState';
import {
  fetchAiBossDraft,
  fetchAiHabitDrafts,
  fetchAiQuestDrafts,
} from './utils/aiClient';
import { arcadeSound } from './utils/sound';
import { TopBar } from './components/TopBar';
import { PlayerRail } from './components/PlayerRail';
import { QuestBoardScreen } from './components/QuestBoardScreen';
import { HabitsScreen } from './components/HabitsScreen';
import { FocusArenaScreen } from './components/FocusArenaScreen';
import { RewardVaultScreen } from './components/RewardVaultScreen';
import {
  ExperiencePresetId,
  ExperienceScreen,
} from './components/ExperienceScreen';
import { NewQuestModal } from './components/NewQuestModal';

const STORAGE_KEY = 'kinetic_arcade_workspace_v1';

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed && Array.isArray(parsed.quests)) {
        return hydrateWorkspaceState(parsed);
      }
    }
  } catch {
    // Fallback to initial demo state
  }
  return createInitialState();
}

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [activeScreen, setActiveScreen] = useState<ScreenId>('quests');
  const [isNewQuestOpen, setIsNewQuestOpen] = useState(false);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [streakPulseKey, setStreakPulseKey] = useState(0);
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  // AI loading & error states (strictly transient UI feedback)
  const [questAiLoading, setQuestAiLoading] = useState(false);
  const [questAiError, setQuestAiError] = useState<string | null>(null);
  const [habitAiLoading, setHabitAiLoading] = useState(false);
  const [habitAiError, setHabitAiError] = useState<string | null>(null);
  const [bossAiLoading, setBossAiLoading] = useState(false);
  const [bossAiError, setBossAiError] = useState<string | null>(null);

  // Global Focus Timer State
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(
    () => state.defaultSprintMinutes || 25
  );
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(
    () => (state.defaultSprintMinutes || 25) * 60
  );
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusQuestId, setFocusQuestId] = useState('');

  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  const pushToast = useCallback(
    (title: string, detail: string, tone: ToastEvent['tone'] = 'indigo') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, detail, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  const checkLevelPromotion = useCallback(
    (prevXp: number, nextXp: number, soundEnabled: boolean) => {
      const prevLevel = getLevelInfo(prevXp).level;
      const nextLevel = getLevelInfo(nextXp).level;
      if (nextLevel > prevLevel) {
        arcadeSound.playLevelUp(soundEnabled);
        window.setTimeout(() => {
          pushToast(
            `Level ${nextLevel} Reached`,
            `Rank promoted to ${getLevelInfo(nextXp).rankTitle}`,
            'indigo'
          );
        }, 120);
      }
    },
    [pushToast]
  );

  const applyXpAndCoins = useCallback(
    (deltaXp: number, deltaCoins: number, extra?: Partial<AppState>) => {
      setState((prev) => {
        const nextXp = Math.max(0, prev.xp + deltaXp);
        const nextCoins = Math.max(0, prev.coins + deltaCoins);
        checkLevelPromotion(prev.xp, nextXp, prev.soundEnabled);
        return {
          ...prev,
          ...extra,
          xp: nextXp,
          coins: nextCoins,
        };
      });
    },
    [checkLevelPromotion]
  );

  const finalizeFocusSprint = useCallback(
    (minutesLogged: number) => {
      const safeMinutes = Math.max(1, minutesLogged);
      const earnedXp = Math.max(20, Math.round(safeMinutes * 2.5));
      const earnedCoins = Math.max(6, Math.round(safeMinutes * 0.6));
      const linkedQuest = stateRef.current.quests.find((q) => q.id === focusQuestId);

      const newSession: FocusSession = {
        id: `fs-${Date.now()}`,
        questId: linkedQuest?.id,
        questTitle: linkedQuest?.title || 'Deep Work Sprint',
        durationMinutes: safeMinutes,
        xpEarned: earnedXp,
        coinsEarned: earnedCoins,
        completedAt: new Date().toISOString(),
      };

      arcadeSound.playTimerBell(stateRef.current.soundEnabled);
      applyXpAndCoins(earnedXp, earnedCoins, {
        focusMinutesToday: stateRef.current.focusMinutesToday + safeMinutes,
        focusSessions: [newSession, ...stateRef.current.focusSessions].slice(0, 20),
      });
      pushToast(
        `${safeMinutes}m Focus Sprint Logged`,
        `+${earnedXp} XP · +${earnedCoins} Coins`,
        'indigo'
      );

      setFocusRunning(false);
      setFocusSecondsLeft(focusDurationMinutes * 60);
    },
    [applyXpAndCoins, focusDurationMinutes, focusQuestId, pushToast]
  );

  // Countdown tick
  useEffect(() => {
    if (!focusRunning) return;
    const interval = window.setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          finalizeFocusSprint(focusDurationMinutes);
          return focusDurationMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusRunning, focusDurationMinutes, finalizeFocusSprint]);

  // Evaluate deferred scheduled follow-ups on mount and every 30s
  useEffect(() => {
    const checkDueFollowUps = () => {
      const current = stateRef.current;
      if (current.scheduledFollowUps.length === 0) return;
      const { nextState, activatedQuests } = evaluateScheduledFollowUpsState(current);
      if (activatedQuests.length === 0) return;
      setState(nextState);
      pushToast(
        `${activatedQuests.length} Follow-Up Quest${activatedQuests.length === 1 ? '' : 's'} Triggered`,
        activatedQuests.map((q) => q.title).join(', '),
        'indigo'
      );
    };

    checkDueFollowUps();
    const interval = window.setInterval(checkDueFollowUps, 30000);
    return () => window.clearInterval(interval);
  }, [pushToast]);

  // AI Draft & HITL Handlers
  const handleRequestAiQuests = async (mode: 'aligned' | 'parse', inputText: string) => {
    setQuestAiLoading(true);
    setQuestAiError(null);
    try {
      const { drafts, modelUsed, fallbackUsed } = await fetchAiQuestDrafts({
        mode,
        inputText,
        model: state.aiModel,
        autoFallback: state.aiAutoFallback,
        profile: {
          playerName: state.playerName,
          playerRole: state.playerRole,
          dailyFocusGoalMinutes: state.dailyFocusGoalMinutes,
        },
        activeQuestTitles: state.quests.filter((q) => !q.completed).map((q) => q.title),
        bossTitle: state.boss?.title,
      });

      if (drafts.length === 0) {
        setQuestAiError('No quest drafts could be extracted. Try adding a little more detail.');
      } else {
        setState((prev) => stageQuestDraftsState(prev, drafts));
        pushToast(
          `${drafts.length} Draft${drafts.length === 1 ? '' : 's'} Staged`,
          fallbackUsed && modelUsed
            ? `Drafted via ${getAiModelLabel(modelUsed)} fallback · review in tray.`
            : 'Review, edit, or approve to commit to Quest Board.',
          'indigo'
        );
      }
    } catch (err) {
      setQuestAiError(
        err instanceof Error ? err.message : 'Unable to reach AI suggestion service.'
      );
    } finally {
      setQuestAiLoading(false);
    }
  };

  const handleEditQuestDraft = (draftId: string, patch: Partial<QuestDraft>) => {
    setState((prev) => updateQuestDraftState(prev, draftId, patch));
  };

  const handleApproveQuestDraft = (draftId: string) => {
    const result = approveQuestDraftState(state, draftId);
    if (!result.approvedQuest) return;
    arcadeSound.playQuestComplete(state.soundEnabled);
    setState(result.nextState);
    pushToast(
      'Draft Approved to Actuals',
      `${result.approvedQuest.title} (+${result.approvedQuest.xpReward} XP)`,
      'emerald'
    );
  };

  const handleApproveAllQuestDrafts = () => {
    const result = approveAllQuestDraftsState(state);
    if (result.approvedCount === 0) return;
    arcadeSound.playQuestComplete(state.soundEnabled);
    setState(result.nextState);
    pushToast(
      `Approved ${result.approvedCount} Quests`,
      'All reviewed drafts committed to Quest Board.',
      'emerald'
    );
  };

  const handleDiscardQuestDraft = (draftId: string) => {
    setState((prev) => discardQuestDraftState(prev, draftId));
  };

  const handleClearQuestDrafts = () => {
    setState((prev) => clearQuestDraftsState(prev));
    setQuestAiError(null);
  };

  // AI Habit Draft & HITL Handlers
  const handleRequestAiHabits = async (mode: 'aligned' | 'parse', inputText: string) => {
    setHabitAiLoading(true);
    setHabitAiError(null);
    try {
      const { drafts, modelUsed, fallbackUsed } = await fetchAiHabitDrafts({
        mode,
        inputText,
        model: state.aiModel,
        autoFallback: state.aiAutoFallback,
        profile: {
          playerName: state.playerName,
          playerRole: state.playerRole,
          dailyFocusGoalMinutes: state.dailyFocusGoalMinutes,
        },
        activeHabitTitles: state.habits.map((h) => h.title),
        activeQuestTitles: state.quests.filter((q) => !q.completed).map((q) => q.title),
      });

      if (drafts.length === 0) {
        setHabitAiError('No habit drafts could be extracted. Try adding a bit more detail.');
      } else {
        setState((prev) => stageHabitDraftsState(prev, drafts));
        pushToast(
          `${drafts.length} Habit Draft${drafts.length === 1 ? '' : 's'} Staged`,
          fallbackUsed && modelUsed
            ? `Drafted via ${getAiModelLabel(modelUsed)} fallback · review before approving.`
            : 'Review, edit, or approve to add to your 7-day cadence.',
          'indigo'
        );
      }
    } catch (err) {
      setHabitAiError(
        err instanceof Error ? err.message : 'Unable to reach AI habit suggestion service.'
      );
    } finally {
      setHabitAiLoading(false);
    }
  };

  const handleEditHabitDraft = (draftId: string, patch: Partial<HabitDraft>) => {
    setState((prev) => updateHabitDraftState(prev, draftId, patch));
  };

  const handleApproveHabitDraft = (draftId: string) => {
    const result = approveHabitDraftState(state, draftId);
    if (!result.approvedHabit) return;
    arcadeSound.playQuestComplete(state.soundEnabled);
    setState(result.nextState);
    pushToast(
      'Habit Approved to Actuals',
      `${result.approvedHabit.title} (${result.approvedHabit.targetDaysPerWeek}x/wk)`,
      'emerald'
    );
  };

  const handleApproveAllHabitDrafts = () => {
    const result = approveAllHabitDraftsState(state);
    if (result.approvedCount === 0) return;
    arcadeSound.playQuestComplete(state.soundEnabled);
    setState(result.nextState);
    pushToast(
      `Approved ${result.approvedCount} Habits`,
      'All reviewed habit drafts added to your matrix.',
      'emerald'
    );
  };

  const handleDiscardHabitDraft = (draftId: string) => {
    setState((prev) => discardHabitDraftState(prev, draftId));
  };

  const handleClearHabitDrafts = () => {
    setState((prev) => clearHabitDraftsState(prev));
    setHabitAiError(null);
  };

  const handleRequestAiBoss = async (goalText: string) => {
    setBossAiLoading(true);
    setBossAiError(null);
    try {
      const { draft, modelUsed, fallbackUsed } = await fetchAiBossDraft({
        goalText,
        model: state.aiModel,
        autoFallback: state.aiAutoFallback,
        profile: {
          playerName: state.playerName,
          playerRole: state.playerRole,
          dailyFocusGoalMinutes: state.dailyFocusGoalMinutes,
        },
        activeQuestTitles: state.quests.filter((q) => !q.completed).map((q) => q.title),
      });
      setState((prev) => stageBossDraftState(prev, draft));
      pushToast(
        'Boss Raid Draft Ready',
        fallbackUsed && modelUsed
          ? `Drafted via ${getAiModelLabel(modelUsed)} fallback · review gates before launching.`
          : 'Review and edit gates before launching.',
        'indigo'
      );
    } catch (err) {
      setBossAiError(
        err instanceof Error ? err.message : 'Unable to generate boss encounter draft.'
      );
    } finally {
      setBossAiLoading(false);
    }
  };

  const handleUpdateBossDraft = (patch: Partial<BossDraft>) => {
    setState((prev) => updateBossDraftState(prev, patch));
  };

  const handleApproveBossDraft = () => {
    const result = approveBossDraftState(state);
    if (!result.approved) return;
    arcadeSound.playQuestComplete(state.soundEnabled);
    setState(result.nextState);
    pushToast('Boss Encounter Launched', result.nextState.boss?.title || 'Raid active', 'emerald');
  };

  const handleDiscardBossDraft = () => {
    setState((prev) => discardBossDraftState(prev));
  };

  // Quest handlers
  const handleToggleQuest = (questId: string) => {
    const result = toggleQuestCompletionState(state, questId);
    if (result.nextState === state) return;

    if (result.completedNow) {
      arcadeSound.playQuestComplete(state.soundEnabled);
      setJustCompletedId(questId);
      window.setTimeout(() => setJustCompletedId(null), 500);
      pushToast(
        'Quest Cleared',
        `+${result.xpDelta} XP${result.boostUsed ? ' (2x Boost)' : ''} · +${result.coinDelta} Coins`,
        'emerald'
      );

      if (result.immediateFollowUps.length > 0) {
        pushToast(
          'Follow-Up Quest Spawned',
          result.immediateFollowUps.map((q) => q.title).join(', '),
          'indigo'
        );
      }
      if (result.newlyScheduledCount > 0) {
        pushToast(
          'Follow-Up Scheduled',
          `${result.newlyScheduledCount} deferred follow-up${result.newlyScheduledCount === 1 ? '' : 's'} queued.`,
          'indigo'
        );
      }
    }

    checkLevelPromotion(state.xp, result.nextState.xp, state.soundEnabled);
    setState(result.nextState);
  };

  const handleDeleteQuest = (questId: string) => {
    setState((prev) => ({
      ...prev,
      quests: prev.quests.filter((q) => q.id !== questId),
    }));
  };

  const handleClearCompletedQuests = (preserveWithOutcomeOrRefs = false) => {
    const { nextState, removedCount, preservedCount } = clearCompletedQuestsState(state, {
      preserveWithOutcomeOrRefs,
    });
    if (removedCount === 0) return;
    setState(nextState);
    pushToast(
      preserveWithOutcomeOrRefs ? 'Routine Quests Cleared' : 'Completed Quests Cleared',
      preservedCount > 0
        ? `Removed ${removedCount} routine quest${removedCount === 1 ? '' : 's'}; preserved ${preservedCount} with outcomes/refs.`
        : `Removed ${removedCount} finished quest${removedCount === 1 ? '' : 's'} from board.`,
      'indigo'
    );
  };

  const handleUpdateQuestOutcome = (
    questId: string,
    patch: { outcomeText?: string; references?: QuestReference[] }
  ) => {
    setState((prev) => updateQuestOutcomeState(prev, questId, patch));
    pushToast('Outcome & Refs Saved', 'Captured results preserved on quest.', 'emerald');
  };

  const handleAddQuestFollowUpRule = (
    questId: string,
    rule: {
      title: string;
      category: QuestCategory;
      priority: QuestPriority;
      delayHours: number;
    }
  ) => {
    setState((prev) => addQuestFollowUpRuleState(prev, questId, rule));
    pushToast(
      'Follow-Up Trigger Added',
      `${rule.title} (${rule.delayHours === 0 ? 'immediate' : `${rule.delayHours}h delay`})`,
      'indigo'
    );
  };

  const handleRemoveQuestFollowUpRule = (questId: string, ruleId: string) => {
    setState((prev) => removeQuestFollowUpRuleState(prev, questId, ruleId));
  };

  const handleRequestAiFollowUps = async (quest: Quest) => {
    setQuestAiLoading(true);
    setQuestAiError(null);
    try {
      const { drafts, modelUsed, fallbackUsed } = await fetchAiQuestDrafts({
        mode: 'followups',
        model: state.aiModel,
        autoFallback: state.aiAutoFallback,
        parentQuestId: quest.id,
        completedQuestTitle: quest.title,
        outcomeText: quest.outcomeText,
        references: quest.references,
        profile: {
          playerName: state.playerName,
          playerRole: state.playerRole,
          dailyFocusGoalMinutes: state.dailyFocusGoalMinutes,
        },
        activeQuestTitles: state.quests.filter((q) => !q.completed).map((q) => q.title),
        bossTitle: state.boss?.title,
      });

      if (drafts.length === 0) {
        setQuestAiError('No follow-up quests could be generated from this outcome.');
      } else {
        setState((prev) => stageQuestDraftsState(prev, drafts));
        pushToast(
          `${drafts.length} Follow-Up Draft${drafts.length === 1 ? '' : 's'} Staged`,
          fallbackUsed && modelUsed
            ? `From "${quest.title}" via ${getAiModelLabel(modelUsed)} fallback.`
            : `From "${quest.title}" · review in staging tray.`,
          'indigo'
        );
      }
    } catch (err) {
      setQuestAiError(
        err instanceof Error ? err.message : 'Unable to reach AI follow-up service.'
      );
    } finally {
      setQuestAiLoading(false);
    }
  };

  const handleTriggerScheduledFollowUpNow = (scheduledId: string) => {
    const result = triggerScheduledFollowUpNowState(state, scheduledId);
    if (!result.activatedQuest) return;
    arcadeSound.playQuestComplete(state.soundEnabled);
    setState(result.nextState);
    pushToast(
      'Follow-Up Quest Activated',
      `${result.activatedQuest.title} (+${result.activatedQuest.xpReward} XP)`,
      'emerald'
    );
  };

  const handleDiscardScheduledFollowUp = (scheduledId: string) => {
    setState((prev) => discardScheduledFollowUpState(prev, scheduledId));
    pushToast('Scheduled Follow-Up Cancelled', 'Removed from pending queue.', 'indigo');
  };

  const handleCreateQuest = (draft: Omit<Quest, 'id' | 'completed'>) => {
    const newQuest: Quest = {
      ...draft,
      id: `q-${Date.now()}`,
      completed: false,
    };
    setState((prev) => ({
      ...prev,
      quests: [newQuest, ...prev.quests],
    }));
    pushToast('Quest Added', `${newQuest.title} (+${newQuest.xpReward} XP)`, 'indigo');
  };

  const handleQuickAddQuest = (title: string, priority: QuestPriority) => {
    const xpMap: Record<QuestPriority, { xp: number; coins: number }> = {
      critical: { xp: 140, coins: 35 },
      focus: { xp: 90, coins: 24 },
      routine: { xp: 55, coins: 15 },
    };
    handleCreateQuest({
      title,
      category: 'Deep Work',
      priority,
      xpReward: xpMap[priority].xp,
      coinReward: xpMap[priority].coins,
      dueLabel: 'Today',
    });
  };

  // Boss handlers
  const handleCreateBoss = (
    title: string,
    subtitle: string,
    steps: string[],
    commitment: BossCommitment = 'required'
  ) => {
    const previousBoss = state.boss;
    setState((prev) =>
      createBossEncounterState(prev, title, subtitle, steps, { commitment })
    );
    const detail = previousBoss
      ? previousBoss.bountyClaimed
        ? `${title} · Previous raid archived to history.`
        : `${title} · Previous raid parked in Deferred.`
      : title;
    pushToast(
      commitment === 'optional' ? 'Optional Raid Launched' : 'Boss Encounter Launched',
      detail,
      commitment === 'optional' ? 'indigo' : 'coral'
    );
  };

  const handleToggleBossStep = (stepId: string) => {
    const targetStep = state.boss?.steps.find((s) => s.id === stepId);
    if (targetStep && !targetStep.completed) {
      arcadeSound.playQuestComplete(state.soundEnabled);
    }
    setState((prev) => toggleBossStepState(prev, stepId));
  };

  const handleToggleBossCommitment = () => {
    const nextIsOptional = state.boss?.commitment !== 'optional';
    setState((prev) => toggleBossCommitmentState(prev));
    pushToast(
      nextIsOptional ? 'Raid Marked Optional' : 'Raid Marked Core',
      nextIsOptional
        ? 'Stretch milestone — safe to defer anytime.'
        : 'Active core milestone commitment.',
      'indigo'
    );
  };

  const handleToggleBossStepOptional = (stepId: string) => {
    setState((prev) => toggleBossStepOptionalState(prev, stepId));
  };

  const handleClaimBossBounty = () => {
    const {
      nextState,
      claimed,
      bonusCoins,
      stretchBonusXp,
      stretchBonusCoins,
    } = claimBossBountyState(state);
    if (!claimed || !state.boss) return;
    arcadeSound.playLevelUp(state.soundEnabled);
    checkLevelPromotion(state.xp, nextState.xp, state.soundEnabled);
    setState(nextState);
    const totalXp = state.boss.rewardXp + stretchBonusXp;
    const totalCoins = state.boss.rewardCoins + bonusCoins + stretchBonusCoins;
    pushToast(
      'Boss Raid Bounty Claimed',
      `+${totalXp} XP · +${totalCoins} Coins${
        bonusCoins > 0 || stretchBonusCoins > 0 ? ' (with bonuses)' : ''
      }`,
      'amber'
    );
  };

  const handleUpdateBossStepOutcome = (
    stepId: string,
    patch: { outcomeText?: string; references?: QuestReference[] }
  ) => {
    setState((prev) => updateBossStepOutcomeState(prev, stepId, patch));
    pushToast('Gate Evidence Saved', 'Outcome & references attached to raid gate.', 'emerald');
  };

  const handleUpdateBossRaidDebrief = (patch: {
    raidOutcomeText?: string;
    raidReferences?: QuestReference[];
  }) => {
    setState((prev) => updateBossRaidDebriefState(prev, patch));
    pushToast('Raid Debrief Saved', 'Milestone summary & ship references preserved.', 'emerald');
  };

  const handleDeferBoss = (options: { delayHours: number; reason?: string }) => {
    const result = deferBossEncounterState(state, options);
    if (!result.deferredRaid) return;
    setState(result.nextState);
    pushToast(
      'Raid Deferred',
      `${result.deferredRaid.title} parked${
        options.delayHours > 0 ? ` (${options.delayHours}h)` : ' for later'
      }.`,
      'indigo'
    );
  };

  const handleResumeDeferredRaid = (raidId: string) => {
    const result = resumeDeferredRaidState(state, raidId);
    if (!result.resumedRaid) return;
    setState(result.nextState);
    pushToast(
      'Raid Resumed',
      result.autoDeferredCurrent
        ? `${result.resumedRaid.title} active · previous raid parked safely.`
        : `${result.resumedRaid.title} is now active.`,
      'emerald'
    );
  };

  const handleDiscardDeferredRaid = (raidId: string) => {
    setState((prev) => discardDeferredRaidState(prev, raidId));
    pushToast('Deferred Raid Removed', 'Removed from parked raids.', 'indigo');
  };

  const handleClearBoss = () => {
    const wasClaimed = Boolean(state.boss?.bountyClaimed);
    setState((prev) => clearBossEncounterState(prev));
    pushToast(
      wasClaimed ? 'Raid Archived to History' : 'Boss Encounter Cleared',
      wasClaimed
        ? 'Saved in Shipped Boss Raids. Start your next raid anytime.'
        : 'You can start or draft a new raid anytime.',
      wasClaimed ? 'emerald' : 'indigo'
    );
  };

  const handleDeleteArchivedRaid = (raidId: string) => {
    setState((prev) => deleteArchivedRaidState(prev, raidId));
    pushToast('Archived Raid Removed', 'Removed from Shipped Boss Raids.', 'indigo');
  };

  // Bounty handler
  const handleClaimBounty = (bountyId: string) => {
    const bounty = state.bounties.find((b) => b.id === bountyId);
    if (!bounty || bounty.claimed) return;

    arcadeSound.playCoinClaim(state.soundEnabled);
    applyXpAndCoins(bounty.xpReward, bounty.coinReward, {
      bounties: state.bounties.map((b) =>
        b.id === bountyId ? { ...b, claimed: true } : b
      ),
    });
    pushToast(
      `Bounty Claimed: ${bounty.title}`,
      `+${bounty.xpReward} XP · +${bounty.coinReward} Coins`,
      'amber'
    );
  };

  // Habit handlers
  const handleToggleHabitDay = (habitId: string, dateKey: string) => {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const { nextState, checkedNow, isToday } = toggleHabitDayState(state, habitId, dateKey);

    if (checkedNow) {
      arcadeSound.playQuestComplete(state.soundEnabled);
      setStreakPulseKey((k) => k + 1);
      if (isToday) {
        pushToast(
          'Habit Checked In',
          `+${habit.xpReward} XP · +${habit.coinReward} Coins`,
          'emerald'
        );
      }
    }

    checkLevelPromotion(state.xp, nextState.xp, state.soundEnabled);
    setState(nextState);
  };

  const handleAddHabit = (title: string, category: string, targetDaysPerWeek: number) => {
    setState((prev) => ({
      ...prev,
      habits: [
        ...prev.habits,
        {
          id: `h-${Date.now()}`,
          title,
          category,
          xpReward: 35,
          coinReward: 10,
          targetDaysPerWeek,
          history: {},
        },
      ],
    }));
    pushToast('Habit Added', title, 'emerald');
  };

  const handleDeleteHabit = (habitId: string) => {
    const todayKey = formatDateKey(new Date());
    setState((prev) => {
      const nextHabits = prev.habits.filter((h) => h.id !== habitId);
      return {
        ...prev,
        habits: nextHabits,
        habitsCheckedToday: nextHabits.filter((h) => h.history[todayKey]).length,
      };
    });
  };

  // Vault handlers
  const handleRedeemReward = (rewardId: string) => {
    const reward = state.rewards.find((r) => r.id === rewardId);
    if (!reward || state.coins < reward.costCoins) return;

    arcadeSound.playCoinClaim(state.soundEnabled);
    const redeemedItem = {
      id: `rr-${Date.now()}`,
      rewardId: reward.id,
      title: reward.title,
      kind: reward.kind,
      redeemedAt: new Date().toISOString(),
      used: reward.kind !== 'treat',
    };

    setState((prev) => ({
      ...prev,
      coins: prev.coins - reward.costCoins,
      doubleXpCharges:
        reward.kind === 'boost' ? prev.doubleXpCharges + 3 : prev.doubleXpCharges,
      streakShields:
        reward.kind === 'shield' ? prev.streakShields + 1 : prev.streakShields,
      redeemedRewards: [redeemedItem, ...prev.redeemedRewards],
    }));

    pushToast('Reward Redeemed', reward.title, 'amber');
  };

  const handleUseRedeemedReward = (redeemedId: string) => {
    setState((prev) => ({
      ...prev,
      redeemedRewards: prev.redeemedRewards.map((r) =>
        r.id === redeemedId ? { ...r, used: true } : r
      ),
    }));
    pushToast('Break Claimed', 'Enjoy your earned reward!', 'emerald');
  };

  const handleCreateReward = (title: string, description: string, costCoins: number) => {
    setState((prev) => ({
      ...prev,
      rewards: [
        {
          id: `r-${Date.now()}`,
          title,
          description,
          costCoins,
          kind: 'treat',
          isCustom: true,
        },
        ...prev.rewards,
      ],
    }));
    pushToast('Custom Reward Added', `${title} (${costCoins} Coins)`, 'indigo');
  };

  // Focus Arena handlers
  const handleStartFocusOnQuest = (quest: Quest) => {
    setFocusQuestId(quest.id);
    setActiveScreen('focus');
  };

  const handleSelectDuration = (minutes: number) => {
    setFocusRunning(false);
    setFocusDurationMinutes(minutes);
    setFocusSecondsLeft(minutes * 60);
  };

  const handleCompleteFocusEarly = () => {
    const elapsedSeconds = focusDurationMinutes * 60 - focusSecondsLeft;
    const elapsedMins =
      elapsedSeconds >= 60 ? Math.round(elapsedSeconds / 60) : focusDurationMinutes;
    finalizeFocusSprint(elapsedMins);
  };

  // Experience & Personalization handlers
  const handleUpdateProfile = (updates: {
    playerName: string;
    playerRole: string;
    avatarEmblem: AvatarEmblem;
    avatarTone: AvatarTone;
    dailyFocusGoalMinutes: number;
    defaultSprintMinutes: number;
    soundEnabled: boolean;
  }) => {
    setState((prev) => ({
      ...prev,
      ...updates,
    }));
    if (!focusRunning) {
      setFocusDurationMinutes(updates.defaultSprintMinutes);
      setFocusSecondsLeft(updates.defaultSprintMinutes * 60);
    }
    pushToast('Profile Saved', `${updates.playerName} · ${updates.playerRole}`, 'indigo');
  };

  const handleUpdateAiSettings = (updates: {
    aiModel: AiModelId;
    aiAutoFallback: boolean;
  }) => {
    setState((prev) => ({
      ...prev,
      aiModel: updates.aiModel,
      aiAutoFallback: updates.aiAutoFallback,
    }));
    setQuestAiError(null);
    setHabitAiError(null);
    setBossAiError(null);
    pushToast(
      'AI Model Updated',
      `${getAiModelLabel(updates.aiModel)} · Auto-fallback ${updates.aiAutoFallback ? 'On' : 'Off'}`,
      'indigo'
    );
  };

  const handleLoadPreset = (preset: ExperiencePresetId) => {
    let nextState: AppState;
    if (preset === 'product') {
      nextState = {
        ...createInitialState(),
        aiModel: state.aiModel,
        aiAutoFallback: state.aiAutoFallback,
      };
    } else if (preset === 'study') {
      nextState = createStudyPresetState({
        playerName: state.playerName,
        playerRole: state.playerRole,
        avatarEmblem: state.avatarEmblem,
        avatarTone: state.avatarTone,
        soundEnabled: state.soundEnabled,
        aiModel: state.aiModel,
        aiAutoFallback: state.aiAutoFallback,
      });
    } else {
      nextState = purgeWorkspaceState(state, true);
    }

    setState(nextState);
    setQuestAiError(null);
    setHabitAiError(null);
    setBossAiError(null);
    setFocusRunning(false);
    setFocusDurationMinutes(nextState.defaultSprintMinutes);
    setFocusSecondsLeft(nextState.defaultSprintMinutes * 60);
    setFocusQuestId('');

    const label =
      preset === 'product'
        ? 'Product Launch Sprint'
        : preset === 'study'
          ? 'Deep Study & Research'
          : 'Fresh Level 1 Starter';
    pushToast('Experience Loaded', label, 'emerald');
  };

  const handleImportState = (jsonText: string): { ok: boolean; error?: string } => {
    const result = parseAndHydrateWorkspaceJson(jsonText);
    if (!result.ok || !result.state) {
      return { ok: false, error: result.error };
    }
    setState(result.state);
    setFocusRunning(false);
    setFocusDurationMinutes(result.state.defaultSprintMinutes);
    setFocusSecondsLeft(result.state.defaultSprintMinutes * 60);
    setFocusQuestId('');
    pushToast('Workspace Imported', `Loaded ${result.state.playerName}'s data`, 'emerald');
    return { ok: true };
  };

  const handlePurgeData = (keepPersonalization: boolean) => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage clear errors
    }

    const nextState = purgeWorkspaceState(state, keepPersonalization);
    setState(nextState);
    setQuestAiError(null);
    setHabitAiError(null);
    setBossAiError(null);
    setFocusRunning(false);
    setFocusDurationMinutes(nextState.defaultSprintMinutes);
    setFocusSecondsLeft(nextState.defaultSprintMinutes * 60);
    setFocusQuestId('');
    pushToast(
      'Workspace Purged',
      keepPersonalization
        ? 'Cleared quests, drafts, boss raid, habits, XP, and coins.'
        : 'Cleared all activity and profile data.',
      'coral'
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8ff] text-[#131b2e]">
      <TopBar
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
        onOpenNewQuest={() => setIsNewQuestOpen(true)}
      />

      {/* Main 12-Column Responsive Shell */}
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Primary 8-Column Track */}
          <div className="lg:col-span-8">
            {activeScreen === 'quests' && (
              <QuestBoardScreen
                state={state}
                justCompletedId={justCompletedId}
                questAiLoading={questAiLoading}
                questAiError={questAiError}
                bossAiLoading={bossAiLoading}
                bossAiError={bossAiError}
                onToggleQuest={handleToggleQuest}
                onDeleteQuest={handleDeleteQuest}
                onClearCompletedQuests={handleClearCompletedQuests}
                onQuickAddQuest={handleQuickAddQuest}
                onUpdateQuestOutcome={handleUpdateQuestOutcome}
                onAddQuestFollowUpRule={handleAddQuestFollowUpRule}
                onRemoveQuestFollowUpRule={handleRemoveQuestFollowUpRule}
                onRequestAiFollowUps={handleRequestAiFollowUps}
                onTriggerScheduledFollowUpNow={handleTriggerScheduledFollowUpNow}
                onDiscardScheduledFollowUp={handleDiscardScheduledFollowUp}
                onRequestAiQuests={handleRequestAiQuests}
                onEditQuestDraft={handleEditQuestDraft}
                onApproveQuestDraft={handleApproveQuestDraft}
                onApproveAllQuestDrafts={handleApproveAllQuestDrafts}
                onDiscardQuestDraft={handleDiscardQuestDraft}
                onClearQuestDrafts={handleClearQuestDrafts}
                onRequestAiBoss={handleRequestAiBoss}
                onUpdateBossDraft={handleUpdateBossDraft}
                onApproveBossDraft={handleApproveBossDraft}
                onDiscardBossDraft={handleDiscardBossDraft}
                onCreateBoss={handleCreateBoss}
                onToggleBossStep={handleToggleBossStep}
                onToggleBossCommitment={handleToggleBossCommitment}
                onToggleBossStepOptional={handleToggleBossStepOptional}
                onUpdateBossStepOutcome={handleUpdateBossStepOutcome}
                onUpdateBossRaidDebrief={handleUpdateBossRaidDebrief}
                onDeferBoss={handleDeferBoss}
                onResumeDeferredRaid={handleResumeDeferredRaid}
                onDiscardDeferredRaid={handleDiscardDeferredRaid}
                onClaimBossBounty={handleClaimBossBounty}
                onClearBoss={handleClearBoss}
                onDeleteArchivedRaid={handleDeleteArchivedRaid}
                onStartFocusOnQuest={handleStartFocusOnQuest}
                onOpenNewQuestModal={() => setIsNewQuestOpen(true)}
              />
            )}

            {activeScreen === 'habits' && (
              <HabitsScreen
                state={state}
                habitAiLoading={habitAiLoading}
                habitAiError={habitAiError}
                onToggleHabitDay={handleToggleHabitDay}
                onAddHabit={handleAddHabit}
                onDeleteHabit={handleDeleteHabit}
                onRequestAiHabits={handleRequestAiHabits}
                onEditHabitDraft={handleEditHabitDraft}
                onApproveHabitDraft={handleApproveHabitDraft}
                onApproveAllHabitDrafts={handleApproveAllHabitDrafts}
                onDiscardHabitDraft={handleDiscardHabitDraft}
                onClearHabitDrafts={handleClearHabitDrafts}
              />
            )}

            {activeScreen === 'focus' && (
              <FocusArenaScreen
                state={state}
                durationMinutes={focusDurationMinutes}
                secondsLeft={focusSecondsLeft}
                isRunning={focusRunning}
                selectedQuestId={focusQuestId}
                onSelectDuration={handleSelectDuration}
                onSelectQuest={setFocusQuestId}
                onToggleRun={() => setFocusRunning((r) => !r)}
                onResetTimer={() => {
                  setFocusRunning(false);
                  setFocusSecondsLeft(focusDurationMinutes * 60);
                }}
                onCompleteEarly={handleCompleteFocusEarly}
              />
            )}

            {activeScreen === 'vault' && (
              <RewardVaultScreen
                state={state}
                onRedeemReward={handleRedeemReward}
                onUseRedeemedReward={handleUseRedeemedReward}
                onCreateReward={handleCreateReward}
              />
            )}

            {activeScreen === 'experience' && (
              <ExperienceScreen
                state={state}
                onUpdateProfile={handleUpdateProfile}
                onUpdateAiSettings={handleUpdateAiSettings}
                onLoadPreset={handleLoadPreset}
                onImportState={handleImportState}
                onPurgeData={handlePurgeData}
              />
            )}
          </div>

          {/* 4-Column Telemetry & Player Rail */}
          <div className="lg:col-span-4">
            <PlayerRail
              state={state}
              timerRunning={focusRunning}
              timerSecondsLeft={focusSecondsLeft}
              streakPulseKey={streakPulseKey}
              onClaimBounty={handleClaimBounty}
              onNavigate={setActiveScreen}
            />
          </div>
        </div>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-[#e8ebf8] bg-white/70">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs text-[#464554] sm:px-6 lg:px-8">
          <p className="font-semibold text-[#131b2e]">
            Kinetic Arcade · Tactile Productivity Workspace
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() =>
                setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))
              }
              className="inline-flex items-center gap-1.5 font-semibold hover:text-[#131b2e] cursor-pointer"
            >
              {state.soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5 text-[#4648d4]" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-[#767586]" />
              )}
              <span>{state.soundEnabled ? 'Sound On' : 'Sound Muted'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('experience')}
              className="inline-flex items-center gap-1.5 font-semibold hover:text-[#131b2e] cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Experience &amp; Data</span>
            </button>
          </div>
        </div>
      </footer>

      {/* New Quest Modal */}
      <NewQuestModal
        isOpen={isNewQuestOpen}
        onClose={() => setIsNewQuestOpen(false)}
        onCreateQuest={handleCreateQuest}
      />

      {/* Floating Dopamine Feedback Toasts */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2.5"
      >
        {toasts.map((toast) => {
          const accentBorder =
            toast.tone === 'amber'
              ? 'border-[#f59e0b]'
              : toast.tone === 'emerald'
                ? 'border-[#10b981]'
                : toast.tone === 'coral'
                  ? 'border-[#f43f5e]'
                  : 'border-[#4648d4]';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border ${accentBorder} bg-white/95 px-4 py-3 shadow-[0_12px_24px_-4px_rgba(70,72,212,0.16)] backdrop-blur-md`}
            >
              <p className="text-xs font-extrabold text-[#131b2e]">{toast.title}</p>
              <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[#464554]">
                {toast.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
