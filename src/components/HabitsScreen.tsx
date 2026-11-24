import React, { useState } from 'react';
import {
  Check,
  Edit3,
  Flame,
  Loader2,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AppState, HabitDraft } from '../types';
import { computeHabitStreak, formatDateKey, getTrailingDays } from '../data/initialData';
import { getAiModelLabel } from '../utils/workspaceState';
import { HabitActivityHeatmap } from './HabitActivityHeatmap';

interface HabitsScreenProps {
  state: AppState;
  habitAiLoading: boolean;
  habitAiError: string | null;
  onToggleHabitDay: (habitId: string, dateKey: string) => void;
  onAddHabit: (title: string, category: string, targetDaysPerWeek: number) => void;
  onDeleteHabit: (habitId: string) => void;
  onRequestAiHabits: (mode: 'aligned' | 'parse', inputText: string) => void;
  onEditHabitDraft: (draftId: string, patch: Partial<HabitDraft>) => void;
  onApproveHabitDraft: (draftId: string) => void;
  onApproveAllHabitDrafts: () => void;
  onDiscardHabitDraft: (draftId: string) => void;
  onClearHabitDrafts: () => void;
}

const HABIT_CATEGORIES = ['Deep Work', 'Health', 'Learning', 'Operations'];

export const HabitsScreen: React.FC<HabitsScreenProps> = ({
  state,
  habitAiLoading,
  habitAiError,
  onToggleHabitDay,
  onAddHabit,
  onDeleteHabit,
  onRequestAiHabits,
  onEditHabitDraft,
  onApproveHabitDraft,
  onApproveAllHabitDrafts,
  onDiscardHabitDraft,
  onClearHabitDrafts,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Deep Work');
  const [newTarget, setNewTarget] = useState(5);

  const [aiInputText, setAiInputText] = useState('');
  const [lastAiMode, setLastAiMode] = useState<'aligned' | 'parse'>('aligned');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  const days = getTrailingDays(7);
  const todayKey = formatDateKey(new Date());

  const totalWeeklyTarget = state.habits.reduce((acc, h) => acc + h.targetDaysPerWeek, 0);
  const totalWeeklyChecked = state.habits.reduce(
    (acc, h) => acc + days.filter((d) => h.history[d.key]).length,
    0
  );
  const adherencePct =
    totalWeeklyTarget > 0
      ? Math.min(100, Math.round((totalWeeklyChecked / totalWeeklyTarget) * 100))
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onAddHabit(trimmed, newCategory, newTarget);
    setNewTitle('');
  };

  const triggerHabitAi = (mode: 'aligned' | 'parse') => {
    setLastAiMode(mode);
    onRequestAiHabits(mode, aiInputText);
  };

  const showStagingTray =
    habitAiLoading || Boolean(habitAiError) || state.habitDrafts.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#131b2e]">
            Habits &amp; Streaks
          </h1>
          <p className="mt-1 text-sm text-[#464554] tabular-nums">
            {totalWeeklyChecked} of {totalWeeklyTarget} weekly check-ins completed ({adherencePct}%)
          </p>
        </div>

        <div className="flex items-center gap-5 text-sm font-bold text-[#131b2e]">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-[#10b981]" />
            <span className="tabular-nums">{state.streakDays}-Day Global Streak</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#006c49]">
            <Shield className="h-4 w-4" />
            <span className="tabular-nums">{state.streakShields} Shield Ready</span>
          </span>
        </div>
      </div>

      {/* D3 7-Day Activity Heat Map & Completion Trend */}
      <HabitActivityHeatmap
        habits={state.habits}
        onToggleHabitDay={onToggleHabitDay}
      />

      {/* AI Habit Planner & Input Parser */}
      <section className="arcade-card rounded-3xl p-5 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-sm font-extrabold text-[#131b2e]">
            AI Habit Planner &amp; Input Parser
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
            placeholder="Describe routine goals to parse into daily habits (e.g., morning review, walk 20m, read before bed)—or leave blank for AI suggestions..."
            aria-label="Routine goals or notes for AI habit drafting"
            className="arcade-input flex-1 rounded-2xl px-4 py-2.5 text-sm text-[#131b2e] placeholder:text-[#767586]"
          />
          <div className="flex flex-row sm:flex-col gap-2 shrink-0">
            <button
              type="button"
              disabled={habitAiLoading}
              onClick={() => triggerHabitAi('aligned')}
              className="btn-tactile-primary inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              {habitAiLoading && lastAiMode === 'aligned' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>Suggest Aligned</span>
            </button>
            <button
              type="button"
              disabled={habitAiLoading || !aiInputText.trim()}
              onClick={() => triggerHabitAi('parse')}
              className="btn-tactile-ghost inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {habitAiLoading && lastAiMode === 'parse' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Edit3 className="h-3.5 w-3.5 text-[#4648d4]" />
              )}
              <span>Parse Input</span>
            </button>
          </div>
        </div>
      </section>

      {/* Inline Human-in-the-Loop (HITL) Habit Draft Staging Tray */}
      {showStagingTray && (
        <section
          aria-label="Habit drafts pending review"
          className="rounded-3xl border border-[#c0c1ff] bg-[#f2f3ff]/75 p-6"
        >
          <div className="flex flex-col gap-3 border-b border-[#dfe3f4] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#131b2e]">
                Habit Draft Staging Tray · Pending Approval
              </h2>
              <p className="mt-0.5 text-xs text-[#464554] tabular-nums">
                {habitAiLoading
                  ? 'Drafting recurring routines aligned with your goals...'
                  : `${state.habitDrafts.length} habit draft${state.habitDrafts.length === 1 ? '' : 's'} staged — edit or approve to add to your 7-day cadence`}
              </p>
            </div>
            {state.habitDrafts.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClearHabitDrafts}
                  className="btn-tactile-ghost rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Discard All
                </button>
                <button
                  type="button"
                  onClick={onApproveAllHabitDrafts}
                  className="btn-tactile-emerald rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  Approve All ({state.habitDrafts.length})
                </button>
              </div>
            )}
          </div>

          {habitAiError && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#ffdad6] bg-[#fff1f3] px-4 py-3 text-xs font-semibold text-[#ba1a1a]">
              <span>{habitAiError}</span>
              <button
                type="button"
                onClick={() => triggerHabitAi(lastAiMode)}
                className="font-bold underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {habitAiLoading && (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-[74px] animate-pulse rounded-2xl border border-[#dfe3f4] bg-white/80"
                />
              ))}
            </div>
          )}

          {state.habitDrafts.length > 0 && (
            <ul className="mt-4 space-y-3">
              {state.habitDrafts.map((draft) => {
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
                            onEditHabitDraft(draft.draftId, { title: e.target.value })
                          }
                          aria-label="Edit habit draft title"
                          className="arcade-input w-full rounded-2xl px-3.5 py-2 text-sm font-bold text-[#131b2e]"
                        />
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <select
                            aria-label="Edit habit draft category"
                            value={draft.category}
                            onChange={(e) =>
                              onEditHabitDraft(draft.draftId, { category: e.target.value })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs font-bold text-[#131b2e]"
                          >
                            {HABIT_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label="Edit habit draft weekly frequency"
                            value={draft.targetDaysPerWeek}
                            onChange={(e) =>
                              onEditHabitDraft(draft.draftId, {
                                targetDaysPerWeek: Number(e.target.value) || 5,
                              })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs font-bold text-[#131b2e]"
                          >
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <option key={n} value={n}>
                                {n}x / week
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min={15}
                            max={80}
                            step={5}
                            aria-label="Edit habit draft XP reward"
                            value={draft.xpReward}
                            onChange={(e) =>
                              onEditHabitDraft(draft.draftId, {
                                xpReward: Number(e.target.value) || 15,
                              })
                            }
                            className="arcade-input rounded-2xl px-3 py-2 text-xs font-mono font-bold tabular-nums text-[#131b2e]"
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
                              onApproveHabitDraft(draft.draftId);
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
                              {draft.sourceMode === 'parsed' ? 'Parsed Draft' : 'AI Suggested'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{draft.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{draft.targetDaysPerWeek}x / week</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-[#131b2e]">+{draft.xpReward} XP</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#855300]">
                              +{draft.coinReward} Coins
                            </span>
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
                            onClick={() => onApproveHabitDraft(draft.draftId)}
                            className="btn-tactile-emerald rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onDiscardHabitDraft(draft.draftId)}
                            aria-label={`Discard habit draft "${draft.title}"`}
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

      {/* Manual Add Habit Composer */}
      <form
        onSubmit={handleSubmit}
        className="arcade-card flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Plus className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#10b981]" />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Quick-add a manual habit directly to matrix..."
            aria-label="New habit title"
            className="arcade-input w-full rounded-full py-2.5 pl-10 pr-4 text-sm text-[#131b2e] placeholder:text-[#767586]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Habit category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="arcade-input rounded-full px-3.5 py-2.5 text-xs font-bold text-[#131b2e]"
          >
            {HABIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Weekly target days"
            value={newTarget}
            onChange={(e) => setNewTarget(Number(e.target.value))}
            className="arcade-input rounded-full px-3.5 py-2.5 text-xs font-bold text-[#131b2e]"
          >
            <option value={3}>3x / week</option>
            <option value={5}>5x / week</option>
            <option value={6}>6x / week</option>
            <option value={7}>7x / week</option>
          </select>
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="btn-tactile-emerald rounded-full px-5 py-2.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            Add Habit
          </button>
        </div>
      </form>

      {/* 7-Day Habit Matrix */}
      <section className="arcade-card overflow-hidden rounded-3xl">
        {state.habits.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-bold text-[#131b2e]">No habits tracked yet</p>
            <p className="mt-1 text-sm text-[#464554]">
              Suggest aligned habits with AI above or add your first daily routine manually.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e8ebf8] bg-[#faf8ff]">
                  <th className="py-3.5 pl-6 pr-4 text-xs font-bold text-[#464554]">
                    Habit Routine
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.key}
                      className={`px-2 py-3.5 text-center text-xs font-bold tabular-nums ${
                        day.isToday ? 'text-[#4648d4]' : 'text-[#464554]'
                      }`}
                    >
                      <div>{day.shortDay}</div>
                      <div className="mt-0.5 text-[11px] font-semibold opacity-75">
                        {day.isToday ? 'Today' : day.dayNum}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-right text-xs font-bold text-[#464554]">
                    Streak
                  </th>
                  <th className="py-3.5 pl-2 pr-6 text-right text-xs font-bold text-[#464554]">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0ff]">
                {state.habits.map((habit) => {
                  const streak = computeHabitStreak(habit.history);
                  const weekHits = days.filter((d) => habit.history[d.key]).length;

                  return (
                    <tr
                      key={habit.id}
                      className="transition-colors hover:bg-[#faf8ff]/80"
                    >
                      <td className="py-4 pl-6 pr-4">
                        <p className="text-sm font-bold text-[#131b2e]">{habit.title}</p>
                        <p className="mt-0.5 text-xs text-[#464554] tabular-nums">
                          {habit.category} · +{habit.xpReward} XP · +{habit.coinReward} Coins ·{' '}
                          {weekHits}/{habit.targetDaysPerWeek} this week
                        </p>
                      </td>

                      {days.map((day) => {
                        const checked = Boolean(habit.history[day.key]);
                        const isToday = day.key === todayKey;

                        return (
                          <td key={day.key} className="px-2 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => onToggleHabitDay(habit.id, day.key)}
                              aria-label={`${habit.title} on ${day.shortDay} ${day.dayNum}: ${
                                checked ? 'completed' : 'not completed'
                              }`}
                              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-all cursor-pointer ${
                                checked
                                  ? 'border-[#10b981] bg-[#10b981] text-white shadow-[0_2px_0_0_#059669]'
                                  : isToday
                                    ? 'border-[#4648d4]/45 bg-[#f2f3ff] text-transparent hover:border-[#4648d4]'
                                    : 'border-[#dfe3f4] bg-white text-transparent hover:border-[#c7c4d7]'
                              }`}
                            >
                              <Check className="h-4 w-4 stroke-[3]" />
                            </button>
                          </td>
                        );
                      })}

                      <td className="px-4 py-4 text-right">
                        <span className="inline-flex items-center justify-end gap-1 font-mono text-sm font-bold tabular-nums text-[#131b2e]">
                          <Flame
                            className={`h-4 w-4 ${
                              streak > 0 ? 'text-[#f59e0b]' : 'text-[#c7c4d7]'
                            }`}
                          />
                          {streak}d
                        </span>
                      </td>

                      <td className="py-4 pl-2 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteHabit(habit.id)}
                          aria-label={`Delete habit ${habit.title}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#767586] hover:bg-[#fff1f3] hover:text-[#ba1a1a] cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
