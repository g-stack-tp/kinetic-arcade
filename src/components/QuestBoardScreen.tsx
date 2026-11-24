import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Link2,
  Loader2,
  Play,
  Plus,
  Search,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  AppState,
  BossCommitment,
  BossDraft,
  BossEncounter,
  BossStep,
  Quest,
  QuestCategory,
  QuestDraft,
  QuestPriority,
  QuestReference,
} from '../types';
import {
  bossHasEvidence,
  computeBossDocumentationBonus,
  filterAndOrderQuests,
  getAiModelLabel,
  getBossProgress,
  getDueDeferredRaids,
  inferReferenceKind,
  orderBossSteps,
  orderDeferredRaids,
  orderScheduledFollowUps,
  questHasOutcomeOrReferences,
  QuestFilterMode,
  sanitizeReferenceUrl,
} from '../utils/workspaceState';

interface QuestBoardScreenProps {
  state: AppState;
  justCompletedId: string | null;
  questAiLoading: boolean;
  questAiError: string | null;
  bossAiLoading: boolean;
  bossAiError: string | null;
  onToggleQuest: (questId: string) => void;
  onDeleteQuest: (questId: string) => void;
  onClearCompletedQuests: (preserveWithOutcomeOrRefs?: boolean) => void;
  onQuickAddQuest: (title: string, priority: QuestPriority) => void;
  onUpdateQuestOutcome: (
    questId: string,
    patch: { outcomeText?: string; references?: QuestReference[] }
  ) => void;
  onAddQuestFollowUpRule: (
    questId: string,
    rule: {
      title: string;
      category: QuestCategory;
      priority: QuestPriority;
      delayHours: number;
    }
  ) => void;
  onRemoveQuestFollowUpRule: (questId: string, ruleId: string) => void;
  onRequestAiFollowUps: (quest: Quest) => void;
  onTriggerScheduledFollowUpNow: (scheduledId: string) => void;
  onDiscardScheduledFollowUp: (scheduledId: string) => void;
  onRequestAiQuests: (mode: 'aligned' | 'parse', inputText: string) => void;
  onEditQuestDraft: (draftId: string, patch: Partial<QuestDraft>) => void;
  onApproveQuestDraft: (draftId: string) => void;
  onApproveAllQuestDrafts: () => void;
  onDiscardQuestDraft: (draftId: string) => void;
  onClearQuestDrafts: () => void;
  onRequestAiBoss: (goalText: string) => void;
  onUpdateBossDraft: (patch: Partial<BossDraft>) => void;
  onApproveBossDraft: () => void;
  onDiscardBossDraft: () => void;
  onCreateBoss: (
    title: string,
    subtitle: string,
    steps: string[],
    commitment?: BossCommitment
  ) => void;
  onToggleBossStep: (stepId: string) => void;
  onToggleBossCommitment: () => void;
  onToggleBossStepOptional: (stepId: string) => void;
  onUpdateBossStepOutcome: (
    stepId: string,
    patch: { outcomeText?: string; references?: QuestReference[] }
  ) => void;
  onUpdateBossRaidDebrief: (patch: {
    raidOutcomeText?: string;
    raidReferences?: QuestReference[];
  }) => void;
  onDeferBoss: (options: { delayHours: number; reason?: string }) => void;
  onResumeDeferredRaid: (raidId: string) => void;
  onDiscardDeferredRaid: (raidId: string) => void;
  onClaimBossBounty: () => void;
  onClearBoss: () => void;
  onDeleteArchivedRaid: (raidId: string) => void;
  onStartFocusOnQuest: (quest: Quest) => void;
  onOpenNewQuestModal: () => void;
}

const PRIORITY_STYLES: Record<QuestPriority, { label: string; textClass: string }> = {
  critical: { label: 'Critical', textClass: 'text-[#ba1a1a] font-bold' },
  focus: { label: 'Focus', textClass: 'text-[#4648d4] font-bold' },
  routine: { label: 'Routine', textClass: 'text-[#464554] font-semibold' },
};

const CATEGORIES: QuestCategory[] = [
  'Deep Work',
  'Engineering',
  'Design',
  'Writing',
  'Health',
];

export const QuestBoardScreen: React.FC<QuestBoardScreenProps> = ({
  state,
  justCompletedId,
  questAiLoading,
  questAiError,
  bossAiLoading,
  bossAiError,
  onToggleQuest,
  onDeleteQuest,
  onClearCompletedQuests,
  onQuickAddQuest,
  onUpdateQuestOutcome,
  onAddQuestFollowUpRule,
  onRemoveQuestFollowUpRule,
  onRequestAiFollowUps,
  onTriggerScheduledFollowUpNow,
  onDiscardScheduledFollowUp,
  onRequestAiQuests,
  onEditQuestDraft,
  onApproveQuestDraft,
  onApproveAllQuestDrafts,
  onDiscardQuestDraft,
  onClearQuestDrafts,
  onRequestAiBoss,
  onUpdateBossDraft,
  onApproveBossDraft,
  onDiscardBossDraft,
  onCreateBoss,
  onToggleBossStep,
  onToggleBossCommitment,
  onToggleBossStepOptional,
  onUpdateBossStepOutcome,
  onUpdateBossRaidDebrief,
  onDeferBoss,
  onResumeDeferredRaid,
  onDiscardDeferredRaid,
  onClaimBossBounty,
  onClearBoss,
  onDeleteArchivedRaid,
  onStartFocusOnQuest,
  onOpenNewQuestModal,
}) => {
  const [filter, setFilter] = useState<QuestFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<QuestPriority>('focus');

  // Outcome, reference & follow-up drawer state
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [outcomeDraftText, setOutcomeDraftText] = useState('');
  const [newRefLabel, setNewRefLabel] = useState('');
  const [newRefLocation, setNewRefLocation] = useState('');
  const [newFollowUpTitle, setNewFollowUpTitle] = useState('');
  const [newFollowUpPriority, setNewFollowUpPriority] = useState<QuestPriority>('focus');
  const [newFollowUpDelayHours, setNewFollowUpDelayHours] = useState(24);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  // Boss gate evidence, raid debrief & deferral state
  const [expandedBossStepId, setExpandedBossStepId] = useState<string | null>(null);
  const [bossStepOutcomeDraft, setBossStepOutcomeDraft] = useState('');
  const [bossStepRefLabel, setBossStepRefLabel] = useState('');
  const [bossStepRefLocation, setBossStepRefLocation] = useState('');
  const [showRaidDebrief, setShowRaidDebrief] = useState(false);
  const [raidOutcomeDraft, setRaidOutcomeDraft] = useState('');
  const [raidRefLabel, setRaidRefLabel] = useState('');
  const [raidRefLocation, setRaidRefLocation] = useState('');
  const [showDeferPanel, setShowDeferPanel] = useState(false);
  const [deferDelayHours, setDeferDelayHours] = useState(0);
  const [deferReason, setDeferReason] = useState('');
  const [showBossGates, setShowBossGates] = useState(true);

  // AI Intent Input & Draft inline editing state
  const [aiInputText, setAiInputText] = useState('');
  const [lastAiMode, setLastAiMode] = useState<'aligned' | 'parse'>('aligned');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Boss AI goal & manual composer state
  const [bossGoalInput, setBossGoalInput] = useState('');
  const [showNewBossPanel, setShowNewBossPanel] = useState(false);
  const [showBossComposer, setShowBossComposer] = useState(false);
  const [showRaidHistory, setShowRaidHistory] = useState(false);
  const [bossTitle, setBossTitle] = useState('');
  const [bossSubtitle, setBossSubtitle] = useState('');
  const [bossCommitment, setBossCommitment] = useState<BossCommitment>('required');
  const [bossStepsText, setBossStepsText] = useState(
    'Define scope & deliverables\nComplete core build\nVerify edge cases\nShip release'
  );

  const completedQuests = state.quests.filter((q) => q.completed);
  const completedCount = completedQuests.length;
  const completedWithContextCount = completedQuests.filter(questHasOutcomeOrReferences).length;
  const routineCompletedCount = completedCount - completedWithContextCount;
  const activeCount = state.quests.length - completedCount;

  const boss = state.boss;
  const bossDraft = state.bossDraft;
  const bossProgress = boss ? getBossProgress(boss) : null;
  const bossRemainingHp = bossProgress ? bossProgress.remainingRequiredHp : 0;
  const bossEffectiveMaxHp = bossProgress ? bossProgress.requiredMaxHp : 100;
  const bossHpPct = bossProgress ? bossProgress.hpPct : 0;
  const bossDefeated = Boolean(bossProgress && bossProgress.bossDefeated);
  const bossStretchBonusXp = bossProgress ? bossProgress.stretchBonusXp : 0;
  const bossStretchBonusCoins = bossProgress ? bossProgress.stretchBonusCoins : 0;
  const bossHasDocEvidence = boss ? bossHasEvidence(boss) : false;
  const bossDocBonusCoins = boss ? computeBossDocumentationBonus(boss) : 0;
  const bossPotentialBonusCoins = boss ? Math.max(15, Math.round(boss.rewardCoins * 0.15)) : 0;
  const bossGateRefsRollup = useMemo(() => {
    if (!boss) return [];
    return boss.steps.flatMap((step) =>
      (step.references || []).map((ref) => ({ stepTitle: step.title, ref }))
    );
  }, [boss]);

  const orderedBossSteps = useMemo(() => (boss ? orderBossSteps(boss.steps) : []), [boss]);
  const requiredBossSteps = useMemo(
    () => orderedBossSteps.filter((s) => !s.optional),
    [orderedBossSteps]
  );
  const optionalBossSteps = useMemo(
    () => orderedBossSteps.filter((s) => Boolean(s.optional)),
    [orderedBossSteps]
  );

  const orderedDeferredRaids = useMemo(
    () => orderDeferredRaids(state.deferredRaids),
    [state.deferredRaids]
  );
  const dueDeferredIds = useMemo(
    () => new Set(getDueDeferredRaids(state.deferredRaids).map((r) => r.id)),
    [state.deferredRaids]
  );
  const dueDeferredRaids = useMemo(
    () => orderedDeferredRaids.filter((r) => dueDeferredIds.has(r.id)),
    [orderedDeferredRaids, dueDeferredIds]
  );
  const upcomingDeferredRaids = useMemo(
    () => orderedDeferredRaids.filter((r) => !dueDeferredIds.has(r.id)),
    [orderedDeferredRaids, dueDeferredIds]
  );
  const orderedScheduledFollowUps = useMemo(
    () => orderScheduledFollowUps(state.scheduledFollowUps),
    [state.scheduledFollowUps]
  );

  const orderedQuests = useMemo(
    () => filterAndOrderQuests(state.quests, filter, searchQuery),
    [state.quests, filter, searchQuery]
  );

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    onQuickAddQuest(trimmed, quickPriority);
    setQuickTitle('');
  };

  const handleBossSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const steps = bossStepsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!bossTitle.trim() || steps.length === 0) return;
    onCreateBoss(bossTitle.trim(), bossSubtitle.trim(), steps, bossCommitment);
    setBossTitle('');
    setBossSubtitle('');
    setBossCommitment('required');
    setShowBossComposer(false);
    setShowNewBossPanel(false);
  };

  const triggerQuestAi = (mode: 'aligned' | 'parse') => {
    setLastAiMode(mode);
    onRequestAiQuests(mode, aiInputText);
  };

  const openQuestOutcomeDrawer = (quest: Quest) => {
    if (expandedQuestId === quest.id) {
      setExpandedQuestId(null);
      return;
    }
    setExpandedQuestId(quest.id);
    setOutcomeDraftText(quest.outcomeText || '');
    setNewRefLabel('');
    setNewRefLocation('');
    setNewFollowUpTitle('');
  };

  const handleToggleQuestRow = (quest: Quest) => {
    const completingNow = !quest.completed;
    onToggleQuest(quest.id);
    if (completingNow) {
      setExpandedQuestId(quest.id);
      setOutcomeDraftText(quest.outcomeText || '');
    }
  };

  const handleCopyLocation = (ref: QuestReference) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ref.location).catch(() => {});
    }
    setCopiedRefId(ref.id);
    window.setTimeout(() => {
      setCopiedRefId((curr) => (curr === ref.id ? null : curr));
    }, 1500);
  };

  const openBossStepDrawer = (step: BossStep) => {
    if (expandedBossStepId === step.id) {
      setExpandedBossStepId(null);
      return;
    }
    setExpandedBossStepId(step.id);
    setBossStepOutcomeDraft(step.outcomeText || '');
    setBossStepRefLabel('');
    setBossStepRefLocation('');
  };

  const handleToggleBossStepRow = (step: BossStep) => {
    const completingNow = !step.completed;
    onToggleBossStep(step.id);
    if (completingNow) {
      setExpandedBossStepId(step.id);
      setBossStepOutcomeDraft(step.outcomeText || '');
      setBossStepRefLabel('');
      setBossStepRefLocation('');
    }
  };

  const toggleRaidDebriefDrawer = () => {
    if (!boss) return;
    if (showRaidDebrief) {
      setShowRaidDebrief(false);
      return;
    }
    setShowRaidDebrief(true);
    setRaidOutcomeDraft(boss.raidOutcomeText || '');
    setRaidRefLabel('');
    setRaidRefLocation('');
  };

  const showStagingTray =
    questAiLoading || Boolean(questAiError) || state.questDrafts.length > 0;

  const renderBossStepCard = (step: BossStep) => {
    const stepRefs = step.references || [];
    const isStepExpanded = expandedBossStepId === step.id;
    const hasStepEvidence = Boolean(step.outcomeText) || stepRefs.length > 0;

    return (
      <div
        key={step.id}
        className={`rounded-2xl border p-3.5 transition-colors ${
          isStepExpanded ? 'sm:col-span-2 ' : ''
        }${
          step.completed
            ? 'border-[#d3f5e8] bg-[#f4fcf8]'
            : 'border-[#dfe3f4] bg-[#faf8ff]'
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          <button
            type="button"
            onClick={() => handleToggleBossStepRow(step)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                step.completed
                  ? 'border-[#10b981] bg-[#10b981] text-white'
                  : 'border-[#c7c4d7] bg-white hover:border-[#4648d4]'
              }`}
            >
              {step.completed && <Check className="h-3 w-3 stroke-[3]" />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-sm font-semibold leading-snug ${
                  step.completed ? 'text-[#464554] line-through' : 'text-[#131b2e]'
                }`}
              >
                {step.title}
              </span>
              <span className="mt-1 block text-xs font-medium tabular-nums text-[#464554]">
                {step.completed
                  ? step.optional
                    ? 'Cleared (Stretch +25 XP / +10 Coins)'
                    : 'Cleared'
                  : step.optional
                    ? 'Optional Gate · +25 XP / +10 Coins'
                    : `Deals ${step.damage} DMG`}
                {hasStepEvidence ? ` · ${stepRefs.length} ref${stepRefs.length === 1 ? '' : 's'}` : ''}
              </span>
            </span>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => openBossStepDrawer(step)}
              aria-expanded={isStepExpanded}
              className="btn-tactile-ghost inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer"
            >
              <Link2 className="h-3 w-3 text-[#4648d4]" />
              <span>{isStepExpanded ? 'Hide' : 'Evidence'}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleBossStepOptional(step.id)}
              className={`text-[11px] font-bold cursor-pointer hover:underline ${
                step.optional ? 'text-[#4648d4]' : 'text-[#767586]'
              }`}
            >
              {step.optional ? 'Optional Gate' : 'Mark Optional'}
            </button>
          </div>
        </div>

        {/* Collapsed Gate Evidence Preview */}
        {!isStepExpanded && hasStepEvidence && (
          <div className="mt-2.5 pl-8 space-y-1">
            {step.outcomeText && (
              <p className="text-xs text-[#464554] leading-snug">{step.outcomeText}</p>
            )}
            {stepRefs.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {stepRefs.map((ref) => {
                  const safeUrl =
                    ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                  return safeUrl ? (
                    <a
                      key={ref.id}
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#4648d4] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>{ref.label}</span>
                    </a>
                  ) : (
                    <button
                      key={ref.id}
                      type="button"
                      onClick={() => handleCopyLocation(ref)}
                      title={`Copy: ${ref.location}`}
                      className="inline-flex items-center gap-1 font-mono text-[#464554] hover:text-[#4648d4] cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>
                        {ref.label}: {ref.location}
                        {copiedRefId === ref.id ? ' (Copied)' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Expanded Gate Evidence Drawer */}
        {isStepExpanded && (
          <div className="mt-3 space-y-2.5 rounded-xl border border-[#dfe3f4] bg-white p-3">
            <div className="flex flex-col gap-2">
              <textarea
                rows={2}
                value={bossStepOutcomeDraft}
                onChange={(e) => setBossStepOutcomeDraft(e.target.value)}
                placeholder="Gate result, test proof, or decision notes..."
                aria-label={`Outcome notes for gate ${step.title}`}
                className="arcade-input w-full rounded-xl px-3 py-1.5 text-xs text-[#131b2e] placeholder:text-[#767586]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBossStepOutcome(step.id, {
                      outcomeText: bossStepOutcomeDraft,
                    })
                  }
                  className="btn-tactile-emerald rounded-full px-3.5 py-1 text-[11px] font-bold cursor-pointer"
                >
                  Save Result
                </button>
              </div>
            </div>

            {stepRefs.length > 0 && (
              <ul className="space-y-1 border-t border-[#eef0ff] pt-2">
                {stepRefs.map((ref) => {
                  const safeUrl =
                    ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                  return (
                    <li
                      key={ref.id}
                      className="flex items-center justify-between gap-2 text-xs text-[#131b2e]"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-bold">{ref.label}: </span>
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[#4648d4] hover:underline"
                          >
                            {ref.location}
                          </a>
                        ) : (
                          <span className="font-mono text-[#464554]">{ref.location}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBossStepOutcome(step.id, {
                            references: stepRefs.filter((r) => r.id !== ref.id),
                          })
                        }
                        aria-label={`Remove gate reference ${ref.label}`}
                        className="text-[#767586] hover:text-[#ba1a1a] cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="grid grid-cols-1 gap-1.5 border-t border-[#eef0ff] pt-2 sm:grid-cols-5">
              <input
                type="text"
                value={bossStepRefLabel}
                onChange={(e) => setBossStepRefLabel(e.target.value)}
                placeholder="Label"
                aria-label="New gate reference label"
                className="arcade-input sm:col-span-2 rounded-xl px-2.5 py-1 text-xs text-[#131b2e]"
              />
              <input
                type="text"
                value={bossStepRefLocation}
                onChange={(e) => setBossStepRefLocation(e.target.value)}
                placeholder="https://... or path"
                aria-label="New gate reference URL or path"
                className="arcade-input sm:col-span-2 rounded-xl px-2.5 py-1 text-xs text-[#131b2e]"
              />
              <button
                type="button"
                disabled={!bossStepRefLocation.trim()}
                onClick={() => {
                  const loc = bossStepRefLocation.trim();
                  if (!loc) return;
                  const nextRef: QuestReference = {
                    id: `ref-gate-${Date.now()}`,
                    label: bossStepRefLabel.trim() || 'Proof',
                    location: loc,
                    kind: inferReferenceKind(loc),
                  };
                  onUpdateBossStepOutcome(step.id, {
                    references: [...stepRefs, nextRef],
                  });
                  setBossStepRefLabel('');
                  setBossStepRefLocation('');
                }}
                className="btn-tactile-ghost rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Add Ref
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDeferredRaidRow = (raid: BossEncounter) => {
    const progress = getBossProgress(raid);
    const resumeDue = Boolean(raid.resumeAt && Date.parse(raid.resumeAt) <= Date.now());
    const resumeLabel = raid.resumeAt
      ? new Date(raid.resumeAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Manual resume';

    return (
      <li
        key={raid.id}
        className="flex flex-col gap-3 py-3 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 text-xs">
            <span
              className={`font-bold ${
                raid.commitment === 'optional' ? 'text-[#4648d4]' : 'text-[#ba1a1a]'
              }`}
            >
              {raid.commitment === 'optional' ? 'Optional Raid' : 'Core Raid'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold tabular-nums text-[#464554]">
              {progress.completedRequiredCount}/{progress.requiredSteps.length} required gates
            </span>
            <span aria-hidden="true">·</span>
            <span className={`font-semibold ${resumeDue ? 'text-[#006c49]' : 'text-[#464554]'}`}>
              {resumeDue ? 'Ready to resume' : resumeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-bold text-[#131b2e]">{raid.title}</p>
          {raid.deferReason && (
            <p className="mt-0.5 text-xs text-[#464554]">Note: {raid.deferReason}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onResumeDeferredRaid(raid.id)}
            className="btn-tactile-emerald rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            {boss ? 'Swap & Resume' : 'Resume Raid'}
          </button>
          <button
            type="button"
            onClick={() => onDiscardDeferredRaid(raid.id)}
            aria-label={`Discard deferred raid "${raid.title}"`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  };

  const bossEncounterSection = boss ? (
    <section className="arcade-card rounded-3xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              bossDefeated
                ? 'bg-[#e6fbf3] border-[#6ffbbe] text-[#006c49]'
                : 'bg-[#fff1f3] border-[#ffdad6] text-[#ba1a1a]'
            }`}
          >
            {bossDefeated ? <Trophy className="h-5 w-5" /> : <Swords className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p
                className={`text-xs font-bold tracking-[0.04em] ${
                  boss.commitment === 'optional' ? 'text-[#4648d4]' : 'text-[#ba1a1a]'
                }`}
              >
                {bossDefeated
                  ? 'Boss Encounter Cleared'
                  : boss.commitment === 'optional'
                    ? 'Optional Stretch Raid'
                    : 'Active Boss Encounter'}
              </p>
              <span aria-hidden="true" className="text-xs text-[#c7c4d7]">
                ·
              </span>
              <button
                type="button"
                onClick={onToggleBossCommitment}
                className="text-xs font-bold text-[#464554] hover:text-[#4648d4] underline decoration-dotted cursor-pointer"
              >
                {boss.commitment === 'optional' ? 'Mark Core' : 'Mark Optional'}
              </button>
            </div>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-[-0.02em] text-[#131b2e]">
              {boss.title}
            </h2>
            <p className="mt-1 text-sm text-[#464554]">{boss.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
          {bossDefeated && !boss.bountyClaimed ? (
            <div className="flex flex-col items-start sm:items-end">
              <button
                type="button"
                onClick={onClaimBossBounty}
                className="btn-tactile-amber shrink-0 rounded-full px-5 py-2.5 text-sm font-bold whitespace-nowrap cursor-pointer"
              >
                Claim +{boss.rewardXp + bossStretchBonusXp} XP · +
                {boss.rewardCoins + bossDocBonusCoins + bossStretchBonusCoins} Coins
              </button>
              <span className="mt-1 text-[11px] font-semibold text-[#464554] tabular-nums">
                {bossDocBonusCoins > 0 || bossStretchBonusCoins > 0
                  ? [
                      bossDocBonusCoins > 0 ? `+${bossDocBonusCoins} Evidence Bonus` : null,
                      bossStretchBonusCoins > 0
                        ? `+${bossStretchBonusXp} XP / +${bossStretchBonusCoins} Coins Stretch`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : `Add outcome or ref for +${bossPotentialBonusCoins} bonus Coins`}
              </span>
            </div>
          ) : (
            <div className="shrink-0 text-left sm:text-right">
              <span className="text-xs font-semibold text-[#464554]">Raid Bounty</span>
              <p className="font-mono text-sm font-bold tabular-nums text-[#131b2e]">
                {boss.bountyClaimed
                  ? `Bounty Claimed${
                      (boss.bonusCoinsAwarded || 0) + (boss.stretchBonusCoinsAwarded || 0) > 0
                        ? ` (+${
                            (boss.bonusCoinsAwarded || 0) + (boss.stretchBonusCoinsAwarded || 0)
                          } bonus)`
                        : ''
                    }`
                  : `+${boss.rewardXp} XP · +${boss.rewardCoins} Coins`}
              </p>
            </div>
          )}
          {boss.bountyClaimed ? (
            <button
              type="button"
              onClick={() => {
                setShowNewBossPanel((v) => !v);
                setShowDeferPanel(false);
              }}
              aria-expanded={showNewBossPanel}
              className="btn-tactile-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showNewBossPanel ? 'Hide New Raid' : 'Start Next Raid'}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowNewBossPanel((v) => !v);
                  setShowDeferPanel(false);
                }}
                aria-expanded={showNewBossPanel}
                className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-[#4648d4]" />
                <span>New Raid</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeferPanel((v) => !v);
                  setShowNewBossPanel(false);
                }}
                aria-expanded={showDeferPanel}
                className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                <Clock className="h-3.5 w-3.5 text-[#4648d4]" />
                <span>Defer</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleRaidDebriefDrawer}
            aria-expanded={showRaidDebrief}
            className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <Link2 className="h-3.5 w-3.5 text-[#4648d4]" />
            <span>{showRaidDebrief ? 'Hide Debrief' : 'Raid Debrief'}</span>
            {showRaidDebrief ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowBossGates((v) => !v)}
            aria-expanded={showBossGates}
            className="btn-tactile-ghost inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <span>{showBossGates ? 'Hide Gates' : `Show Gates (${boss.steps.length})`}</span>
            {showBossGates ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewBossPanel(false);
              onClearBoss();
            }}
            aria-label={boss.bountyClaimed ? 'Archive completed raid to history' : 'Clear boss encounter'}
            title={boss.bountyClaimed ? 'Archive completed raid to history' : 'Clear boss encounter'}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe3f4] text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Inline Start Next / New Boss Raid Drawer */}
      {showNewBossPanel && !bossDraft && (
        <div className="mt-4 rounded-2xl border border-[#c0c1ff] bg-[#faf8ff] p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold text-[#131b2e]">
                {boss.bountyClaimed ? 'Start Next Boss Encounter' : 'Launch Another Boss Encounter'}
              </p>
              <p className="text-[11px] text-[#464554]">
                {boss.bountyClaimed
                  ? 'Your completed raid and its debrief evidence will be archived to Shipped Boss Raids.'
                  : 'Your current raid will be parked safely in Deferred Boss Raids with all gate progress intact.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!showBossComposer ? (
                <button
                  type="button"
                  onClick={() => setShowBossComposer(true)}
                  className="btn-tactile-ghost rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Manual Composer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBossComposer(false)}
                  className="text-xs font-bold text-[#4648d4] hover:underline cursor-pointer"
                >
                  Use AI Draft
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowNewBossPanel(false);
                  setShowBossComposer(false);
                }}
                className="text-xs font-bold text-[#767586] hover:text-[#131b2e] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          {!showBossComposer ? (
            <>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={bossGoalInput}
                  onChange={(e) => setBossGoalInput(e.target.value)}
                  placeholder={`Next milestone goal for ${state.playerRole} (or leave blank to suggest)...`}
                  aria-label="Milestone goal for next AI Boss decomposition"
                  className="arcade-input flex-1 rounded-full px-4 py-2 text-sm text-[#131b2e] placeholder:text-[#767586]"
                />
                <button
                  type="button"
                  disabled={bossAiLoading}
                  onClick={() => onRequestAiBoss(bossGoalInput)}
                  className="btn-tactile-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {bossAiLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{bossAiLoading ? 'Drafting Raid...' : 'Draft Raid with AI'}</span>
                </button>
              </div>
              {bossAiError && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ffdad6] bg-[#fff1f3] px-4 py-2 text-xs font-semibold text-[#ba1a1a]">
                  <span>{bossAiError}</span>
                  <button
                    type="button"
                    onClick={() => onRequestAiBoss(bossGoalInput)}
                    className="font-bold underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleBossSubmit} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="next-boss-title" className="block text-xs font-bold text-[#131b2e]">
                    Milestone Name
                  </label>
                  <input
                    id="next-boss-title"
                    type="text"
                    required
                    value={bossTitle}
                    onChange={(e) => setBossTitle(e.target.value)}
                    placeholder="e.g., Ship Q4 Beta Release"
                    className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
                  />
                </div>
                <div>
                  <label htmlFor="next-boss-subtitle" className="block text-xs font-bold text-[#131b2e]">
                    Subtitle
                  </label>
                  <input
                    id="next-boss-subtitle"
                    type="text"
                    value={bossSubtitle}
                    onChange={(e) => setBossSubtitle(e.target.value)}
                    placeholder="Short raid description..."
                    className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
                  />
                </div>
                <div>
                  <label htmlFor="next-boss-commitment" className="block text-xs font-bold text-[#131b2e]">
                    Commitment
                  </label>
                  <select
                    id="next-boss-commitment"
                    value={bossCommitment}
                    onChange={(e) => setBossCommitment(e.target.value as BossCommitment)}
                    className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm font-semibold text-[#131b2e]"
                  >
                    <option value="required">Core Milestone Raid</option>
                    <option value="optional">Optional / Stretch Raid</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="next-boss-steps" className="block text-xs font-bold text-[#131b2e]">
                  Raid Gates (one step per line, 100 DMG each)
                </label>
                <textarea
                  id="next-boss-steps"
                  rows={3}
                  required
                  value={bossStepsText}
                  onChange={(e) => setBossStepsText(e.target.value)}
                  className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="btn-tactile-primary rounded-full px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  Launch Boss Raid
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Completed Raid Next-Step Strip */}
      {boss.bountyClaimed && !showNewBossPanel && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#6ffbbe] bg-[#e6fbf3]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold text-[#006c49]">
              Milestone Cleared &amp; Bounty Claimed
            </p>
            <p className="text-xs text-[#464554]">
              Ready for your next objective? Archive this raid to Shipped History or launch a new Boss Encounter now.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNewBossPanel(false);
                onClearBoss();
              }}
              className="btn-tactile-ghost rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              Archive to History
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewBossPanel(true);
                setShowBossComposer(false);
              }}
              className="btn-tactile-primary inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Start Next Raid</span>
            </button>
          </div>
        </div>
      )}

      {/* Defer Active Raid Controls */}
      {showDeferPanel && (
        <div className="mt-4 rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-[#131b2e]">Defer Raid for Later</p>
              <p className="text-[11px] text-[#464554]">
                Park this raid with all gate progress, evidence, and references intact so you can focus elsewhere.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeferPanel(false)}
              className="text-xs font-bold text-[#767586] hover:text-[#131b2e] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
            <select
              aria-label="When to resume deferred raid"
              value={deferDelayHours}
              onChange={(e) => setDeferDelayHours(Number(e.target.value))}
              className="arcade-input sm:col-span-2 rounded-2xl px-3 py-1.5 text-xs font-semibold text-[#131b2e]"
            >
              <option value={0}>Park manually (Later)</option>
              <option value={24}>Resume in 24h</option>
              <option value={72}>Resume in 3 days</option>
              <option value={168}>Resume in 1 week</option>
            </select>
            <input
              type="text"
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              placeholder="Optional note (e.g., Waiting on QA sign-off)"
              aria-label="Reason for deferring raid"
              className="arcade-input sm:col-span-3 rounded-2xl px-3 py-1.5 text-xs text-[#131b2e]"
            />
            <button
              type="button"
              onClick={() => {
                onDeferBoss({ delayHours: deferDelayHours, reason: deferReason });
                setShowDeferPanel(false);
                setDeferReason('');
                setDeferDelayHours(0);
              }}
              className="btn-tactile-primary rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              Park Raid
            </button>
          </div>
        </div>
      )}

      {/* Boss HP Track */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#131b2e]">
            {bossDefeated
              ? 'Milestone Defeated'
              : `Remaining Required HP (${bossProgress?.completedRequiredCount ?? 0}/${
                  bossProgress?.requiredSteps.length ?? boss.steps.length
                } required gates)`}
          </span>
          <span className="font-mono font-bold tabular-nums text-[#ba1a1a]">
            {bossRemainingHp} / {bossEffectiveMaxHp} HP
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={bossHpPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Boss remaining health"
          className="arcade-well mt-2 h-3.5 w-full overflow-hidden rounded-full p-0.5"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              bossDefeated
                ? 'bg-[#10b981]'
                : 'bg-gradient-to-r from-[#f43f5e] to-[#fb7185]'
            }`}
            style={{ width: `${bossDefeated ? 100 : Math.max(4, bossHpPct)}%` }}
          />
        </div>
      </div>

      {/* Raid-Level Debrief & Evidence Bonus Summary */}
      {(showRaidDebrief ||
        boss.raidOutcomeText ||
        (boss.raidReferences && boss.raidReferences.length > 0)) && (
        <div className="mt-4 rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-[#131b2e]">
              Raid Debrief &amp; Milestone Artifacts
            </p>
            <span
              className={`text-xs font-bold tabular-nums ${
                bossHasDocEvidence ? 'text-[#006c49]' : 'text-[#464554]'
              }`}
            >
              {bossHasDocEvidence
                ? `Evidence Bonus Ready (+${bossDocBonusCoins} Coins)`
                : `Attach outcome or ref to earn +${bossPotentialBonusCoins} bonus Coins`}
            </span>
          </div>

          {!showRaidDebrief ? (
            <div className="space-y-1.5 text-xs text-[#464554]">
              {boss.raidOutcomeText && (
                <p className="font-medium text-[#131b2e]">{boss.raidOutcomeText}</p>
              )}
              {boss.raidReferences && boss.raidReferences.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {boss.raidReferences.map((ref) => {
                    const safeUrl =
                      ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                    return safeUrl ? (
                      <a
                        key={ref.id}
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#4648d4] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>{ref.label}</span>
                      </a>
                    ) : (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={() => handleCopyLocation(ref)}
                        className="inline-flex items-center gap-1 font-mono text-[#464554] hover:text-[#4648d4] cursor-pointer"
                        title={`Copy: ${ref.location}`}
                      >
                        <Copy className="h-3 w-3" />
                        <span>
                          {ref.label}: {ref.location}
                          {copiedRefId === ref.id ? ' (Copied)' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <textarea
                  rows={2}
                  value={raidOutcomeDraft}
                  onChange={(e) => setRaidOutcomeDraft(e.target.value)}
                  placeholder="Summarize what shipped in this milestone, verification results, or release tag..."
                  aria-label="Raid outcome summary"
                  className="arcade-input flex-1 rounded-2xl px-3.5 py-2 text-xs text-[#131b2e] placeholder:text-[#767586]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBossRaidDebrief({ raidOutcomeText: raidOutcomeDraft })
                  }
                  className="btn-tactile-emerald shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Save Debrief
                </button>
              </div>

              {boss.raidReferences && boss.raidReferences.length > 0 && (
                <ul className="space-y-1.5">
                  {boss.raidReferences.map((ref) => {
                    const safeUrl =
                      ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                    return (
                      <li
                        key={ref.id}
                        className="flex items-center justify-between gap-2 text-xs text-[#131b2e]"
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-bold">{ref.label}: </span>
                          {safeUrl ? (
                            <a
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[#4648d4] hover:underline"
                            >
                              {ref.location}
                            </a>
                          ) : (
                            <span className="font-mono text-[#464554]">{ref.location}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateBossRaidDebrief({
                              raidReferences: (boss.raidReferences || []).filter(
                                (r) => r.id !== ref.id
                              ),
                            })
                          }
                          aria-label={`Remove raid reference ${ref.label}`}
                          className="text-[#767586] hover:text-[#ba1a1a] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                <input
                  type="text"
                  value={raidRefLabel}
                  onChange={(e) => setRaidRefLabel(e.target.value)}
                  placeholder="Label (e.g., Release Tag)"
                  aria-label="New raid reference label"
                  className="arcade-input sm:col-span-2 rounded-2xl px-3 py-1.5 text-xs text-[#131b2e]"
                />
                <input
                  type="text"
                  value={raidRefLocation}
                  onChange={(e) => setRaidRefLocation(e.target.value)}
                  placeholder="https://..., release path, or note"
                  aria-label="New raid reference URL or path"
                  className="arcade-input sm:col-span-3 rounded-2xl px-3 py-1.5 text-xs text-[#131b2e]"
                />
                <button
                  type="button"
                  disabled={!raidRefLocation.trim()}
                  onClick={() => {
                    const loc = raidRefLocation.trim();
                    if (!loc) return;
                    const nextRef: QuestReference = {
                      id: `ref-raid-${Date.now()}`,
                      label: raidRefLabel.trim() || 'Artifact',
                      location: loc,
                      kind: inferReferenceKind(loc),
                    };
                    onUpdateBossRaidDebrief({
                      raidReferences: [...(boss.raidReferences || []), nextRef],
                    });
                    setRaidRefLabel('');
                    setRaidRefLocation('');
                  }}
                  className="btn-tactile-ghost rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Add Ref
                </button>
              </div>

              {bossGateRefsRollup.length > 0 && (
                <div className="border-t border-[#e8ebf8] pt-2.5">
                  <p className="text-[11px] font-bold text-[#464554]">
                    Rolled-up Gate References ({bossGateRefsRollup.length})
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {bossGateRefsRollup.map(({ stepTitle, ref }) => {
                      const safeUrl =
                        ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                      return safeUrl ? (
                        <a
                          key={ref.id}
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`From gate: ${stepTitle}`}
                          className="inline-flex items-center gap-1 font-semibold text-[#4648d4] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>{ref.label}</span>
                        </a>
                      ) : (
                        <button
                          key={ref.id}
                          type="button"
                          onClick={() => handleCopyLocation(ref)}
                          title={`From gate: ${stepTitle} · Click to copy ${ref.location}`}
                          className="inline-flex items-center gap-1 font-mono text-[#464554] hover:text-[#4648d4] cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          <span>
                            {ref.label}
                            {copiedRefId === ref.id ? ' (Copied)' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Boss Gate Steps (Required gates first, followed by Optional stretch gates) */}
      {showBossGates && (
        <div className="mt-5">
          {requiredBossSteps.length > 0 && optionalBossSteps.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {requiredBossSteps.map(renderBossStepCard)}
              </div>
              <div className="mt-4 border-t border-[#e8ebf8] pt-4">
                <p className="mb-2.5 text-xs font-bold text-[#4648d4]">
                  Optional Stretch Gates ({optionalBossSteps.length} · +25 XP / +10 Coins each)
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {optionalBossSteps.map(renderBossStepCard)}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {orderedBossSteps.map(renderBossStepCard)}
            </div>
          )}
        </div>
      )}
    </section>
  ) : !bossDraft ? (
    <section className="arcade-card rounded-3xl p-6 space-y-4">
      {!showBossComposer ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] text-[#4648d4]">
                <Swords className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#131b2e]">No Active Boss Encounter</h2>
                <p className="text-xs text-[#464554]">
                  Decompose a major milestone into reviewable raid gates using AI or create one manually.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBossComposer(true)}
              className="btn-tactile-ghost shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              Manual Composer
            </button>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              type="text"
              value={bossGoalInput}
              onChange={(e) => setBossGoalInput(e.target.value)}
              placeholder={`Milestone goal for ${state.playerRole} (or leave blank to suggest)...`}
              aria-label="Milestone goal for AI Boss decomposition"
              className="arcade-input flex-1 rounded-full px-4 py-2.5 text-sm text-[#131b2e] placeholder:text-[#767586]"
            />
            <button
              type="button"
              disabled={bossAiLoading}
              onClick={() => onRequestAiBoss(bossGoalInput)}
              className="btn-tactile-primary inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              {bossAiLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{bossAiLoading ? 'Drafting Raid...' : 'Draft Raid with AI'}</span>
            </button>
          </div>

          {bossAiError && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ffdad6] bg-[#fff1f3] px-4 py-2.5 text-xs font-semibold text-[#ba1a1a]">
              <span>{bossAiError}</span>
              <button
                type="button"
                onClick={() => onRequestAiBoss(bossGoalInput)}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleBossSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#131b2e]">
              Create Boss Encounter
            </h2>
            <button
              type="button"
              onClick={() => setShowBossComposer(false)}
              className="text-xs font-bold text-[#464554] hover:text-[#131b2e] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="boss-title" className="block text-xs font-bold text-[#131b2e]">
                Milestone Name
              </label>
              <input
                id="boss-title"
                type="text"
                required
                value={bossTitle}
                onChange={(e) => setBossTitle(e.target.value)}
                placeholder="e.g., Ship Q4 Beta Release"
                className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
              />
            </div>
            <div>
              <label htmlFor="boss-subtitle" className="block text-xs font-bold text-[#131b2e]">
                Subtitle
              </label>
              <input
                id="boss-subtitle"
                type="text"
                value={bossSubtitle}
                onChange={(e) => setBossSubtitle(e.target.value)}
                placeholder="Short raid description..."
                className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
              />
            </div>
            <div>
              <label htmlFor="boss-commitment" className="block text-xs font-bold text-[#131b2e]">
                Commitment
              </label>
              <select
                id="boss-commitment"
                value={bossCommitment}
                onChange={(e) => setBossCommitment(e.target.value as BossCommitment)}
                className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm font-semibold text-[#131b2e]"
              >
                <option value="required">Core Milestone Raid</option>
                <option value="optional">Optional / Stretch Raid</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="boss-steps" className="block text-xs font-bold text-[#131b2e]">
              Raid Gates (one step per line, 100 DMG each)
            </label>
            <textarea
              id="boss-steps"
              rows={3}
              required
              value={bossStepsText}
              onChange={(e) => setBossStepsText(e.target.value)}
              className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-tactile-primary rounded-full px-5 py-2 text-xs font-bold cursor-pointer"
            >
              Launch Boss Raid
            </button>
          </div>
        </form>
      )}
    </section>
  ) : null;

  const aiQuestPlannerSection = (
    <section className="arcade-card rounded-3xl p-5 space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-sm font-extrabold text-[#131b2e]">
          AI Quest Planner &amp; Input Parser
        </h2>
        <p className="text-xs text-[#464554]">
          Aligned to {state.playerRole} · {state.dailyFocusGoalMinutes}m budget ·{' '}
          {getAiModelLabel(state.aiModel)}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <textarea
          rows={2}
          value={aiInputText}
          onChange={(e) => setAiInputText(e.target.value)}
          placeholder="Paste rough notes or priorities to parse into structured quests—or leave blank and click Suggest Aligned..."
          aria-label="Raw notes or focus direction for AI quest drafting"
          className="arcade-input flex-1 rounded-2xl px-4 py-2.5 text-sm text-[#131b2e] placeholder:text-[#767586]"
        />
        <div className="flex flex-row sm:flex-col gap-2 shrink-0">
          <button
            type="button"
            disabled={questAiLoading}
            onClick={() => triggerQuestAi('aligned')}
            className="btn-tactile-primary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            {questAiLoading && lastAiMode === 'aligned' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>Suggest Aligned</span>
          </button>
          <button
            type="button"
            disabled={questAiLoading || !aiInputText.trim()}
            onClick={() => triggerQuestAi('parse')}
            className="btn-tactile-ghost inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {questAiLoading && lastAiMode === 'parse' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Edit3 className="h-3.5 w-3.5 text-[#4648d4]" />
            )}
            <span>Parse Input</span>
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#131b2e] text-balance">
            Today&apos;s Quest Board
          </h1>
          <p className="mt-1 text-sm text-[#464554] tabular-nums">
            {activeCount} active quest{activeCount === 1 ? '' : 's'} · {completedCount} completed ·{' '}
            {state.doubleXpCharges > 0 ? '2x XP Boost Active' : 'Standard XP Rate'}
            {boss ? ` · Raid: ${boss.title}` : ''}
          </p>
        </div>
      </div>

      {/* 2a. Pending Human Review: Boss Raid Draft */}
      {bossDraft && (
        <section className="rounded-3xl border border-[#c0c1ff] bg-[#f2f3ff]/80 p-6">
          <div className="flex flex-col gap-3 border-b border-[#dfe3f4] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.04em] text-[#4648d4]">
                Boss Raid Draft · Pending Human Review
              </p>
              <p className="mt-0.5 text-xs text-[#464554]">
                Edit the milestone title or individual 100-DMG gates before committing to your board.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDiscardBossDraft}
                className="btn-tactile-ghost rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Discard Draft
              </button>
              <button
                type="button"
                disabled={bossDraft.steps.filter((s) => s.title.trim()).length === 0}
                onClick={onApproveBossDraft}
                className="btn-tactile-emerald rounded-full px-5 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
              >
                Approve &amp; Launch Raid
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="boss-draft-title" className="block text-xs font-bold text-[#131b2e]">
                  Raid Title
                </label>
                <input
                  id="boss-draft-title"
                  type="text"
                  value={bossDraft.title}
                  onChange={(e) => onUpdateBossDraft({ title: e.target.value })}
                  className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm font-bold text-[#131b2e]"
                />
              </div>
              <div>
                <label htmlFor="boss-draft-subtitle" className="block text-xs font-bold text-[#131b2e]">
                  Raid Summary
                </label>
                <input
                  id="boss-draft-subtitle"
                  type="text"
                  value={bossDraft.subtitle}
                  onChange={(e) => onUpdateBossDraft({ subtitle: e.target.value })}
                  className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
                />
              </div>
              <div>
                <label htmlFor="boss-draft-commitment" className="block text-xs font-bold text-[#131b2e]">
                  Raid Commitment
                </label>
                <select
                  id="boss-draft-commitment"
                  value={bossDraft.commitment || 'required'}
                  onChange={(e) =>
                    onUpdateBossDraft({ commitment: e.target.value as BossCommitment })
                  }
                  className="arcade-input mt-1 w-full rounded-2xl px-3.5 py-2 text-sm font-semibold text-[#131b2e]"
                >
                  <option value="required">Core Milestone Raid</option>
                  <option value="optional">Optional / Stretch Raid</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#131b2e]">
                  Milestone Gates ({bossDraft.steps.filter((s) => !s.optional).length} required ·{' '}
                  {bossDraft.steps.filter((s) => s.optional).length} optional)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBossDraft({
                      steps: [
                        ...bossDraft.steps,
                        { id: `bd-step-${Date.now()}`, title: 'New milestone gate' },
                      ],
                    })
                  }
                  className="text-xs font-bold text-[#4648d4] hover:underline cursor-pointer"
                >
                  + Add Gate
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {bossDraft.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-mono font-bold tabular-nums text-[#464554]">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) =>
                        onUpdateBossDraft({
                          steps: bossDraft.steps.map((s) =>
                            s.id === step.id ? { ...s, title: e.target.value } : s
                          ),
                        })
                      }
                      aria-label={`Raid gate ${idx + 1}`}
                      className="arcade-input flex-1 rounded-2xl px-3.5 py-2 text-sm text-[#131b2e]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBossDraft({
                          steps: bossDraft.steps.map((s) =>
                            s.id === step.id ? { ...s, optional: !s.optional } : s
                          ),
                        })
                      }
                      className={`btn-tactile-ghost rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                        step.optional ? 'text-[#4648d4]' : 'text-[#464554]'
                      }`}
                    >
                      {step.optional ? 'Optional' : 'Required'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBossDraft({
                          steps: bossDraft.steps.filter((s) => s.id !== step.id),
                        })
                      }
                      aria-label={`Remove gate ${idx + 1}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2b. Pending Human Review: Quest Draft Staging Tray */}
      {showStagingTray && (
        <section
          aria-label="Quest drafts pending review"
          className="rounded-3xl border border-[#c0c1ff] bg-[#f2f3ff]/75 p-6"
        >
          <div className="flex flex-col gap-3 border-b border-[#dfe3f4] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Draft Staging Tray · Pending Approval
              </h2>
              <p className="mt-0.5 text-xs text-[#464554] tabular-nums">
                {questAiLoading
                  ? 'Generating aligned quest drafts for review...'
                  : `${state.questDrafts.length} draft${state.questDrafts.length === 1 ? '' : 's'} staged — edit or approve to commit into actual quests`}
              </p>
            </div>
            {state.questDrafts.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearQuestDrafts}
                  className="btn-tactile-ghost rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Discard All
                </button>
                <button
                  type="button"
                  onClick={onApproveAllQuestDrafts}
                  className="btn-tactile-emerald rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Approve All ({state.questDrafts.length})
                </button>
              </div>
            )}
          </div>

          {questAiError && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#ffdad6] bg-[#fff1f3] px-4 py-3 text-xs font-semibold text-[#ba1a1a]">
              <span>{questAiError}</span>
              <button
                type="button"
                onClick={() => triggerQuestAi(lastAiMode)}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {questAiLoading && (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-[74px] animate-pulse rounded-2xl border border-[#dfe3f4] bg-white/80"
                />
              ))}
            </div>
          )}

          {state.questDrafts.length > 0 && (
            <ul className="mt-4 space-y-3">
              {state.questDrafts.map((draft) => {
                const isEditing = editingDraftId === draft.draftId;
                return (
                  <li
                    key={draft.draftId}
                    className="rounded-2xl border border-[#dfe3f4] bg-white p-4"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) =>
                            onEditQuestDraft(draft.draftId, { title: e.target.value })
                          }
                          aria-label="Edit draft title"
                          className="arcade-input w-full rounded-2xl px-3.5 py-2 text-sm font-bold text-[#131b2e]"
                        />
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          <select
                            aria-label="Edit draft category"
                            value={draft.category}
                            onChange={(e) =>
                              onEditQuestDraft(draft.draftId, {
                                category: e.target.value as QuestCategory,
                              })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs font-bold text-[#131b2e]"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label="Edit draft priority"
                            value={draft.priority}
                            onChange={(e) =>
                              onEditQuestDraft(draft.draftId, {
                                priority: e.target.value as QuestPriority,
                              })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs font-bold text-[#131b2e]"
                          >
                            <option value="critical">Critical</option>
                            <option value="focus">Focus</option>
                            <option value="routine">Routine</option>
                          </select>

                          <input
                            type="number"
                            min={20}
                            max={200}
                            step={5}
                            aria-label="Edit draft XP reward"
                            value={draft.xpReward}
                            onChange={(e) =>
                              onEditQuestDraft(draft.draftId, {
                                xpReward: Number(e.target.value) || 20,
                              })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs font-mono font-bold tabular-nums text-[#131b2e]"
                          />

                          <input
                            type="text"
                            aria-label="Edit draft target window"
                            value={draft.dueLabel}
                            onChange={(e) =>
                              onEditQuestDraft(draft.draftId, { dueLabel: e.target.value })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs text-[#131b2e]"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingDraftId(null)}
                            className="btn-tactile-ghost rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Done Editing
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDraftId(null);
                              onApproveQuestDraft(draft.draftId);
                            }}
                            className="btn-tactile-emerald rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Save &amp; Approve
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#131b2e]">{draft.title}</p>
                          {draft.rationale && (
                            <p className="mt-0.5 text-xs text-[#464554]">{draft.rationale}</p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-[#464554] tabular-nums">
                            <span className="font-bold text-[#4648d4]">
                              {draft.sourceMode === 'followup'
                                ? 'AI Follow-Up'
                                : draft.sourceMode === 'parsed'
                                  ? 'Parsed Draft'
                                  : 'AI Suggested'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={PRIORITY_STYLES[draft.priority].textClass}>
                              {PRIORITY_STYLES[draft.priority].label}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{draft.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-[#131b2e]">+{draft.xpReward} XP</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#855300]">
                              +{draft.coinReward} Coins
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{draft.dueLabel}</span>
                            {draft.triggeredFromTitle && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>From: {draft.triggeredFromTitle}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingDraftId(draft.draftId)}
                            className="btn-tactile-ghost rounded-full px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onApproveQuestDraft(draft.draftId)}
                            className="btn-tactile-emerald rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onDiscardQuestDraft(draft.draftId)}
                            aria-label={`Discard draft "${draft.title}"`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* 2c. Urgent Alert: Due Deferred Boss Raids Ready to Resume */}
      {dueDeferredRaids.length > 0 && (
        <section
          aria-label="Due deferred boss raids"
          className="rounded-3xl border border-[#a7f3d0] bg-[#ecfdf5]/75 p-5 space-y-2.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d1fae5] pb-2.5">
            <div>
              <h2 className="text-sm font-extrabold text-[#006c49]">
                Deferred Raids Ready to Resume ({dueDeferredRaids.length})
              </h2>
              <p className="text-xs text-[#464554]">
                Scheduled review time arrived — resume directly or swap with your active raid.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[#d1fae5]">
            {dueDeferredRaids.map(renderDeferredRaidRow)}
          </ul>
        </section>
      )}

      {/* 3. Today's Execution Core (Quick-Add + Active Quests Container) */}

      {/* Quick-Add Manual Quest Composer */}
      <form
        onSubmit={handleQuickSubmit}
        className="arcade-card flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Plus className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4648d4]" />
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick-add a manual quest directly to board..."
            aria-label="Quick-add a quest objective"
            className="arcade-input w-full rounded-full py-2.5 pl-10 pr-4 text-sm text-[#131b2e] placeholder:text-[#767586]"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <select
            aria-label="Quick quest priority"
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as QuestPriority)}
            className="arcade-input rounded-full px-3.5 py-2.5 text-xs font-bold text-[#131b2e]"
          >
            <option value="critical">Critical (+140 XP)</option>
            <option value="focus">Focus (+90 XP)</option>
            <option value="routine">Routine (+55 XP)</option>
          </select>
          <button
            type="submit"
            disabled={!quickTitle.trim()}
            className="btn-tactile-primary rounded-full px-5 py-2.5 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            Add Quest
          </button>
        </div>
      </form>

      {/* Active Quests Container */}
      <section className="arcade-card rounded-3xl p-6">
        {/* Filter & Search Toolbar */}
        <div className="flex flex-col gap-3 border-b border-[#e8ebf8] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Filter quests"
              className="inline-flex items-center gap-1 rounded-full bg-[#f2f3ff] p-1 self-start"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'critical', label: 'Critical' },
                  { id: 'focus', label: 'Focus' },
                  { id: 'completed', label: 'Completed' },
                ] as { id: QuestFilterMode; label: string }[]
              ).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#4648d4] text-white shadow-sm'
                        : 'text-[#464554] hover:text-[#131b2e]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {completedCount > 0 && routineCompletedCount > 0 && completedWithContextCount > 0 && (
              <button
                type="button"
                onClick={() => onClearCompletedQuests(true)}
                className="rounded-full border border-[#dfe3f4] bg-white px-3.5 py-1.5 text-xs font-bold text-[#464554] hover:bg-[#f2f3ff] hover:text-[#4648d4] transition-colors whitespace-nowrap cursor-pointer"
              >
                Clear Routine ({routineCompletedCount})
              </button>
            )}

            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => onClearCompletedQuests(false)}
                className="rounded-full border border-[#dfe3f4] bg-white px-3.5 py-1.5 text-xs font-bold text-[#464554] hover:bg-[#fff1f3] hover:text-[#ba1a1a] hover:border-[#ffdad6] transition-colors whitespace-nowrap cursor-pointer"
              >
                Clear {completedWithContextCount > 0 ? 'All ' : ''}Completed ({completedCount})
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#767586]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quests..."
              aria-label="Search quests"
              className="arcade-input w-full rounded-full py-2 pl-9 pr-4 text-xs text-[#131b2e] placeholder:text-[#767586]"
            />
          </div>
        </div>

        {/* Quest Rows */}
        {orderedQuests.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-bold text-[#131b2e]">
              {state.quests.length === 0
                ? 'Your quest board is clear'
                : 'No quests match this view'}
            </p>
            <p className="mt-1 text-sm text-[#464554]">
              {state.quests.length === 0
                ? 'Suggest aligned quests with AI above, add one manually, or load a preset in Experience.'
                : 'Clear your search filter or create a new quest to keep momentum moving.'}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {(filter !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearchQuery('');
                  }}
                  className="btn-tactile-ghost rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={onOpenNewQuestModal}
                className="btn-tactile-primary rounded-full px-5 py-2 text-xs font-bold cursor-pointer"
              >
                Create Quest
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-[#eef0ff]">
            {orderedQuests.map((quest) => {
              const pStyle = PRIORITY_STYLES[quest.priority];
              const isPulsing = justCompletedId === quest.id;
              const isExpanded = expandedQuestId === quest.id;
              const effectiveXp =
                state.doubleXpCharges > 0 && !quest.completed
                  ? quest.xpReward * 2
                  : quest.xpReward;
              const refs = quest.references || [];
              const rules = quest.followUpRules || [];
              const pendingRulesCount = rules.filter((r) => !r.triggeredAt).length;

              return (
                <li key={quest.id} className="py-4 first:pt-3 last:pb-1">
                  <div className="group flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleQuestRow(quest)}
                        aria-label={
                          quest.completed
                            ? `Mark "${quest.title}" as active`
                            : `Complete "${quest.title}"`
                        }
                        className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4648d4] cursor-pointer"
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                            quest.completed
                              ? 'border-[#10b981] bg-[#10b981] text-white'
                              : 'border-[#c7c4d7] bg-white group-hover:border-[#4648d4]'
                          } ${isPulsing ? 'animate-check-pulse' : ''}`}
                        >
                          {quest.completed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[15px] font-bold leading-snug ${
                            quest.completed
                              ? 'text-[#767586] line-through'
                              : 'text-[#131b2e]'
                          }`}
                        >
                          {quest.title}
                        </p>

                        {quest.triggeredFromTitle && (
                          <p className="mt-0.5 text-xs font-semibold text-[#4648d4]">
                            Follow-up from: {quest.triggeredFromTitle}
                          </p>
                        )}

                        {quest.notes && !quest.completed && (
                          <p className="mt-0.5 text-xs text-[#464554] line-clamp-1">
                            {quest.notes}
                          </p>
                        )}

                        {quest.outcomeText && (
                          <p className="mt-1.5 text-xs text-[#131b2e]">
                            <span className="font-bold text-[#006c49]">Result: </span>
                            <span>{quest.outcomeText}</span>
                          </p>
                        )}

                        {refs.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            {refs.map((ref) => {
                              const safeUrl =
                                ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                              if (safeUrl) {
                                return (
                                  <a
                                    key={ref.id}
                                    href={safeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-semibold text-[#4648d4] hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span>{ref.label}</span>
                                  </a>
                                );
                              }
                              return (
                                <button
                                  key={ref.id}
                                  type="button"
                                  onClick={() => handleCopyLocation(ref)}
                                  title={`Copy location: ${ref.location}`}
                                  className="inline-flex items-center gap-1 font-semibold text-[#464554] hover:text-[#131b2e] cursor-pointer"
                                >
                                  <Copy className="h-3 w-3 shrink-0 text-[#4648d4]" />
                                  <span>
                                    {ref.label}: <span className="font-mono">{ref.location}</span>
                                  </span>
                                  {copiedRefId === ref.id && (
                                    <span className="font-bold text-[#006c49]">(Copied)</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#464554] tabular-nums">
                          <span className={pStyle.textClass}>{pStyle.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{quest.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-[#131b2e]">
                            +{effectiveXp} XP
                            {state.doubleXpCharges > 0 && !quest.completed ? ' (2x)' : ''}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#855300]">
                            +{quest.coinReward} Coins
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{quest.dueLabel}</span>
                          {pendingRulesCount > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[#4648d4]">
                                {pendingRulesCount} follow-up{pendingRulesCount === 1 ? '' : 's'} armed
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Row Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pl-9 sm:pl-0">
                      <button
                        type="button"
                        onClick={() => openQuestOutcomeDrawer(quest)}
                        aria-expanded={isExpanded}
                        className="btn-tactile-ghost inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        <Link2 className="h-3 w-3 text-[#4648d4]" />
                        <span>{isExpanded ? 'Hide Details' : 'Outcome & Refs'}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {!quest.completed && (
                        <button
                          type="button"
                          onClick={() => onStartFocusOnQuest(quest)}
                          className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                        >
                          <Play className="h-3 w-3 text-[#4648d4]" />
                          <span>Focus</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteQuest(quest.id)}
                        aria-label={`Delete "${quest.title}"`}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[#767586] transition-colors hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Action Result, Location References & Follow-Up Trigger Drawer */}
                  {isExpanded && (
                    <div className="mt-3 ml-0 sm:ml-9 space-y-4 rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] p-4">
                      {/* Action Result Text Capture */}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label
                            htmlFor={`outcome-${quest.id}`}
                            className="text-xs font-bold text-[#131b2e]"
                          >
                            Action Result / Notes Captured
                          </label>
                          <button
                            type="button"
                            onClick={() => onRequestAiFollowUps(quest)}
                            disabled={questAiLoading}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#4648d4] hover:underline whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Suggest Follow-Ups with AI</span>
                          </button>
                        </div>
                        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start">
                          <textarea
                            id={`outcome-${quest.id}`}
                            rows={2}
                            value={outcomeDraftText}
                            onChange={(e) => setOutcomeDraftText(e.target.value)}
                            placeholder="Record the outcome, key decision, or deliverable details..."
                            className="arcade-input flex-1 rounded-2xl px-3.5 py-2 text-xs text-[#131b2e] placeholder:text-[#767586]"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuestOutcome(quest.id, {
                                outcomeText: outcomeDraftText,
                              })
                            }
                            className="btn-tactile-emerald shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
                          >
                            Save Result
                          </button>
                        </div>
                      </div>

                      {/* Location / Artifact References */}
                      <div className="border-t border-[#e8ebf8] pt-3">
                        <p className="text-xs font-bold text-[#131b2e]">
                          Reference Locations (URLs, file paths, docs, or places)
                        </p>
                        {refs.length > 0 && (
                          <ul className="mt-2 space-y-1.5">
                            {refs.map((ref) => {
                              const safeUrl =
                                ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                              return (
                                <li
                                  key={ref.id}
                                  className="flex items-center justify-between gap-2 text-xs text-[#131b2e]"
                                >
                                  <div className="min-w-0 truncate">
                                    <span className="font-bold">{ref.label}: </span>
                                    {safeUrl ? (
                                      <a
                                        href={safeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-[#4648d4] hover:underline"
                                      >
                                        {ref.location}
                                      </a>
                                    ) : (
                                      <span className="font-mono text-[#464554]">
                                        {ref.location}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateQuestOutcome(quest.id, {
                                        references: refs.filter((r) => r.id !== ref.id),
                                      })
                                    }
                                    aria-label={`Remove reference ${ref.label}`}
                                    className="text-[#767586] hover:text-[#ba1a1a] cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-6">
                          <input
                            type="text"
                            value={newRefLabel}
                            onChange={(e) => setNewRefLabel(e.target.value)}
                            placeholder="Label (e.g., PR #142)"
                            aria-label="New reference label"
                            className="arcade-input sm:col-span-2 rounded-2xl px-3 py-1.5 text-xs text-[#131b2e]"
                          />
                          <input
                            type="text"
                            value={newRefLocation}
                            onChange={(e) => setNewRefLocation(e.target.value)}
                            placeholder="https://..., src/file.ts, or location"
                            aria-label="New reference URL or path"
                            className="arcade-input sm:col-span-3 rounded-2xl px-3 py-1.5 text-xs text-[#131b2e]"
                          />
                          <button
                            type="button"
                            disabled={!newRefLocation.trim()}
                            onClick={() => {
                              const loc = newRefLocation.trim();
                              if (!loc) return;
                              const nextRef: QuestReference = {
                                id: `ref-${Date.now()}`,
                                label: newRefLabel.trim() || 'Reference',
                                location: loc,
                                kind: inferReferenceKind(loc),
                              };
                              onUpdateQuestOutcome(quest.id, {
                                references: [...refs, nextRef],
                              });
                              setNewRefLabel('');
                              setNewRefLocation('');
                            }}
                            className="btn-tactile-ghost rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            Add Ref
                          </button>
                        </div>
                      </div>

                      {/* Follow-Up Trigger Rules */}
                      <div className="border-t border-[#e8ebf8] pt-3">
                        <p className="text-xs font-bold text-[#131b2e]">
                          Follow-Up Quests on Completion
                        </p>
                        {rules.length > 0 && (
                          <ul className="mt-2 space-y-1.5">
                            {rules.map((rule) => (
                              <li
                                key={rule.id}
                                className="flex items-center justify-between gap-2 text-xs text-[#131b2e]"
                              >
                                <span className="min-w-0 truncate">
                                  <span className="font-semibold">{rule.title}</span>
                                  <span className="text-[#464554] tabular-nums">
                                    {' '}
                                    · {rule.delayHours === 0 ? 'Immediate' : `In ${rule.delayHours}h`}
                                    {rule.triggeredAt ? ' · Triggered' : ' · Armed'}
                                  </span>
                                </span>
                                {!rule.triggeredAt && (
                                  <button
                                    type="button"
                                    onClick={() => onRemoveQuestFollowUpRule(quest.id, rule.id)}
                                    aria-label={`Remove follow-up rule ${rule.title}`}
                                    className="text-[#767586] hover:text-[#ba1a1a] cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-6">
                          <input
                            type="text"
                            value={newFollowUpTitle}
                            onChange={(e) => setNewFollowUpTitle(e.target.value)}
                            placeholder="Follow-up quest title..."
                            aria-label="Follow-up quest title"
                            className="arcade-input sm:col-span-3 rounded-2xl px-3 py-1.5 text-xs text-[#131b2e]"
                          />
                          <select
                            aria-label="Follow-up priority"
                            value={newFollowUpPriority}
                            onChange={(e) =>
                              setNewFollowUpPriority(e.target.value as QuestPriority)
                            }
                            className="arcade-input rounded-2xl px-2.5 py-1.5 text-xs font-bold text-[#131b2e]"
                          >
                            <option value="critical">Critical</option>
                            <option value="focus">Focus</option>
                            <option value="routine">Routine</option>
                          </select>
                          <select
                            aria-label="Follow-up trigger timing"
                            value={newFollowUpDelayHours}
                            onChange={(e) => setNewFollowUpDelayHours(Number(e.target.value))}
                            className="arcade-input rounded-2xl px-2.5 py-1.5 text-xs font-bold text-[#131b2e]"
                          >
                            <option value={0}>Immediate</option>
                            <option value={24}>After 24h</option>
                            <option value={72}>After 3d</option>
                            <option value={168}>After 7d</option>
                          </select>
                          <button
                            type="button"
                            disabled={!newFollowUpTitle.trim()}
                            onClick={() => {
                              const trimmed = newFollowUpTitle.trim();
                              if (!trimmed) return;
                              onAddQuestFollowUpRule(quest.id, {
                                title: trimmed,
                                category: quest.category,
                                priority: newFollowUpPriority,
                                delayHours: newFollowUpDelayHours,
                              });
                              setNewFollowUpTitle('');
                            }}
                            className="btn-tactile-primary rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            Arm Rule
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 4. Boss Encounter Module (Active Raid or Empty Launcher) */}
      {bossEncounterSection}

      {/* 5. AI Quest Planner & Input Parser */}
      {aiQuestPlannerSection}

      {/* 6a. Upcoming Deferred / Parked Boss Raids */}
      {upcomingDeferredRaids.length > 0 && (
        <section className="arcade-card rounded-3xl p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e8ebf8] pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-[#131b2e]">
                Deferred Boss Raids ({upcomingDeferredRaids.length})
              </h2>
              <p className="text-xs text-[#464554]">
                Parked milestones keep all gate progress, outcomes, and references intact until resumed.
              </p>
            </div>
          </div>

          <ul className="divide-y divide-[#eef0ff]">
            {upcomingDeferredRaids.map(renderDeferredRaidRow)}
          </ul>
        </section>
      )}

      {/* 6b. Shipped Boss Raids Archive */}
      {state.raidHistory.length > 0 && (
        <section className="arcade-card rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="h-4 w-4 text-[#006c49]" />
              <div>
                <h2 className="text-sm font-extrabold text-[#131b2e]">
                  Shipped Boss Raids ({state.raidHistory.length})
                </h2>
                <p className="text-xs text-[#464554]">
                  Archived milestones preserve your gate evidence, debrief notes, and ship links.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRaidHistory((v) => !v)}
              aria-expanded={showRaidHistory}
              className="btn-tactile-ghost inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <span>{showRaidHistory ? 'Hide Archive' : 'View Archive'}</span>
              {showRaidHistory ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {showRaidHistory && (
            <ul className="divide-y divide-[#eef0ff] border-t border-[#e8ebf8] pt-2">
              {state.raidHistory.map((archived) => {
                const totalXp = archived.rewardXp + (archived.stretchBonusXpAwarded || 0);
                const totalCoins =
                  archived.rewardCoins +
                  (archived.bonusCoinsAwarded || 0) +
                  (archived.stretchBonusCoinsAwarded || 0);
                const allRefs: QuestReference[] = [
                  ...(archived.raidReferences || []),
                  ...archived.steps.flatMap((s) => s.references || []),
                ];
                return (
                  <li key={archived.id} className="py-3 first:pt-2 last:pb-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#131b2e]">{archived.title}</p>
                        <p className="mt-0.5 text-xs text-[#464554] tabular-nums">
                          +{totalXp} XP · +{totalCoins} Coins ·{' '}
                          {archived.steps.filter((s) => s.completed).length}/{archived.steps.length}{' '}
                          gates
                          {archived.claimedAt
                            ? ` · Claimed ${new Date(archived.claimedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteArchivedRaid(archived.id)}
                        aria-label={`Remove archived raid "${archived.title}"`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {archived.raidOutcomeText && (
                      <p className="text-xs font-medium text-[#131b2e]">
                        {archived.raidOutcomeText}
                      </p>
                    )}
                    {allRefs.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {allRefs.map((ref) => {
                          const safeUrl =
                            ref.kind === 'url' ? sanitizeReferenceUrl(ref.location) : null;
                          return safeUrl ? (
                            <a
                              key={ref.id}
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#4648d4] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>{ref.label}</span>
                            </a>
                          ) : (
                            <button
                              key={ref.id}
                              type="button"
                              onClick={() => handleCopyLocation(ref)}
                              title={`Copy: ${ref.location}`}
                              className="inline-flex items-center gap-1 font-mono text-[#464554] hover:text-[#4648d4] cursor-pointer"
                            >
                              <Copy className="h-3 w-3" />
                              <span>
                                {ref.label}
                                {copiedRefId === ref.id ? ' (Copied)' : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* 6b. Deferred / Scheduled Follow-Up Quests Queue (sorted soonest first) */}
      {orderedScheduledFollowUps.length > 0 && (
        <section
          aria-label="Scheduled follow-up quests"
          className="arcade-card rounded-3xl p-6"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#e8ebf8] pb-3.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#4648d4]" />
              <h2 className="text-sm font-extrabold text-[#131b2e]">
                Queued Follow-Up Quests
              </h2>
            </div>
            <span className="text-xs font-semibold tabular-nums text-[#464554]">
              {orderedScheduledFollowUps.length} pending trigger
            </span>
          </div>

          <ul className="mt-3 divide-y divide-[#eef0ff]">
            {orderedScheduledFollowUps.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2.5 py-3 first:pt-1 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#131b2e]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[#464554] tabular-nums">
                    From: {item.parentQuestTitle} · Triggers{' '}
                    {new Date(item.triggerAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {item.parentReferences && item.parentReferences.length > 0
                      ? ` · ${item.parentReferences.length} ref${
                          item.parentReferences.length === 1 ? '' : 's'
                        } linked`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onTriggerScheduledFollowUpNow(item.id)}
                    className="btn-tactile-ghost rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    Trigger Now
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscardScheduledFollowUp(item.id)}
                    aria-label={`Cancel queued follow-up "${item.title}"`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
