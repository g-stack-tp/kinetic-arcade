export type ScreenId = 'quests' | 'habits' | 'focus' | 'vault' | 'experience';

export type AvatarEmblem = 'bolt' | 'compass' | 'code' | 'flame' | 'trophy' | 'star';

export type AvatarTone = 'indigo' | 'emerald' | 'amber' | 'coral';

export type AiModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export type QuestPriority = 'critical' | 'focus' | 'routine';

export type QuestCategory = 'Deep Work' | 'Engineering' | 'Design' | 'Writing' | 'Health';

export type QuestReferenceKind = 'url' | 'path' | 'note';

export interface QuestReference {
  id: string;
  label: string;
  location: string;
  kind: QuestReferenceKind;
}

export interface FollowUpRule {
  id: string;
  title: string;
  notes?: string;
  category: QuestCategory;
  priority: QuestPriority;
  delayHours: number;
  xpReward: number;
  coinReward: number;
  triggeredAt?: string;
}

export interface ScheduledFollowUp {
  id: string;
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
  createdAt: string;
  triggerAt: string;
}

export interface Quest {
  id: string;
  title: string;
  notes?: string;
  category: QuestCategory;
  priority: QuestPriority;
  xpReward: number;
  coinReward: number;
  dueLabel: string;
  completed: boolean;
  completedAt?: string;
  bossStepId?: string;
  outcomeText?: string;
  references?: QuestReference[];
  followUpRules?: FollowUpRule[];
  parentQuestId?: string;
  triggeredFromTitle?: string;
}

export type BossCommitment = 'required' | 'optional';

export interface BossStep {
  id: string;
  title: string;
  damage: number;
  completed: boolean;
  optional?: boolean;
  outcomeText?: string;
  references?: QuestReference[];
}

export interface BossEncounter {
  id: string;
  title: string;
  subtitle: string;
  commitment?: BossCommitment;
  maxHp: number;
  rewardXp: number;
  rewardCoins: number;
  bountyClaimed: boolean;
  claimedAt?: string;
  bonusCoinsAwarded?: number;
  stretchBonusXpAwarded?: number;
  stretchBonusCoinsAwarded?: number;
  deferredAt?: string;
  resumeAt?: string;
  deferReason?: string;
  raidOutcomeText?: string;
  raidReferences?: QuestReference[];
  steps: BossStep[];
}

export interface Habit {
  id: string;
  title: string;
  category: string;
  xpReward: number;
  coinReward: number;
  targetDaysPerWeek: number;
  /** Map of YYYY-MM-DD -> boolean */
  history: Record<string, boolean>;
}

export interface DailyBounty {
  id: string;
  title: string;
  description: string;
  target: number;
  metric: 'quests' | 'habits' | 'focusMinutes';
  xpReward: number;
  coinReward: number;
  claimed: boolean;
}

export interface FocusSession {
  id: string;
  questId?: string;
  questTitle: string;
  durationMinutes: number;
  xpEarned: number;
  coinsEarned: number;
  completedAt: string;
}

export interface RewardItem {
  id: string;
  title: string;
  description: string;
  costCoins: number;
  kind: 'boost' | 'shield' | 'treat';
  isCustom?: boolean;
}

export interface RedeemedReward {
  id: string;
  rewardId: string;
  title: string;
  kind: 'boost' | 'shield' | 'treat';
  redeemedAt: string;
  used: boolean;
}

export interface ToastEvent {
  id: string;
  title: string;
  detail: string;
  tone: 'indigo' | 'amber' | 'emerald' | 'coral';
}

export interface QuestDraft {
  draftId: string;
  title: string;
  notes?: string;
  category: QuestCategory;
  priority: QuestPriority;
  xpReward: number;
  coinReward: number;
  dueLabel: string;
  rationale?: string;
  sourceMode: 'aligned' | 'parsed' | 'followup';
  parentQuestId?: string;
  triggeredFromTitle?: string;
  references?: QuestReference[];
}

export interface BossDraftStep {
  id: string;
  title: string;
  optional?: boolean;
}

export interface BossDraft {
  draftId: string;
  title: string;
  subtitle: string;
  commitment?: BossCommitment;
  steps: BossDraftStep[];
}

export interface HabitDraft {
  draftId: string;
  title: string;
  category: string;
  xpReward: number;
  coinReward: number;
  targetDaysPerWeek: number;
  rationale?: string;
  sourceMode: 'aligned' | 'parsed';
}

export interface AppState {
  playerName: string;
  playerRole: string;
  avatarEmblem: AvatarEmblem;
  avatarTone: AvatarTone;
  dailyFocusGoalMinutes: number;
  defaultSprintMinutes: number;
  xp: number;
  coins: number;
  streakDays: number;
  streakShields: number;
  doubleXpCharges: number;
  focusMinutesToday: number;
  questsCompletedToday: number;
  habitsCheckedToday: number;
  soundEnabled: boolean;
  aiModel: AiModelId;
  aiAutoFallback: boolean;
  quests: Quest[];
  questDrafts: QuestDraft[];
  scheduledFollowUps: ScheduledFollowUp[];
  boss: BossEncounter | null;
  bossDraft: BossDraft | null;
  deferredRaids: BossEncounter[];
  raidHistory: BossEncounter[];
  habits: Habit[];
  habitDrafts: HabitDraft[];
  bounties: DailyBounty[];
  focusSessions: FocusSession[];
  rewards: RewardItem[];
  redeemedRewards: RedeemedReward[];
}
