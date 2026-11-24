import { AppState } from '../types';

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTrailingDays(count: number): { key: string; shortDay: string; dayNum: string; isToday: boolean }[] {
  const days: { key: string; shortDay: string; dayNum: string; isToday: boolean }[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      key: formatDateKey(d),
      shortDay: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: String(d.getDate()),
      isToday: i === 0,
    });
  }
  return days;
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
  rankTitle: string;
}

const RANK_TITLES = [
  'Apprentice Builder',
  'Focused Tactician',
  'Kinetic Specialist',
  'Momentum Architect',
  'Sprint Vanguard',
  'Arcade Grandmaster',
];

export function getLevelInfo(totalXp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  let threshold = 250;

  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = 250 + (level - 1) * 100;
  }

  const rankIndex = Math.min(RANK_TITLES.length - 1, Math.floor((level - 1) / 2));
  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp: threshold,
    percent: Math.min(100, Math.round((remaining / threshold) * 100)),
    rankTitle: RANK_TITLES[rankIndex],
  };
}

export function computeHabitStreak(history: Record<string, boolean>): number {
  const today = new Date();
  let streak = 0;
  // Check if today is checked; if not, allow streak starting from yesterday so active streaks don't vanish mid-day
  const todayKey = formatDateKey(today);
  const startOffset = history[todayKey] ? 0 : 1;

  for (let i = startOffset; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    if (history[key]) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function createInitialState(): AppState {
  const days = getTrailingDays(7);
  const todayKey = days[6].key;
  const d1 = days[5].key;
  const d2 = days[4].key;
  const d3 = days[3].key;
  const d4 = days[2].key;
  const d5 = days[1].key;
  const d6 = days[0].key;

  return {
    playerName: 'Alex Rivera',
    playerRole: 'Product Builder',
    avatarEmblem: 'bolt',
    avatarTone: 'indigo',
    dailyFocusGoalMinutes: 90,
    defaultSprintMinutes: 25,
    xp: 710,
    coins: 145,
    streakDays: 6,
    streakShields: 1,
    doubleXpCharges: 0,
    focusMinutesToday: 25,
    questsCompletedToday: 1,
    habitsCheckedToday: 2,
    soundEnabled: true,
    aiModel: 'gemini-4-hydrogen',
    aiAutoFallback: true,
    questDrafts: [],
    scheduledFollowUps: [],
    habitDrafts: [],
    bossDraft: null,
    deferredRaids: [],
    raidHistory: [],
    boss: {
      id: 'boss-launch-v2',
      title: 'Release Candidate v2.4',
      subtitle: 'Milestone Raid · Defeat all 4 engineering & design gates to claim the vault bonus.',
      maxHp: 400,
      rewardXp: 300,
      rewardCoins: 120,
      bountyClaimed: false,
      steps: [
        {
          id: 'step-1',
          title: 'Audit keyboard navigation and contrast across checkout modal',
          damage: 100,
          completed: true,
          outcomeText: 'Verified tab trap, Escape dismissal, and WCAG AA contrast across all interactive buttons.',
          references: [
            {
              id: 'ref-boss-1',
              label: 'A11y Checklist',
              location: 'docs/05-quality-and-regression-blueprint.md',
              kind: 'path',
            },
          ],
        },
        {
          id: 'step-2',
          title: 'Finalize webhook retry logic & idempotency keys',
          damage: 100,
          completed: false,
        },
        {
          id: 'step-3',
          title: 'Record 90-second product walkthrough for release notes',
          damage: 100,
          completed: false,
        },
        {
          id: 'step-4',
          title: 'Tag production build and verify telemetry smoke test',
          damage: 100,
          completed: false,
        },
      ],
    },
    quests: [
      {
        id: 'q-1',
        title: 'Write architecture RFC for offline sync queue',
        notes: 'Include conflict resolution edge cases and storage quota estimates.',
        category: 'Engineering',
        priority: 'critical',
        xpReward: 140,
        coinReward: 35,
        dueLabel: 'Today, 2:00 PM',
        completed: false,
        followUpRules: [
          {
            id: 'fur-1',
            title: 'Schedule architecture RFC review & sign-off',
            category: 'Engineering',
            priority: 'focus',
            delayHours: 24,
            xpReward: 85,
            coinReward: 22,
          },
        ],
      },
      {
        id: 'q-2',
        title: 'Polish onboarding empty-state illustrations & copy',
        notes: 'Keep microcopy concise and actionable.',
        category: 'Design',
        priority: 'focus',
        xpReward: 95,
        coinReward: 25,
        dueLabel: 'Today, 4:30 PM',
        completed: false,
      },
      {
        id: 'q-3',
        title: 'Review 3 pull requests from design systems squad',
        category: 'Engineering',
        priority: 'routine',
        xpReward: 65,
        coinReward: 18,
        dueLabel: 'Today, 6:00 PM',
        completed: false,
      },
      {
        id: 'q-4',
        title: 'Draft weekly changelog email for beta cohort',
        category: 'Writing',
        priority: 'focus',
        xpReward: 85,
        coinReward: 22,
        dueLabel: 'Tomorrow',
        completed: false,
      },
      {
        id: 'q-5',
        title: '40-minute zone 2 run before dinner',
        category: 'Health',
        priority: 'routine',
        xpReward: 75,
        coinReward: 20,
        dueLabel: 'Today, 7:00 PM',
        completed: false,
      },
      {
        id: 'q-6',
        title: 'Clear morning inbox triage under 15 minutes',
        category: 'Deep Work',
        priority: 'routine',
        xpReward: 50,
        coinReward: 15,
        dueLabel: 'Completed 9:20 AM',
        completed: true,
        completedAt: new Date().toISOString(),
        outcomeText: 'Archived 18 threads, escalated billing ticket #408, and cleared priority queue.',
        references: [
          {
            id: 'ref-init-1',
            label: 'Triage Playbook',
            location: 'docs/02-functional-architecture.md',
            kind: 'path',
          },
        ],
      },
    ],
    habits: [
      {
        id: 'h-1',
        title: 'Morning Deep Work Block (90m before Slack)',
        category: 'Deep Work',
        xpReward: 45,
        coinReward: 12,
        targetDaysPerWeek: 5,
        history: {
          [d6]: true,
          [d5]: true,
          [d4]: true,
          [d3]: false,
          [d2]: true,
          [d1]: true,
          [todayKey]: true,
        },
      },
      {
        id: 'h-2',
        title: 'Zero Inbox Before Shutdown',
        category: 'Operations',
        xpReward: 30,
        coinReward: 10,
        targetDaysPerWeek: 5,
        history: {
          [d6]: true,
          [d5]: true,
          [d4]: false,
          [d3]: true,
          [d2]: true,
          [d1]: true,
          [todayKey]: false,
        },
      },
      {
        id: 'h-3',
        title: 'Hydrate 2.5L + Electrolytes',
        category: 'Health',
        xpReward: 25,
        coinReward: 8,
        targetDaysPerWeek: 7,
        history: {
          [d6]: true,
          [d5]: true,
          [d4]: true,
          [d3]: true,
          [d2]: true,
          [d1]: true,
          [todayKey]: true,
        },
      },
      {
        id: 'h-4',
        title: 'Read 20 Pages Technical / Non-Fiction',
        category: 'Learning',
        xpReward: 35,
        coinReward: 10,
        targetDaysPerWeek: 6,
        history: {
          [d6]: false,
          [d5]: true,
          [d4]: true,
          [d3]: true,
          [d2]: false,
          [d1]: true,
          [todayKey]: false,
        },
      },
      {
        id: 'h-5',
        title: 'Evening Mobility & Screen Cutoff (10 PM)',
        category: 'Health',
        xpReward: 30,
        coinReward: 10,
        targetDaysPerWeek: 7,
        history: {
          [d6]: true,
          [d5]: false,
          [d4]: true,
          [d3]: true,
          [d2]: true,
          [d1]: true,
          [todayKey]: false,
        },
      },
    ],
    bounties: [
      {
        id: 'b-1',
        title: 'Momentum Opener',
        description: 'Complete 3 quests today',
        target: 3,
        metric: 'quests',
        xpReward: 80,
        coinReward: 25,
        claimed: false,
      },
      {
        id: 'b-2',
        title: 'Habit Rhythm',
        description: 'Check off 3 daily habits today',
        target: 3,
        metric: 'habits',
        xpReward: 60,
        coinReward: 20,
        claimed: false,
      },
      {
        id: 'b-3',
        title: 'Arena Sprinter',
        description: 'Log 25 minutes in Focus Arena',
        target: 25,
        metric: 'focusMinutes',
        xpReward: 75,
        coinReward: 30,
        claimed: false,
      },
    ],
    focusSessions: [
      {
        id: 'fs-1',
        questId: 'q-6',
        questTitle: 'Clear morning inbox triage under 15 minutes',
        durationMinutes: 25,
        xpEarned: 60,
        coinsEarned: 15,
        completedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      },
    ],
    rewards: [
      {
        id: 'r-1',
        title: 'Double XP Boost (3 Quests)',
        description: 'Multiplies XP earned on your next 3 quest completions by 2x.',
        costCoins: 80,
        kind: 'boost',
      },
      {
        id: 'r-2',
        title: 'Streak Shield Token',
        description: 'Automatically protects your daily streak if you miss a day.',
        costCoins: 65,
        kind: 'shield',
      },
      {
        id: 'r-3',
        title: 'Espresso & Pastry Run',
        description: 'Guilt-free cafe break after clearing your afternoon block.',
        costCoins: 50,
        kind: 'treat',
      },
      {
        id: 'r-4',
        title: '45m Uninterrupted Gaming Session',
        description: 'Clock out cleanly for an evening arcade or console session.',
        costCoins: 90,
        kind: 'treat',
      },
      {
        id: 'r-5',
        title: 'Weekend Vinyl / Book Pick',
        description: 'Reward a high-output week with a new album or hardcover.',
        costCoins: 240,
        kind: 'treat',
      },
    ],
    redeemedRewards: [
      {
        id: 'rr-1',
        rewardId: 'r-3',
        title: 'Espresso & Pastry Run',
        kind: 'treat',
        redeemedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        used: true,
      },
    ],
  };
}

export function createStudyPresetState(profile?: Partial<AppState>): AppState {
  const base = createInitialState();
  const days = getTrailingDays(7);
  const todayKey = days[6].key;
  const d1 = days[5].key;
  const d2 = days[4].key;

  return {
    ...base,
    playerName: profile?.playerName || 'Jordan Park',
    playerRole: profile?.playerRole || 'Graduate Researcher',
    avatarEmblem: profile?.avatarEmblem || 'compass',
    avatarTone: profile?.avatarTone || 'emerald',
    dailyFocusGoalMinutes: profile?.dailyFocusGoalMinutes || 120,
    defaultSprintMinutes: profile?.defaultSprintMinutes || 50,
    soundEnabled: profile?.soundEnabled ?? true,
    aiModel: profile?.aiModel || 'gemini-4-hydrogen',
    aiAutoFallback: profile?.aiAutoFallback ?? true,
    xp: 480,
    coins: 95,
    streakDays: 3,
    focusMinutesToday: 50,
    questsCompletedToday: 1,
    habitsCheckedToday: 2,
    boss: {
      id: 'boss-thesis-review',
      title: 'Literature Synthesis & Draft Chapter 2',
      subtitle: 'Research Raid · Complete all 4 milestone gates to earn the archive bonus.',
      maxHp: 400,
      rewardXp: 320,
      rewardCoins: 140,
      bountyClaimed: false,
      steps: [
        { id: 's-1', title: 'Annotate 6 primary empirical papers', damage: 100, completed: true },
        { id: 's-2', title: 'Organize comparison matrix in Zotero', damage: 100, completed: false },
        { id: 's-3', title: 'Write 1,500-word methodology synthesis', damage: 100, completed: false },
        { id: 's-4', title: 'Verify citations and export PDF proof', damage: 100, completed: false },
      ],
    },
    quests: [
      {
        id: 'sq-1',
        title: 'Complete spaced-repetition flashcard deck (45 cards)',
        category: 'Deep Work',
        priority: 'critical',
        xpReward: 120,
        coinReward: 30,
        dueLabel: 'Today, 3:00 PM',
        completed: false,
      },
      {
        id: 'sq-2',
        title: 'Summarize Section 4 statistical findings',
        category: 'Writing',
        priority: 'focus',
        xpReward: 95,
        coinReward: 25,
        dueLabel: 'Today, 6:00 PM',
        completed: false,
      },
      {
        id: 'sq-3',
        title: 'Outline seminar discussion prompts',
        category: 'Writing',
        priority: 'routine',
        xpReward: 60,
        coinReward: 15,
        dueLabel: 'Tomorrow',
        completed: false,
      },
      {
        id: 'sq-4',
        title: 'Morning reading block (30 pages)',
        category: 'Deep Work',
        priority: 'routine',
        xpReward: 55,
        coinReward: 15,
        dueLabel: 'Completed 10:15 AM',
        completed: true,
        completedAt: new Date().toISOString(),
      },
    ],
    habits: [
      {
        id: 'sh-1',
        title: 'Active Recall Drill (25m)',
        category: 'Learning',
        xpReward: 40,
        coinReward: 12,
        targetDaysPerWeek: 6,
        history: { [d2]: true, [d1]: true, [todayKey]: true },
      },
      {
        id: 'sh-2',
        title: 'Annotated Reading Notes',
        category: 'Deep Work',
        xpReward: 35,
        coinReward: 10,
        targetDaysPerWeek: 5,
        history: { [d2]: true, [d1]: true, [todayKey]: true },
      },
      {
        id: 'sh-3',
        title: 'Afternoon Walk Without Phone',
        category: 'Health',
        xpReward: 25,
        coinReward: 8,
        targetDaysPerWeek: 7,
        history: { [d2]: false, [d1]: true, [todayKey]: false },
      },
    ],
    focusSessions: [
      {
        id: 'sfs-1',
        questId: 'sq-4',
        questTitle: 'Morning reading block (30 pages)',
        durationMinutes: 50,
        xpEarned: 125,
        coinsEarned: 30,
        completedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
    ],
  };
}

export function createBlankSlateState(profile?: Partial<AppState>): AppState {
  const base = createInitialState();
  return {
    playerName: profile?.playerName || 'Player One',
    playerRole: profile?.playerRole || 'Kinetic Builder',
    avatarEmblem: profile?.avatarEmblem || 'bolt',
    avatarTone: profile?.avatarTone || 'indigo',
    dailyFocusGoalMinutes: profile?.dailyFocusGoalMinutes || 90,
    defaultSprintMinutes: profile?.defaultSprintMinutes || 25,
    soundEnabled: profile?.soundEnabled ?? true,
    aiModel: profile?.aiModel || 'gemini-4-hydrogen',
    aiAutoFallback: profile?.aiAutoFallback ?? true,
    xp: 0,
    coins: 0,
    streakDays: 0,
    streakShields: 0,
    doubleXpCharges: 0,
    focusMinutesToday: 0,
    questsCompletedToday: 0,
    habitsCheckedToday: 0,
    quests: [],
    questDrafts: [],
    scheduledFollowUps: [],
    boss: null,
    bossDraft: null,
    deferredRaids: [],
    raidHistory: [],
    habits: [],
    habitDrafts: [],
    bounties: base.bounties.map((b) => ({ ...b, claimed: false })),
    focusSessions: [],
    rewards: base.rewards,
    redeemedRewards: [],
  };
}

