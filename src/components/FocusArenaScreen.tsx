import React from 'react';
import { CheckCircle2, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { AppState } from '../types';

interface FocusArenaScreenProps {
  state: AppState;
  durationMinutes: number;
  secondsLeft: number;
  isRunning: boolean;
  selectedQuestId: string;
  onSelectDuration: (minutes: number) => void;
  onSelectQuest: (questId: string) => void;
  onToggleRun: () => void;
  onResetTimer: () => void;
  onCompleteEarly: () => void;
}

const PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '25 min', minutes: 25 },
  { label: '50 min', minutes: 50 },
  { label: '5 min Sprint', minutes: 5 },
];

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const FocusArenaScreen: React.FC<FocusArenaScreenProps> = ({
  state,
  durationMinutes,
  secondsLeft,
  isRunning,
  selectedQuestId,
  onSelectDuration,
  onSelectQuest,
  onToggleRun,
  onResetTimer,
  onCompleteEarly,
}) => {
  const activeQuests = state.quests.filter((q) => !q.completed);
  const totalSeconds = durationMinutes * 60;
  const elapsedSeconds = Math.max(0, totalSeconds - secondsLeft);
  const progressPct = totalSeconds > 0 ? Math.round((elapsedSeconds / totalSeconds) * 100) : 0;

  const estimatedXp = Math.max(20, Math.round(durationMinutes * 2.5));
  const estimatedCoins = Math.max(6, Math.round(durationMinutes * 0.6));

  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#131b2e]">
          Focus Arena
        </h1>
        <p className="mt-1 text-sm text-[#464554] tabular-nums">
          Lock in an uninterrupted work block linked to an active quest · {state.focusMinutesToday}m logged today
        </p>
      </div>

      {/* Main Console Timer */}
      <section className="arcade-card rounded-3xl p-6 sm:p-8">
        {/* Preset Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e8ebf8] pb-5">
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-[#f2f3ff] p-1">
            {PRESETS.map((preset) => {
              const active = durationMinutes === preset.minutes;
              return (
                <button
                  key={preset.minutes}
                  type="button"
                  disabled={isRunning}
                  onClick={() => onSelectDuration(preset.minutes)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    active
                      ? 'bg-[#4648d4] text-white shadow-sm'
                      : 'text-[#464554] hover:text-[#131b2e]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs font-semibold tabular-nums text-[#464554]">
            Sprint Bounty: <span className="font-bold text-[#4648d4]">+{estimatedXp} XP</span> ·{' '}
            <span className="font-bold text-[#855300]">+{estimatedCoins} Coins</span>
          </p>
        </div>

        {/* Center Dial & Controls */}
        <div className="mt-8 flex flex-col items-center">
          <div className="relative flex h-52 w-52 items-center justify-center">
            <svg className="h-52 w-52 -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="#eaedff"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={isRunning ? '#4648d4' : '#6366f1'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-[stroke-dashoffset] duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[42px] font-bold leading-none tracking-[-0.04em] tabular-nums text-[#131b2e]">
                {formatClock(secondsLeft)}
              </span>
              <span className="mt-2 text-xs font-bold tracking-[0.04em] text-[#464554]">
                {isRunning ? 'SPRINT ACTIVE' : elapsedSeconds > 0 ? 'PAUSED' : 'READY'}
              </span>
            </div>
          </div>

          {/* Linked Quest Selector */}
          <div className="mt-6 w-full max-w-md">
            <label htmlFor="focus-quest-select" className="block text-xs font-bold text-[#464554]">
              Linked Quest Objective
            </label>
            <select
              id="focus-quest-select"
              value={selectedQuestId}
              onChange={(e) => onSelectQuest(e.target.value)}
              className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#131b2e]"
            >
              <option value="">Free Deep Work Session (No specific quest)</option>
              {activeQuests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} (+{q.xpReward} XP)
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onToggleRun}
              className="btn-tactile-primary inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isRunning ? 'Pause Sprint' : elapsedSeconds > 0 ? 'Resume Sprint' : 'Start Sprint'}</span>
            </button>

            <button
              type="button"
              onClick={onCompleteEarly}
              className="btn-tactile-emerald inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Log &amp; Claim</span>
            </button>

            <button
              type="button"
              onClick={onResetTimer}
              className="btn-tactile-ghost inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      {/* Focus Session Log Table */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-[#4648d4]" />
            <h2 className="text-base font-bold text-[#131b2e]">Recent Focus Sessions</h2>
          </div>
          <span className="text-xs font-semibold tabular-nums text-[#464554]">
            {state.focusSessions.length} logged
          </span>
        </div>

        {state.focusSessions.length === 0 ? (
          <p className="mt-4 text-sm text-[#464554]">
            No sprints logged yet. Start a timer above to record your first deep work block.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e8ebf8] text-xs font-bold text-[#464554]">
                  <th className="py-2.5 pr-4">Objective</th>
                  <th className="px-4 py-2.5 text-right">Duration</th>
                  <th className="px-4 py-2.5 text-right">Reward</th>
                  <th className="py-2.5 pl-4 text-right">Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0ff] text-sm">
                {state.focusSessions.map((session) => (
                  <tr key={session.id}>
                    <td className="py-3 pr-4 font-semibold text-[#131b2e]">
                      {session.questTitle}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-[#464554]">
                      {session.durationMinutes} min
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold tabular-nums text-[#4648d4]">
                      +{session.xpEarned} XP · +{session.coinsEarned}c
                    </td>
                    <td className="py-3 pl-4 text-right text-xs tabular-nums text-[#464554]">
                      {new Date(session.completedAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
