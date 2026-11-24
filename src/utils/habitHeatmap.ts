import { Habit } from '../types';
import { computeHabitStreak, getTrailingDays } from '../data/initialData';

export interface TrailingDaySlot {
  key: string;
  shortDay: string;
  dayNum: string;
  isToday: boolean;
}

export type HeatmapIntensity = 0 | 1 | 2 | 3;

export interface HabitHeatmapCell {
  habitId: string;
  habitTitle: string;
  category: string;
  dateKey: string;
  shortDay: string;
  dayNum: string;
  isToday: boolean;
  completed: boolean;
  weeklyHits: number;
  targetDaysPerWeek: number;
  adherenceRatio: number;
  streak: number;
  intensity: HeatmapIntensity;
}

export interface DailyCompletionTrend {
  dateKey: string;
  shortDay: string;
  dayNum: string;
  isToday: boolean;
  completedCount: number;
  totalHabits: number;
  completionRate: number;
}

export interface HabitHeatmapModel {
  days: TrailingDaySlot[];
  dailyTrends: DailyCompletionTrend[];
  cells: HabitHeatmapCell[];
  totalWeeklyTarget: number;
  totalWeeklyChecked: number;
  overallAdherencePct: number;
  dailyAveragePct: number;
  trendDeltaPct: number;
  peakDay: DailyCompletionTrend | null;
}

function computeStreakWithinWindow(
  history: Record<string, boolean>,
  days: TrailingDaySlot[]
): number {
  if (days.length === 0) return 0;
  if (days[days.length - 1].isToday) {
    return computeHabitStreak(history);
  }
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (history[days[i].key]) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function classifyCellIntensity(
  completed: boolean,
  weeklyHits: number,
  targetDaysPerWeek: number
): HeatmapIntensity {
  if (!completed) return 0;
  const safeTarget = Math.max(1, targetDaysPerWeek);
  if (weeklyHits >= safeTarget) return 3;
  if (weeklyHits / safeTarget >= 0.5) return 2;
  return 1;
}

export function buildHabitHeatmapModel(
  habits: Habit[],
  customDays?: TrailingDaySlot[]
): HabitHeatmapModel {
  const days = customDays && customDays.length > 0 ? customDays : getTrailingDays(7);
  const totalHabits = habits.length;

  const dailyTrends: DailyCompletionTrend[] = days.map((day) => {
    const completedCount = habits.reduce(
      (acc, habit) => acc + (habit.history[day.key] ? 1 : 0),
      0
    );
    const completionRate =
      totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

    return {
      dateKey: day.key,
      shortDay: day.shortDay,
      dayNum: day.dayNum,
      isToday: day.isToday,
      completedCount,
      totalHabits,
      completionRate,
    };
  });

  const cells: HabitHeatmapCell[] = [];
  let totalWeeklyTarget = 0;
  let totalWeeklyChecked = 0;

  for (const habit of habits) {
    const weeklyHits = days.reduce(
      (acc, day) => acc + (habit.history[day.key] ? 1 : 0),
      0
    );
    const safeTarget = Math.max(1, habit.targetDaysPerWeek);
    totalWeeklyTarget += habit.targetDaysPerWeek;
    totalWeeklyChecked += weeklyHits;

    const adherenceRatio = Math.min(1, weeklyHits / safeTarget);
    const streak = computeStreakWithinWindow(habit.history, days);

    for (const day of days) {
      const completed = Boolean(habit.history[day.key]);
      cells.push({
        habitId: habit.id,
        habitTitle: habit.title,
        category: habit.category,
        dateKey: day.key,
        shortDay: day.shortDay,
        dayNum: day.dayNum,
        isToday: day.isToday,
        completed,
        weeklyHits,
        targetDaysPerWeek: habit.targetDaysPerWeek,
        adherenceRatio,
        streak,
        intensity: classifyCellIntensity(completed, weeklyHits, habit.targetDaysPerWeek),
      });
    }
  }

  const overallAdherencePct =
    totalWeeklyTarget > 0
      ? Math.min(100, Math.round((totalWeeklyChecked / totalWeeklyTarget) * 100))
      : 0;

  const dailyAveragePct =
    totalHabits > 0 && dailyTrends.length > 0
      ? Math.round(
          dailyTrends.reduce((sum, d) => sum + d.completionRate, 0) / dailyTrends.length
        )
      : 0;

  let trendDeltaPct = 0;
  if (totalHabits > 0 && dailyTrends.length >= 6) {
    const earlyWindow = dailyTrends.slice(0, 3);
    const recentWindow = dailyTrends.slice(-3);
    const earlyAvg =
      earlyWindow.reduce((sum, d) => sum + d.completionRate, 0) / earlyWindow.length;
    const recentAvg =
      recentWindow.reduce((sum, d) => sum + d.completionRate, 0) / recentWindow.length;
    trendDeltaPct = Math.round(recentAvg - earlyAvg);
  }

  let peakDay: DailyCompletionTrend | null = null;
  if (totalHabits > 0 && dailyTrends.length > 0) {
    peakDay = dailyTrends.reduce((best, curr) =>
      curr.completionRate >= best.completionRate ? curr : best
    );
  }

  return {
    days,
    dailyTrends,
    cells,
    totalWeeklyTarget,
    totalWeeklyChecked,
    overallAdherencePct,
    dailyAveragePct,
    trendDeltaPct,
    peakDay,
  };
}
