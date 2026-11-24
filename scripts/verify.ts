import assert from 'node:assert/strict';
import {
  createInitialState,
  createStudyPresetState,
  formatDateKey,
  getLevelInfo,
} from '../src/data/initialData';
import {
  addQuestFollowUpRuleState,
  approveAllHabitDraftsState,
  approveAllQuestDraftsState,
  approveBossDraftState,
  approveHabitDraftState,
  approveQuestDraftState,
  archiveBossEncounterState,
  bossHasEvidence,
  clampHabitDraft,
  clampQuestDraft,
  claimBossBountyState,
  clearBossEncounterState,
  clearCompletedQuestsState,
  clearHabitDraftsState,
  clearQuestDraftsState,
  computeBossDocumentationBonus,
  createBossEncounterState,
  deferBossEncounterState,
  deleteArchivedRaidState,
  discardBossDraftState,
  discardDeferredRaidState,
  discardHabitDraftState,
  discardQuestDraftState,
  discardScheduledFollowUpState,
  evaluateScheduledFollowUpsState,
  DEFAULT_AI_MODEL,
  filterAndOrderQuests,
  getAiModelLabel,
  getBossProgress,
  getDueDeferredRaids,
  hydrateWorkspaceState,
  inferReferenceKind,
  normalizeAiModel,
  orderBossSteps,
  orderDeferredRaids,
  orderScheduledFollowUps,
  parseAndHydrateWorkspaceJson,
  purgeWorkspaceState,
  questHasOutcomeOrReferences,
  removeQuestFollowUpRuleState,
  resumeDeferredRaidState,
  sanitizeReferenceUrl,
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
} from '../src/utils/workspaceState';
import {
  buildHabitHeatmapModel,
  classifyCellIntensity,
  TrailingDaySlot,
} from '../src/utils/habitHeatmap';
import { BossDraft, Habit, HabitDraft, Quest, QuestDraft } from '../src/types';

let passed = 0;
let failed = 0;

function verify(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

verify('Purge workspace clears quests, drafts, habits, boss encounter, XP, and coins (keep profile)', () => {
  const initial = createInitialState();
  initial.playerName = 'Samira Chen';
  initial.playerRole = 'Staff Engineer';
  initial.avatarEmblem = 'code';
  initial.avatarTone = 'emerald';
  initial.questDrafts = [
    {
      draftId: 'd-1',
      title: 'Staged draft',
      category: 'Engineering',
      priority: 'focus',
      xpReward: 90,
      coinReward: 22,
      dueLabel: 'Today',
      sourceMode: 'aligned',
    },
  ];
  initial.bossDraft = {
    draftId: 'bd-1',
    title: 'Draft Raid',
    subtitle: 'Sub',
    steps: [{ id: 's1', title: 'Gate 1' }],
  };
  initial.habitDrafts = [
    {
      draftId: 'hd-1',
      title: 'Staged habit',
      category: 'Health',
      xpReward: 35,
      coinReward: 10,
      targetDaysPerWeek: 5,
      sourceMode: 'aligned',
    },
  ];

  const purged = purgeWorkspaceState(initial, true);

  assert.equal(purged.quests.length, 0, 'Expected all quests cleared');
  assert.equal(purged.questDrafts.length, 0, 'Expected all quest drafts cleared');
  assert.equal(purged.boss, null, 'Expected boss encounter cleared (no residual DMG steps)');
  assert.equal(purged.bossDraft, null, 'Expected boss draft cleared');
  assert.equal(purged.habits.length, 0, 'Expected all habits cleared');
  assert.equal(purged.habitDrafts.length, 0, 'Expected all habit drafts cleared');
  assert.equal(purged.focusSessions.length, 0, 'Expected focus sessions cleared');
  assert.equal(purged.redeemedRewards.length, 0, 'Expected redeemed rewards cleared');
  assert.equal(purged.xp, 0);
  assert.equal(purged.coins, 0);
  assert.equal(purged.streakDays, 0);
  assert.equal(purged.questsCompletedToday, 0);
  assert.equal(purged.habitsCheckedToday, 0);
  assert.equal(purged.focusMinutesToday, 0);
  assert.ok(purged.bounties.every((b) => !b.claimed), 'Expected bounties reset');

  assert.equal(purged.playerName, 'Samira Chen');
  assert.equal(purged.playerRole, 'Staff Engineer');
  assert.equal(purged.avatarEmblem, 'code');
  assert.equal(purged.avatarTone, 'emerald');
});

verify('Purge everything resets profile fields back to blank defaults', () => {
  const initial = createInitialState();
  initial.playerName = 'Custom User';
  const purged = purgeWorkspaceState(initial, false);

  assert.equal(purged.playerName, 'Player One');
  assert.equal(purged.playerRole, 'Kinetic Builder');
  assert.equal(purged.boss, null);
  assert.equal(purged.bossDraft, null);
  assert.equal(purged.quests.length, 0);
  assert.equal(purged.questDrafts.length, 0);
});

verify('Hydration preserves explicit boss: null across reloads and JSON imports', () => {
  const purged = purgeWorkspaceState(createInitialState(), true);
  const json = JSON.stringify(purged);
  const result = parseAndHydrateWorkspaceJson(json);

  assert.equal(result.ok, true);
  assert.ok(result.state);
  assert.equal(result.state.boss, null, 'Reloading purged JSON must not restore default boss');
  assert.equal(result.state.quests.length, 0);

  const hydratedDirect = hydrateWorkspaceState(JSON.parse(json));
  assert.equal(hydratedDirect.boss, null);
});

verify('Malformed or invalid JSON import is rejected cleanly', () => {
  const badSyntax = parseAndHydrateWorkspaceJson('{not-json');
  assert.equal(badSyntax.ok, false);

  const missingQuests = parseAndHydrateWorkspaceJson(JSON.stringify({ xp: 100 }));
  assert.equal(missingQuests.ok, false);
});

verify('Quest Board search filters both active and completed quests under All mode', () => {
  const state = createInitialState();
  const filteredInbox = filterAndOrderQuests(state.quests, 'all', 'inbox');
  assert.equal(filteredInbox.length, 1);
  assert.equal(filteredInbox[0].id, 'q-6');

  const filteredNonexistent = filterAndOrderQuests(state.quests, 'all', 'zzzz-no-match');
  assert.equal(filteredNonexistent.length, 0, 'Completed quests must not bypass searchQuery');
});

verify('Clear Completed removes finished quests while preserving active quests', () => {
  const state = createInitialState();
  const activeBefore = state.quests.filter((q) => !q.completed).length;
  const completedBefore = state.quests.filter((q) => q.completed).length;
  assert.ok(completedBefore > 0, 'Fixture should include at least 1 completed quest');

  const { nextState, removedCount } = clearCompletedQuestsState(state);
  assert.equal(removedCount, completedBefore);
  assert.equal(nextState.quests.length, activeBefore);
  assert.ok(nextState.quests.every((q) => !q.completed));
});

verify('Quest completion applies Double XP Boost once and consumes one charge', () => {
  const state = createInitialState();
  state.doubleXpCharges = 1;
  const target = state.quests.find((q) => !q.completed)!;
  const baseXp = state.xp;

  const { nextState, completedNow, xpDelta, boostUsed } = toggleQuestCompletionState(
    state,
    target.id
  );
  assert.equal(completedNow, true);
  assert.equal(boostUsed, true);
  assert.equal(xpDelta, target.xpReward * 2);
  assert.equal(nextState.xp, baseXp + target.xpReward * 2);
  assert.equal(nextState.doubleXpCharges, 0);
});

verify('Boss Encounter can be created, damaged, claimed, and cleared', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  assert.equal(state.boss, null);

  state = createBossEncounterState(state, 'Launch Sprint', 'Ship v1', ['Step A', 'Step B']);
  assert.ok(state.boss);
  assert.equal(state.boss.maxHp, 200);
  assert.equal(state.boss.steps.length, 2);

  const earlyClaim = claimBossBountyState(state);
  assert.equal(earlyClaim.claimed, false);

  const createdBoss = state.boss!;
  state = toggleBossStepState(state, createdBoss.steps[0].id);
  state = toggleBossStepState(state, createdBoss.steps[1].id);

  const validClaim = claimBossBountyState(state);
  assert.equal(validClaim.claimed, true);
  assert.equal(validClaim.nextState.xp, createdBoss.rewardXp);
  assert.equal(validClaim.nextState.coins, createdBoss.rewardCoins);

  const cleared = clearBossEncounterState(validClaim.nextState);
  assert.equal(cleared.boss, null);
});

verify('HITL Quest Drafts isolate unapproved drafts, clamp XP/Coins, and promote to Actuals only on Approve', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  const rawDrafts: QuestDraft[] = [
    {
      draftId: 'd-clamp',
      title: '  Write payment webhook integration tests  ',
      category: 'Engineering',
      priority: 'critical',
      xpReward: 9999, // Must clamp to 200
      coinReward: 500, // Must clamp to 60
      dueLabel: 'Today, 4 PM',
      sourceMode: 'parsed',
    },
    {
      draftId: 'd-discard',
      title: 'Low priority optional task',
      category: 'Deep Work',
      priority: 'routine',
      xpReward: 5, // Must clamp to 20
      coinReward: 1, // Must clamp to 10
      dueLabel: 'Tomorrow',
      sourceMode: 'aligned',
    },
  ];

  // Staging drafts must NOT mutate actual quests, xp, or coins
  state = stageQuestDraftsState(state, rawDrafts);
  assert.equal(state.quests.length, 0);
  assert.equal(state.xp, 0);
  assert.equal(state.coins, 0);
  assert.equal(state.questDrafts.length, 2);
  assert.equal(state.questDrafts[0].xpReward, 200);
  assert.equal(state.questDrafts[0].coinReward, 60);
  assert.equal(state.questDrafts[1].xpReward, 20);
  assert.equal(state.questDrafts[1].coinReward, 10);

  // Human edits the first draft inline
  state = updateQuestDraftState(state, 'd-clamp', {
    title: 'Ship webhook retry & tests',
    xpReward: 150,
  });
  assert.equal(state.questDrafts[0].title, 'Ship webhook retry & tests');
  assert.equal(state.questDrafts[0].xpReward, 150);

  // Human discards the second draft
  state = discardQuestDraftState(state, 'd-discard');
  assert.equal(state.questDrafts.length, 1);
  assert.equal(state.quests.length, 0);

  // Human approves the edited draft into an Actual Quest
  const approved = approveQuestDraftState(state, 'd-clamp');
  assert.ok(approved.approvedQuest);
  assert.equal(approved.approvedQuest.title, 'Ship webhook retry & tests');
  assert.equal(approved.approvedQuest.completed, false);
  assert.equal(approved.nextState.questDrafts.length, 0);
  assert.equal(approved.nextState.quests.length, 1);
  // Approving creates an active quest without prematurely awarding XP before completion
  assert.equal(approved.nextState.xp, 0);
});

verify('HITL Batch Approve & Clear Drafts work cleanly', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  state = stageQuestDraftsState(state, [
    clampQuestDraft({
      draftId: 'b-1',
      title: 'Draft One',
      category: 'Design',
      priority: 'focus',
      xpReward: 80,
      coinReward: 20,
      dueLabel: 'Today',
      sourceMode: 'aligned',
    }),
    clampQuestDraft({
      draftId: 'b-2',
      title: 'Draft Two',
      category: 'Writing',
      priority: 'routine',
      xpReward: 60,
      coinReward: 15,
      dueLabel: 'Tomorrow',
      sourceMode: 'parsed',
    }),
  ]);

  const batch = approveAllQuestDraftsState(state);
  assert.equal(batch.approvedCount, 2);
  assert.equal(batch.nextState.questDrafts.length, 0);
  assert.equal(batch.nextState.quests.length, 2);

  const cleared = clearQuestDraftsState(state);
  assert.equal(cleared.questDrafts.length, 0);
  assert.equal(cleared.quests.length, 0);
});

verify('HITL Boss Draft decomposes, edits, discards, and promotes to active Boss Encounter', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  const draft: BossDraft = {
    draftId: 'bd-1',
    title: 'Auth Migration Raid',
    subtitle: 'Move session store cleanly',
    steps: [
      { id: 's1', title: 'Add Redis session adapter' },
      { id: 's2', title: 'Migrate integration tests' },
      { id: 's3', title: 'Roll out canary' },
    ],
  };

  state = stageBossDraftState(state, draft);
  assert.equal(state.boss, null, 'Staging a boss draft must not commit actual boss');
  assert.ok(state.bossDraft);

  state = updateBossDraftState(state, { title: 'Auth v2 Migration Raid' });
  assert.equal(state.bossDraft?.title, 'Auth v2 Migration Raid');

  // Discarding clears draft with no actual boss created
  const discarded = discardBossDraftState(state);
  assert.equal(discarded.bossDraft, null);
  assert.equal(discarded.boss, null);

  // Approving converts draft into active Boss Encounter
  const approved = approveBossDraftState(state);
  assert.equal(approved.approved, true);
  assert.equal(approved.nextState.bossDraft, null);
  assert.ok(approved.nextState.boss);
  assert.equal(approved.nextState.boss.title, 'Auth v2 Migration Raid');
  assert.equal(approved.nextState.boss.maxHp, 300);
  assert.equal(approved.nextState.boss.steps.length, 3);
});

verify('Habits update today check-in counter and XP accurately', () => {
  const state = createInitialState();
  const todayKey = formatDateKey(new Date());
  const uncheckedHabit = state.habits.find((h) => !h.history[todayKey])!;
  const prevXp = state.xp;
  const prevCount = state.habitsCheckedToday;

  const { nextState, checkedNow, isToday } = toggleHabitDayState(
    state,
    uncheckedHabit.id,
    todayKey
  );
  assert.equal(checkedNow, true);
  assert.equal(isToday, true);
  assert.equal(nextState.xp, prevXp + uncheckedHabit.xpReward);
  assert.equal(nextState.habitsCheckedToday, prevCount + 1);

  // Unchecking reverts checkedNow to false (does not trigger completion pulse) and restores XP
  const unchecked = toggleHabitDayState(nextState, uncheckedHabit.id, todayKey);
  assert.equal(unchecked.checkedNow, false);
  assert.equal(unchecked.isToday, true);
  assert.equal(unchecked.nextState.xp, prevXp);
  assert.equal(unchecked.nextState.habitsCheckedToday, prevCount);
});

verify('HITL Habit Drafts isolate drafts, clamp rewards/frequency, and promote to Actuals only on Approve', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  const rawHabitDrafts: HabitDraft[] = [
    {
      draftId: 'hd-clamp',
      title: '  Morning Code Review Block  ',
      category: 'Deep Work',
      xpReward: 999, // Must clamp to 80
      coinReward: 200, // Must clamp to 25
      targetDaysPerWeek: 14, // Must clamp to 7
      sourceMode: 'aligned',
    },
    {
      draftId: 'hd-discard',
      title: 'Optional stretch',
      category: 'Health',
      xpReward: 2, // Must clamp to 15
      coinReward: 1, // Must clamp to 5
      targetDaysPerWeek: 0, // Must clamp to 1
      sourceMode: 'parsed',
    },
  ];

  state = stageHabitDraftsState(state, rawHabitDrafts);
  assert.equal(state.habits.length, 0, 'Staging habit drafts must not mutate actual habits');
  assert.equal(state.habitDrafts.length, 2);
  assert.equal(state.habitDrafts[0].xpReward, 80);
  assert.equal(state.habitDrafts[0].coinReward, 25);
  assert.equal(state.habitDrafts[0].targetDaysPerWeek, 7);
  assert.equal(state.habitDrafts[1].xpReward, 15);
  assert.equal(state.habitDrafts[1].coinReward, 5);
  assert.equal(state.habitDrafts[1].targetDaysPerWeek, 1);

  state = updateHabitDraftState(state, 'hd-clamp', {
    title: 'Daily Architecture Journal',
    targetDaysPerWeek: 5,
  });
  assert.equal(state.habitDrafts[0].title, 'Daily Architecture Journal');
  assert.equal(state.habitDrafts[0].targetDaysPerWeek, 5);

  state = discardHabitDraftState(state, 'hd-discard');
  assert.equal(state.habitDrafts.length, 1);

  const approved = approveHabitDraftState(state, 'hd-clamp');
  assert.ok(approved.approvedHabit);
  assert.equal(approved.approvedHabit.title, 'Daily Architecture Journal');
  assert.equal(approved.nextState.habitDrafts.length, 0);
  assert.equal(approved.nextState.habits.length, 1);
  assert.equal(approved.nextState.xp, 0, 'Approving a habit must not award XP before check-in');

  // Batch approve & clear
  let batchState = purgeWorkspaceState(createInitialState(), true);
  batchState = stageHabitDraftsState(batchState, [
    clampHabitDraft({
      draftId: 'hb-1',
      title: 'Habit One',
      category: 'Learning',
      xpReward: 30,
      coinReward: 10,
      targetDaysPerWeek: 5,
      sourceMode: 'aligned',
    }),
    clampHabitDraft({
      draftId: 'hb-2',
      title: 'Habit Two',
      category: 'Operations',
      xpReward: 25,
      coinReward: 8,
      targetDaysPerWeek: 6,
      sourceMode: 'parsed',
    }),
  ]);
  const batchApproved = approveAllHabitDraftsState(batchState);
  assert.equal(batchApproved.approvedCount, 2);
  assert.equal(batchApproved.nextState.habitDrafts.length, 0);
  assert.equal(batchApproved.nextState.habits.length, 2);

  const cleared = clearHabitDraftsState(batchState);
  assert.equal(cleared.habitDrafts.length, 0);
  assert.equal(cleared.habits.length, 0);
});

verify('Study preset and Level math behave deterministically', () => {
  const study = createStudyPresetState({ playerName: 'Tester' });
  assert.equal(study.playerName, 'Tester');
  assert.ok(study.boss && study.boss.steps.length === 4);

  const lvl1 = getLevelInfo(0);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.currentLevelXp, 0);

  const lvl2 = getLevelInfo(250);
  assert.equal(lvl2.level, 2);
});

verify('D3 Habit Heat Map model computes 7-day intensity, completion trends, and empty state deterministically', () => {
  const days: TrailingDaySlot[] = [
    { key: '2026-11-11', shortDay: 'Wed', dayNum: '11', isToday: false },
    { key: '2026-11-12', shortDay: 'Thu', dayNum: '12', isToday: false },
    { key: '2026-11-13', shortDay: 'Fri', dayNum: '13', isToday: false },
    { key: '2026-11-14', shortDay: 'Sat', dayNum: '14', isToday: false },
    { key: '2026-11-15', shortDay: 'Sun', dayNum: '15', isToday: false },
    { key: '2026-11-16', shortDay: 'Mon', dayNum: '16', isToday: false },
    { key: '2026-11-17', shortDay: 'Tue', dayNum: '17', isToday: true },
  ];

  // Empty state invariants
  const emptyModel = buildHabitHeatmapModel([], days);
  assert.equal(emptyModel.cells.length, 0);
  assert.equal(emptyModel.dailyTrends.length, 7);
  assert.equal(emptyModel.overallAdherencePct, 0);
  assert.equal(emptyModel.dailyAveragePct, 0);
  assert.equal(emptyModel.trendDeltaPct, 0);
  assert.equal(emptyModel.peakDay, null);

  // Intensity classification invariants
  assert.equal(classifyCellIntensity(false, 7, 5), 0);
  assert.equal(classifyCellIntensity(true, 1, 5), 1);
  assert.equal(classifyCellIntensity(true, 3, 5), 2);
  assert.equal(classifyCellIntensity(true, 5, 5), 3);

  const sampleHabits: Habit[] = [
    {
      id: 'hm-1',
      title: 'Deep Work Block',
      category: 'Deep Work',
      xpReward: 40,
      coinReward: 10,
      targetDaysPerWeek: 5,
      history: {
        '2026-11-11': false,
        '2026-11-12': false,
        '2026-11-13': true,
        '2026-11-14': true,
        '2026-11-15': true,
        '2026-11-16': true,
        '2026-11-17': true,
      },
    },
    {
      id: 'hm-2',
      title: 'Evening Walk',
      category: 'Health',
      xpReward: 25,
      coinReward: 8,
      targetDaysPerWeek: 7,
      history: {
        '2026-11-11': false,
        '2026-11-12': false,
        '2026-11-13': false,
        '2026-11-14': false,
        '2026-11-15': false,
        '2026-11-16': true,
        '2026-11-17': true,
      },
    },
  ];

  const model = buildHabitHeatmapModel(sampleHabits, days);
  assert.equal(model.cells.length, 14);
  assert.equal(model.totalWeeklyTarget, 12);
  assert.equal(model.totalWeeklyChecked, 7);
  assert.equal(model.overallAdherencePct, 58);

  // Early 3 days: 0%, 0%, 50% (avg ~16.7%); recent 3 days: 50%, 100%, 100% (avg ~83.3%) -> +67 pts
  assert.equal(model.dailyTrends[0].completionRate, 0);
  assert.equal(model.dailyTrends[2].completionRate, 50);
  assert.equal(model.dailyTrends[5].completionRate, 100);
  assert.equal(model.dailyTrends[6].completionRate, 100);
  assert.equal(model.trendDeltaPct, 67);
  assert.equal(model.peakDay?.dateKey, '2026-11-17');

  // Cell intensities: hm-1 hit 5/5 (level 3 on completed days), hm-2 hit 2/7 (level 1 on completed days)
  const hm1Today = model.cells.find((c) => c.habitId === 'hm-1' && c.dateKey === '2026-11-17')!;
  const hm1Missed = model.cells.find((c) => c.habitId === 'hm-1' && c.dateKey === '2026-11-11')!;
  const hm2Today = model.cells.find((c) => c.habitId === 'hm-2' && c.dateKey === '2026-11-17')!;
  assert.equal(hm1Today.intensity, 3);
  assert.equal(hm1Missed.intensity, 0);
  assert.equal(hm2Today.intensity, 1);
});

verify('Phase 1: Quest outcomeText and references capture, sanitize URLs, survive untoggle, and index in search', () => {
  assert.equal(inferReferenceKind('https://github.com/org/repo/pull/42'), 'url');
  assert.equal(inferReferenceKind('docs/03-technical-architecture-blueprint.md'), 'path');
  assert.equal(inferReferenceKind('/etc/nginx/conf.d'), 'path');
  assert.equal(inferReferenceKind('Figma Hero Frame v2'), 'note');

  assert.equal(
    sanitizeReferenceUrl('https://github.com/org/repo/pull/42'),
    'https://github.com/org/repo/pull/42'
  );
  assert.equal(sanitizeReferenceUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeReferenceUrl('data:text/html,<h1>x</h1>'), null);

  let state = createInitialState();
  const target = state.quests.find((q) => !q.completed)!;

  state = updateQuestOutcomeState(state, target.id, {
    outcomeText: '  Shipped schema migration with zero downtime  ',
    references: [
      { id: 'r1', label: 'Migration PR', location: 'https://example.com/pr/108', kind: 'url' },
      { id: 'r2', label: 'Runbook', location: 'docs/migration-runbook.md', kind: 'path' },
      { id: 'r3', label: 'Empty', location: '   ', kind: 'note' },
    ],
  });

  const updated = state.quests.find((q) => q.id === target.id)!;
  assert.equal(updated.outcomeText, 'Shipped schema migration with zero downtime');
  assert.equal(updated.references?.length, 2, 'Blank locations must be stripped');
  assert.equal(questHasOutcomeOrReferences(updated), true);

  // Search indexing must match outcomeText and reference label/location
  assert.equal(filterAndOrderQuests(state.quests, 'all', 'zero downtime').length, 1);
  assert.equal(filterAndOrderQuests(state.quests, 'all', 'example.com/pr/108').length, 1);
  assert.equal(filterAndOrderQuests(state.quests, 'all', 'Runbook').length, 1);

  // Completing and untoggling must preserve captured outcomeText and references
  const done = toggleQuestCompletionState(state, target.id, '2026-11-18T10:00:00.000Z');
  const reverted = toggleQuestCompletionState(done.nextState, target.id, '2026-11-18T10:05:00.000Z');
  const afterToggle = reverted.nextState.quests.find((q) => q.id === target.id)!;
  assert.equal(afterToggle.outcomeText, 'Shipped schema migration with zero downtime');
  assert.equal(afterToggle.references?.length, 2);
});

verify('Phase 1: Clear Routine preserves completed quests with captured outcomes or references', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  const routineDone: Quest = {
    id: 'q-routine-done',
    title: 'Clear inbox',
    category: 'Operations' as never, // keep standard category below
    priority: 'routine',
    xpReward: 40,
    coinReward: 10,
    dueLabel: 'Today',
    completed: true,
  };
  routineDone.category = 'Deep Work';

  const documentedDone: Quest = {
    id: 'q-doc-done',
    title: 'Benchmark D3 heatmap',
    category: 'Engineering',
    priority: 'focus',
    xpReward: 90,
    coinReward: 25,
    dueLabel: 'Today',
    completed: true,
    outcomeText: '60fps with 25 habits',
    references: [{ id: 'ref-a', label: 'Perf Trace', location: 'docs/perf-trace.json', kind: 'path' }],
  };

  const activeQuest: Quest = {
    id: 'q-active',
    title: 'Write release notes',
    category: 'Writing',
    priority: 'focus',
    xpReward: 70,
    coinReward: 18,
    dueLabel: 'Today',
    completed: false,
  };

  state = { ...state, quests: [activeQuest, documentedDone, routineDone] };

  const preserveResult = clearCompletedQuestsState(state, { preserveWithOutcomeOrRefs: true });
  assert.equal(preserveResult.removedCount, 1);
  assert.equal(preserveResult.preservedCount, 1);
  assert.equal(preserveResult.nextState.quests.length, 2);
  assert.ok(preserveResult.nextState.quests.some((q) => q.id === 'q-doc-done'));
  assert.ok(!preserveResult.nextState.quests.some((q) => q.id === 'q-routine-done'));

  const clearAllResult = clearCompletedQuestsState(state);
  assert.equal(clearAllResult.removedCount, 2);
  assert.equal(clearAllResult.preservedCount, 0);
  assert.equal(clearAllResult.nextState.quests.length, 1);
});

verify('Phase 2: Follow-up rules trigger immediately (0h) or defer (24h), inherit refs, and stay idempotent', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  const parentQuest: Quest = {
    id: 'q-parent',
    title: 'Deploy checkout hotfix',
    category: 'Engineering',
    priority: 'critical',
    xpReward: 130,
    coinReward: 35,
    dueLabel: 'Today',
    completed: false,
    outcomeText: 'Patched race condition on retry',
    references: [
      { id: 'ref-pr', label: 'Hotfix PR', location: 'https://github.com/org/repo/pull/99', kind: 'url' },
    ],
  };
  state = { ...state, quests: [parentQuest] };

  state = addQuestFollowUpRuleState(state, 'q-parent', {
    title: 'Verify error rate drop in Sentry',
    category: 'Engineering',
    priority: 'focus',
    delayHours: 0,
  });
  state = addQuestFollowUpRuleState(state, 'q-parent', {
    title: 'Audit 24h checkout conversion metrics',
    category: 'Deep Work',
    priority: 'routine',
    delayHours: 24,
  });
  state = addQuestFollowUpRuleState(state, 'q-parent', {
    title: 'Temporary rule to delete',
    delayHours: 48,
  });

  const tempRuleId = state.quests[0].followUpRules![2].id;
  state = removeQuestFollowUpRuleState(state, 'q-parent', tempRuleId);
  assert.equal(state.quests[0].followUpRules?.length, 2);

  const t0 = '2026-11-18T12:00:00.000Z';
  const completed = toggleQuestCompletionState(state, 'q-parent', t0);
  assert.equal(completed.completedNow, true);
  assert.equal(completed.immediateFollowUps.length, 1);
  assert.equal(completed.newlyScheduledCount, 1);
  assert.equal(completed.nextState.scheduledFollowUps.length, 1);

  const spawned = completed.immediateFollowUps[0];
  assert.equal(spawned.title, 'Verify error rate drop in Sentry');
  assert.equal(spawned.parentQuestId, 'q-parent');
  assert.equal(spawned.triggeredFromTitle, 'Deploy checkout hotfix');
  assert.equal(spawned.references?.[0].location, 'https://github.com/org/repo/pull/99');
  assert.ok(spawned.notes?.includes('Patched race condition on retry'));

  // Re-toggling (untoggle then complete again) MUST NOT spawn duplicates
  const untoggled = toggleQuestCompletionState(completed.nextState, 'q-parent', '2026-11-18T12:05:00.000Z');
  const reCompleted = toggleQuestCompletionState(untoggled.nextState, 'q-parent', '2026-11-18T12:10:00.000Z');
  assert.equal(reCompleted.immediateFollowUps.length, 0, 'Already-triggered rules must stay idempotent');
  assert.equal(reCompleted.newlyScheduledCount, 0);
  assert.equal(reCompleted.nextState.scheduledFollowUps.length, 1);

  // Before 24h: queued follow-up stays scheduled
  const tooEarly = evaluateScheduledFollowUpsState(reCompleted.nextState, '2026-11-19T11:59:59.000Z');
  assert.equal(tooEarly.activatedQuests.length, 0);
  assert.equal(tooEarly.nextState.scheduledFollowUps.length, 1);

  // At/after 24h: queued follow-up activates into active quests with inherited lineage & refs
  const onTime = evaluateScheduledFollowUpsState(reCompleted.nextState, '2026-11-19T12:00:00.000Z');
  assert.equal(onTime.activatedQuests.length, 1);
  assert.equal(onTime.nextState.scheduledFollowUps.length, 0);
  assert.equal(onTime.activatedQuests[0].title, 'Audit 24h checkout conversion metrics');
  assert.equal(onTime.activatedQuests[0].parentQuestId, 'q-parent');
  assert.equal(onTime.activatedQuests[0].references?.[0].label, 'Hotfix PR');
});

verify('Phase 2: Scheduled follow-up manual Trigger Now, Discard, AI follow-up draft lineage, hydration & purge', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  state.scheduledFollowUps = [
    {
      id: 'sfu-1',
      parentQuestId: 'q-p1',
      parentQuestTitle: 'Launch v1',
      title: 'Collect user feedback',
      category: 'Design',
      priority: 'focus',
      xpReward: 85,
      coinReward: 20,
      createdAt: '2026-11-18T10:00:00.000Z',
      triggerAt: '2026-11-25T10:00:00.000Z',
    },
    {
      id: 'sfu-2',
      parentQuestId: 'q-p1',
      parentQuestTitle: 'Launch v1',
      title: 'Archive sprint board',
      category: 'Deep Work',
      priority: 'routine',
      xpReward: 50,
      coinReward: 12,
      createdAt: '2026-11-18T10:00:00.000Z',
      triggerAt: '2026-11-25T10:00:00.000Z',
    },
  ];

  // Manual trigger now activates immediately
  const manual = triggerScheduledFollowUpNowState(state, 'sfu-1');
  assert.ok(manual.activatedQuest);
  assert.equal(manual.activatedQuest.title, 'Collect user feedback');
  assert.equal(manual.nextState.scheduledFollowUps.length, 1);
  assert.equal(manual.nextState.quests.length, 1);

  // Discard removes from queue
  const discarded = discardScheduledFollowUpState(manual.nextState, 'sfu-2');
  assert.equal(discarded.scheduledFollowUps.length, 0);

  // AI follow-up draft carries parentQuestId, triggeredFromTitle, and references into Quest on approval
  const withDraft = stageQuestDraftsState(discarded, [
    {
      draftId: 'fu-d1',
      title: 'Write post-launch retrospective',
      category: 'Writing',
      priority: 'focus',
      xpReward: 95,
      coinReward: 24,
      dueLabel: 'In 2 days',
      sourceMode: 'followup',
      parentQuestId: 'q-p1',
      triggeredFromTitle: 'Launch v1',
      references: [{ id: 'r-ai', label: 'Metrics Doc', location: 'https://example.com/metrics', kind: 'url' }],
    },
  ]);
  const approved = approveQuestDraftState(withDraft, 'fu-d1');
  assert.ok(approved.approvedQuest);
  assert.equal(approved.approvedQuest.parentQuestId, 'q-p1');
  assert.equal(approved.approvedQuest.triggeredFromTitle, 'Launch v1');
  assert.equal(approved.approvedQuest.references?.[0].location, 'https://example.com/metrics');

  // Hydration backfills scheduledFollowUps on legacy backups, and purge clears scheduledFollowUps
  const legacyHydrated = hydrateWorkspaceState({ quests: [] });
  assert.deepEqual(legacyHydrated.scheduledFollowUps, []);

  const withQueue = { ...approved.nextState, scheduledFollowUps: state.scheduledFollowUps };
  const purged = purgeWorkspaceState(withQueue, true);
  assert.equal(purged.scheduledFollowUps.length, 0);
});

verify('Boss Raid Phase 1: Gate evidence, Raid debrief, Documentation Bonus coins, and claim idempotency', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  state = createBossEncounterState(state, 'Ship v2.5', 'Production release gates', [
    'Verify smoke suite',
    'Publish release notes',
  ]);
  const createdBoss = state.boss!;
  assert.equal(bossHasEvidence(createdBoss), false);
  assert.equal(computeBossDocumentationBonus(createdBoss), 0);

  // Attach outcome and reference to Gate 1 without toggling completion
  state = updateBossStepOutcomeState(state, createdBoss.steps[0].id, {
    outcomeText: '  100% smoke tests green on staging  ',
    references: [
      { id: 'bg-1', label: 'CI Run', location: 'https://example.com/runs/412', kind: 'url' },
      { id: 'bg-empty', label: 'Blank', location: '   ', kind: 'note' },
    ],
  });
  assert.equal(state.boss!.steps[0].completed, false, 'Attaching evidence must not toggle step');
  assert.equal(state.boss!.steps[0].outcomeText, '100% smoke tests green on staging');
  assert.equal(state.boss!.steps[0].references?.length, 1);
  assert.equal(bossHasEvidence(state.boss!), true);

  // Attach Raid-level debrief summary & path reference
  state = updateBossRaidDebriefState(state, {
    raidOutcomeText: '  Tagged v2.5.0 with zero rollback alerts  ',
    raidReferences: [
      { id: 'br-1', label: 'Release Notes', location: 'docs/release-v2.5.md', kind: 'path' },
    ],
  });
  assert.equal(state.boss!.raidOutcomeText, 'Tagged v2.5.0 with zero rollback alerts');
  assert.equal(state.boss!.raidReferences?.length, 1);

  const expectedBonus = Math.max(15, Math.round(createdBoss.rewardCoins * 0.15));
  assert.equal(computeBossDocumentationBonus(state.boss!), expectedBonus);

  // Complete all gates & claim bounty with Evidence Bonus
  state = toggleBossStepState(state, createdBoss.steps[0].id);
  state = toggleBossStepState(state, createdBoss.steps[1].id);
  const claimAt = '2026-11-18T16:30:00.000Z';
  const claimed = claimBossBountyState(state, claimAt);
  assert.equal(claimed.claimed, true);
  assert.equal(claimed.bonusCoins, expectedBonus);
  assert.equal(claimed.nextState.xp, createdBoss.rewardXp);
  assert.equal(claimed.nextState.coins, createdBoss.rewardCoins + expectedBonus);
  assert.equal(claimed.nextState.boss!.bountyClaimed, true);
  assert.equal(claimed.nextState.boss!.claimedAt, claimAt);
  assert.equal(claimed.nextState.boss!.bonusCoinsAwarded, expectedBonus);

  // Evidence remains preserved on the claimed boss until cleared, and re-claim is idempotent
  const reClaim = claimBossBountyState(claimed.nextState);
  assert.equal(reClaim.claimed, false);
  assert.equal(reClaim.bonusCoins, 0);
  assert.equal(reClaim.nextState.coins, createdBoss.rewardCoins + expectedBonus);
});

verify('Boss Raid Phase 1B: Optional raids, optional stretch gates, all-optional fallback, and stretch bonuses', () => {
  let state = purgeWorkspaceState(createInitialState(), true);

  // Create raid with middle gate marked optional + commitment optional
  state = createBossEncounterState(
    state,
    'Observability Polish',
    'Improve trace sampling and dashboards',
    ['Add span attributes', 'Build custom Grafana dark theme', 'Export Prometheus alerts'],
    { commitment: 'optional', optionalStepIndices: [1] }
  );
  assert.ok(state.boss);
  assert.equal(state.boss.commitment, 'optional');
  assert.equal(state.boss.maxHp, 200, 'Optional gate must not add to required maxHp');
  assert.equal(state.boss.steps[1].optional, true);

  // Toggle commitment between optional and required
  state = toggleBossCommitmentState(state);
  assert.equal(state.boss!.commitment, 'required');
  state = toggleBossCommitmentState(state, 'optional');
  assert.equal(state.boss!.commitment, 'optional');

  // Toggle optional flag on Gate 3 -> 1 required gate (100 HP) -> toggle back to required (200 HP)
  state = toggleBossStepOptionalState(state, state.boss!.steps[2].id);
  assert.equal(state.boss!.maxHp, 100);
  state = toggleBossStepOptionalState(state, state.boss!.steps[2].id);
  assert.equal(state.boss!.maxHp, 200);

  // Complete only required gates (0 and 2); optional gate 1 left unchecked -> still claimable!
  state = toggleBossStepState(state, state.boss!.steps[0].id);
  state = toggleBossStepState(state, state.boss!.steps[2].id);
  const progressBeforeStretch = getBossProgress(state.boss!);
  assert.equal(progressBeforeStretch.bossDefeated, true);
  assert.equal(progressBeforeStretch.completedOptionalCount, 0);
  assert.equal(progressBeforeStretch.stretchBonusXp, 0);
  assert.equal(progressBeforeStretch.stretchBonusCoins, 0);

  // Checking optional stretch gate adds +25 XP and +10 Coins on claim
  state = toggleBossStepState(state, state.boss!.steps[1].id);
  const claimResult = claimBossBountyState(state, '2026-11-19T10:00:00.000Z');
  assert.equal(claimResult.claimed, true);
  assert.equal(claimResult.stretchBonusXp, 25);
  assert.equal(claimResult.stretchBonusCoins, 10);
  assert.equal(claimResult.nextState.xp, state.boss!.rewardXp + 25);
  assert.equal(claimResult.nextState.coins, state.boss!.rewardCoins + 10);
  assert.equal(claimResult.nextState.boss!.stretchBonusXpAwarded, 25);
  assert.equal(claimResult.nextState.boss!.stretchBonusCoinsAwarded, 10);

  // Fallback invariant: if EVERY gate is optional, boss cannot be claimed with 0 gates checked
  let allOptState = purgeWorkspaceState(createInitialState(), true);
  allOptState = createBossEncounterState(allOptState, 'Side Exploration', 'All optional', ['Spike A', 'Spike B'], {
    commitment: 'optional',
    optionalStepIndices: [0, 1],
  });
  assert.equal(getBossProgress(allOptState.boss!).bossDefeated, false);
  assert.equal(claimBossBountyState(allOptState).claimed, false);

  // Boss draft preserves commitment & optional step flags on approval
  let draftState = purgeWorkspaceState(createInitialState(), true);
  draftState = stageBossDraftState(draftState, {
    draftId: 'bd-opt',
    title: 'Optional Migration',
    subtitle: 'Safe to pause anytime',
    commitment: 'optional',
    steps: [
      { id: 'ds-1', title: 'Core index', optional: false },
      { id: 'ds-2', title: 'Cleanup legacy table', optional: true },
    ],
  });
  const approved = approveBossDraftState(draftState);
  assert.equal(approved.approved, true);
  assert.equal(approved.nextState.boss?.commitment, 'optional');
  assert.equal(approved.nextState.boss?.steps[1].optional, true);
  assert.equal(approved.nextState.boss?.maxHp, 100);
});

verify('Boss Raid Phase 1B: Defer raid, due schedule check, swap/resume active raid, discard, hydration & purge', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  state = createBossEncounterState(state, 'Raid Alpha', 'First initiative', ['Gate A1', 'Gate A2']);
  const alphaId = state.boss!.id;
  state = toggleBossStepState(state, state.boss!.steps[0].id);
  state = updateBossStepOutcomeState(state, state.boss!.steps[0].id, {
    outcomeText: 'Benchmark captured',
  });

  // Defer Raid Alpha for 24h
  const t0 = '2026-11-19T12:00:00.000Z';
  const deferred = deferBossEncounterState(state, {
    delayHours: 24,
    reason: 'Blocked on upstream API credentials',
    nowIso: t0,
  });
  assert.ok(deferred.deferredRaid);
  assert.equal(deferred.nextState.boss, null);
  assert.equal(deferred.nextState.deferredRaids.length, 1);
  assert.equal(deferred.deferredRaid.deferReason, 'Blocked on upstream API credentials');
  assert.equal(deferred.deferredRaid.resumeAt, '2026-11-20T12:00:00.000Z');
  assert.equal(deferred.deferredRaid.steps[0].completed, true, 'Deferring must preserve gate progress');
  assert.equal(deferred.deferredRaid.steps[0].outcomeText, 'Benchmark captured');

  // Due check before vs at resumeAt
  assert.equal(getDueDeferredRaids(deferred.nextState.deferredRaids, '2026-11-20T11:59:59.000Z').length, 0);
  assert.equal(getDueDeferredRaids(deferred.nextState.deferredRaids, '2026-11-20T12:00:00.000Z').length, 1);

  // Spin up Raid Beta while Alpha is parked, then swap/resume Alpha
  let withBeta = createBossEncounterState(deferred.nextState, 'Raid Beta', 'Urgent hotfix', ['Gate B1']);
  const betaId = withBeta.boss!.id;
  withBeta = toggleBossStepState(withBeta, withBeta.boss!.steps[0].id);

  const resumed = resumeDeferredRaidState(withBeta, alphaId, { nowIso: '2026-11-20T12:05:00.000Z' });
  assert.equal(resumed.autoDeferredCurrent, true);
  assert.equal(resumed.resumedRaid?.id, alphaId);
  assert.equal(resumed.nextState.boss?.id, alphaId);
  assert.equal(resumed.nextState.boss?.deferredAt, undefined);
  assert.equal(resumed.nextState.boss?.resumeAt, undefined);
  assert.equal(resumed.nextState.boss?.deferReason, undefined);
  assert.equal(resumed.nextState.boss?.steps[0].completed, true);
  assert.equal(resumed.nextState.deferredRaids.length, 1);
  assert.equal(resumed.nextState.deferredRaids[0].id, betaId);
  assert.equal(resumed.nextState.deferredRaids[0].steps[0].completed, true);

  // Discard parked Beta
  const afterDiscard = discardDeferredRaidState(resumed.nextState, betaId);
  assert.equal(afterDiscard.deferredRaids.length, 0);

  // Hydration backfills deferredRaids: [] on legacy backups, and purge clears deferredRaids
  const legacyHydrated = hydrateWorkspaceState({ quests: [] });
  assert.deepEqual(legacyHydrated.deferredRaids, []);

  const purged = purgeWorkspaceState(resumed.nextState, true);
  assert.equal(purged.boss, null);
  assert.equal(purged.deferredRaids.length, 0);
});

verify('Quest Board P0/P1 Ordering: completed quests sort by recency, follow-ups by triggerAt asc, boss gates required-first, and deferred raids by due/core/soonest', () => {
  // 1. Completed quests sort by completedAt descending while active quests sort by priority
  let state = purgeWorkspaceState(createInitialState(), true);
  const qRoutineOld: Quest = {
    id: 'q-r-old',
    title: 'Old routine finished',
    category: 'Deep Work',
    priority: 'routine',
    xpReward: 40,
    coinReward: 10,
    dueLabel: 'Today',
    completed: true,
    completedAt: '2026-11-20T09:00:00.000Z',
  };
  const qCriticalOlder: Quest = {
    id: 'q-c-older',
    title: 'Older critical finished',
    category: 'Engineering',
    priority: 'critical',
    xpReward: 140,
    coinReward: 35,
    dueLabel: 'Today',
    completed: true,
    completedAt: '2026-11-20T11:00:00.000Z',
  };
  const qRoutineNewest: Quest = {
    id: 'q-r-newest',
    title: 'Just finished routine quest',
    category: 'Writing',
    priority: 'routine',
    xpReward: 50,
    coinReward: 12,
    dueLabel: 'Today',
    completed: true,
    completedAt: '2026-11-21T01:30:00.000Z',
  };
  const qLegacyNoTimestamp: Quest = {
    id: 'q-legacy',
    title: 'Legacy finished quest',
    category: 'Design',
    priority: 'critical',
    xpReward: 120,
    coinReward: 30,
    dueLabel: 'Yesterday',
    completed: true,
  };
  const qActiveRoutine: Quest = {
    id: 'q-a-routine',
    title: 'Active routine',
    category: 'Health',
    priority: 'routine',
    xpReward: 45,
    coinReward: 10,
    dueLabel: 'Today',
    completed: false,
  };
  const qActiveCritical: Quest = {
    id: 'q-a-crit',
    title: 'Active critical',
    category: 'Engineering',
    priority: 'critical',
    xpReward: 150,
    coinReward: 40,
    dueLabel: 'Today',
    completed: false,
  };

  state = {
    ...state,
    quests: [
      qRoutineOld,
      qActiveRoutine,
      qCriticalOlder,
      qLegacyNoTimestamp,
      qActiveCritical,
      qRoutineNewest,
    ],
  };

  const orderedAll = filterAndOrderQuests(state.quests, 'all', '');
  assert.deepEqual(
    orderedAll.map((q) => q.id),
    ['q-a-crit', 'q-a-routine', 'q-r-newest', 'q-c-older', 'q-r-old', 'q-legacy'],
    'Active quests must sort by priority, then completed quests by completedAt desc'
  );

  // 2. Scheduled follow-ups sort chronologically by triggerAt ascending on completion and via helper
  let sfuState = purgeWorkspaceState(createInitialState(), true);
  sfuState = {
    ...sfuState,
    quests: [
      {
        id: 'q-chain',
        title: 'Ship API v2',
        category: 'Engineering',
        priority: 'focus',
        xpReward: 100,
        coinReward: 25,
        dueLabel: 'Today',
        completed: false,
      },
    ],
  };
  sfuState = addQuestFollowUpRuleState(sfuState, 'q-chain', {
    title: '7-day audit',
    delayHours: 168,
  });
  sfuState = addQuestFollowUpRuleState(sfuState, 'q-chain', {
    title: '24-hour check',
    delayHours: 24,
  });
  const completedChain = toggleQuestCompletionState(
    sfuState,
    'q-chain',
    '2026-11-21T02:00:00.000Z'
  );
  assert.deepEqual(
    completedChain.nextState.scheduledFollowUps.map((s) => s.title),
    ['24-hour check', '7-day audit'],
    'Queued follow-ups must be stored and ordered soonest triggerAt first'
  );

  const reorderedSfu = orderScheduledFollowUps([
    completedChain.nextState.scheduledFollowUps[1],
    completedChain.nextState.scheduledFollowUps[0],
  ]);
  assert.deepEqual(
    reorderedSfu.map((s) => s.title),
    ['24-hour check', '7-day audit']
  );

  // 3. Boss steps place required gates ahead of optional stretch gates while preserving relative order
  const orderedSteps = orderBossSteps([
    { id: 's1', title: 'Optional Polish', damage: 100, completed: false, optional: true },
    { id: 's2', title: 'Required Core 1', damage: 100, completed: false },
    { id: 's3', title: 'Optional Docs', damage: 100, completed: false, optional: true },
    { id: 's4', title: 'Required Core 2', damage: 100, completed: false },
  ]);
  assert.deepEqual(
    orderedSteps.map((s) => s.id),
    ['s2', 's4', 's1', 's3']
  );

  // 4. Deferred raids sort: due first -> core before optional -> soonest resumeAt -> manual later
  const nowIso = '2026-11-21T12:00:00.000Z';
  const orderedRaids = orderDeferredRaids(
    [
      {
        id: 'raid-manual-opt',
        title: 'Manual Optional',
        subtitle: '',
        commitment: 'optional',
        maxHp: 100,
        rewardXp: 75,
        rewardCoins: 30,
        bountyClaimed: false,
        steps: [{ id: 'g1', title: 'G1', damage: 100, completed: false }],
        deferredAt: '2026-11-21T10:00:00.000Z',
      },
      {
        id: 'raid-future-core',
        title: 'Future Core 72h',
        subtitle: '',
        commitment: 'required',
        maxHp: 100,
        rewardXp: 75,
        rewardCoins: 30,
        bountyClaimed: false,
        steps: [{ id: 'g2', title: 'G2', damage: 100, completed: false }],
        deferredAt: '2026-11-21T09:00:00.000Z',
        resumeAt: '2026-11-24T12:00:00.000Z',
      },
      {
        id: 'raid-due-opt',
        title: 'Due Optional',
        subtitle: '',
        commitment: 'optional',
        maxHp: 100,
        rewardXp: 75,
        rewardCoins: 30,
        bountyClaimed: false,
        steps: [{ id: 'g3', title: 'G3', damage: 100, completed: false }],
        deferredAt: '2026-11-20T09:00:00.000Z',
        resumeAt: '2026-11-21T11:00:00.000Z',
      },
      {
        id: 'raid-due-core',
        title: 'Due Core',
        subtitle: '',
        commitment: 'required',
        maxHp: 100,
        rewardXp: 75,
        rewardCoins: 30,
        bountyClaimed: false,
        steps: [{ id: 'g4', title: 'G4', damage: 100, completed: false }],
        deferredAt: '2026-11-20T08:00:00.000Z',
        resumeAt: '2026-11-21T11:30:00.000Z',
      },
    ],
    nowIso
  );
  assert.deepEqual(
    orderedRaids.map((r) => r.id),
    ['raid-due-core', 'raid-due-opt', 'raid-future-core', 'raid-manual-opt']
  );
});

verify('AI Model selection: allowlist normalization, hydration backfill, preset & purge preservation', () => {
  assert.equal(normalizeAiModel('gemini-4-hydrogen'), 'gemini-4-hydrogen');
  assert.equal(normalizeAiModel('gemini-3.1-flash-lite'), 'gemini-3.1-flash-lite');
  assert.equal(normalizeAiModel('gemini-1.5-flash'), DEFAULT_AI_MODEL, 'Deprecated models must fall back');
  assert.equal(normalizeAiModel('unknown-model'), DEFAULT_AI_MODEL);
  assert.equal(normalizeAiModel(undefined), DEFAULT_AI_MODEL);
  assert.equal(getAiModelLabel('gemini-3.1-flash-lite'), 'Gemini 3.1 Flash Lite');

  // Legacy JSON without aiModel / aiAutoFallback backfills defaults cleanly
  const legacyHydrated = hydrateWorkspaceState({ quests: [] });
  assert.equal(legacyHydrated.aiModel, 'gemini-4-hydrogen');
  assert.equal(legacyHydrated.aiAutoFallback, true);

  // Explicit valid settings survive hydration & invalid models clamp safely
  const customHydrated = hydrateWorkspaceState({
    quests: [],
    aiModel: 'gemini-3.1-flash-lite',
    aiAutoFallback: false,
  });
  assert.equal(customHydrated.aiModel, 'gemini-3.1-flash-lite');
  assert.equal(customHydrated.aiAutoFallback, false);

  const invalidHydrated = hydrateWorkspaceState({
    quests: [],
    aiModel: 'gemini-pro' as never,
  });
  assert.equal(invalidHydrated.aiModel, 'gemini-4-hydrogen');

  // Study preset preserves caller's AI model preference
  const study = createStudyPresetState({
    aiModel: 'gemini-3.1-flash-lite',
    aiAutoFallback: false,
  });
  assert.equal(study.aiModel, 'gemini-3.1-flash-lite');
  assert.equal(study.aiAutoFallback, false);

  // Purge keeping personalization preserves AI model & fallback; full purge resets defaults
  const kept = purgeWorkspaceState(customHydrated, true);
  assert.equal(kept.aiModel, 'gemini-3.1-flash-lite');
  assert.equal(kept.aiAutoFallback, false);

  const reset = purgeWorkspaceState(customHydrated, false);
  assert.equal(reset.aiModel, 'gemini-4-hydrogen');
  assert.equal(reset.aiAutoFallback, true);
});

verify('Multi-Boss Raid flow: starting next raid archives claimed raids, parks active raids, and hydrates/purges raidHistory', () => {
  let state = purgeWorkspaceState(createInitialState(), true);
  assert.deepEqual(state.raidHistory, []);

  // 1. Complete and claim Raid #1 with debrief
  state = createBossEncounterState(state, 'Raid Alpha', 'First milestone', ['Ship Alpha']);
  state = updateBossRaidDebriefState(state, { raidOutcomeText: 'Alpha shipped cleanly' });
  state = toggleBossStepState(state, state.boss!.steps[0].id);
  const claim1 = claimBossBountyState(state, '2026-11-22T01:00:00.000Z');
  assert.equal(claim1.claimed, true);
  state = claim1.nextState;

  // 2. Starting Raid #2 directly after Raid #1 is done archives Raid #1 into raidHistory
  state = createBossEncounterState(state, 'Raid Beta', 'Second milestone', ['Ship Beta 1', 'Ship Beta 2']);
  assert.equal(state.boss?.title, 'Raid Beta');
  assert.equal(state.raidHistory.length, 1);
  assert.equal(state.raidHistory[0].title, 'Raid Alpha');
  assert.equal(state.raidHistory[0].raidOutcomeText, 'Alpha shipped cleanly');
  assert.equal(state.deferredRaids.length, 0);

  // 3. Starting Raid #3 while Raid #2 is still in-progress parks Raid #2 safely into deferredRaids
  state = toggleBossStepState(state, state.boss!.steps[0].id);
  state = createBossEncounterState(state, 'Raid Gamma', 'Urgent hotfix milestone', ['Patch Prod']);
  assert.equal(state.boss?.title, 'Raid Gamma');
  assert.equal(state.deferredRaids.length, 1);
  assert.equal(state.deferredRaids[0].title, 'Raid Beta');
  assert.equal(state.deferredRaids[0].steps[0].completed, true, 'Parked raid must retain gate progress');

  // 4. Complete & claim Raid #3, then archive explicitly via archiveBossEncounterState / clearBossEncounterState
  state = toggleBossStepState(state, state.boss!.steps[0].id);
  const claim3 = claimBossBountyState(state, '2026-11-22T02:00:00.000Z');
  state = claim3.nextState;
  const archived = archiveBossEncounterState(state);
  assert.equal(archived.archivedRaid?.title, 'Raid Gamma');
  assert.equal(archived.nextState.boss, null);
  assert.equal(archived.nextState.raidHistory.length, 2);
  assert.equal(archived.nextState.raidHistory[0].title, 'Raid Gamma');

  // 5. Resuming a deferred raid while active raid is claimed archives the claimed raid instead of deferring it
  state = createBossEncounterState(archived.nextState, 'Raid Delta', 'Quick win', ['Done']);
  state = toggleBossStepState(state, state.boss!.steps[0].id);
  state = claimBossBountyState(state, '2026-11-22T02:30:00.000Z').nextState;
  const resumed = resumeDeferredRaidState(state, state.deferredRaids[0].id);
  assert.equal(resumed.nextState.boss?.title, 'Raid Beta');
  assert.equal(resumed.autoDeferredCurrent, false, 'Claimed boss should be archived, not deferred');
  assert.equal(resumed.nextState.raidHistory[0].title, 'Raid Delta');
  assert.equal(resumed.nextState.raidHistory.length, 3);

  // 6. Delete archived entry, hydration backfill, and purge cleanup
  const afterDelete = deleteArchivedRaidState(resumed.nextState, resumed.nextState.raidHistory[0].id);
  assert.equal(afterDelete.raidHistory.length, 2);

  const legacyHydrated = hydrateWorkspaceState({ quests: [] });
  assert.deepEqual(legacyHydrated.raidHistory, []);

  const purged = purgeWorkspaceState(afterDelete, true);
  assert.deepEqual(purged.raidHistory, []);
});

console.log(`\nVerification summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
