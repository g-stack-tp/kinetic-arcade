import React, { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Compass,
  Flame,
  Play,
  Shield,
  SlidersHorizontal,
  Star,
  Terminal,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { AppState, AvatarEmblem, AvatarTone, ScreenId } from '../types';
import { getLevelInfo } from '../data/initialData';

interface PlayerRailProps {
  state: AppState;
  timerRunning: boolean;
  timerSecondsLeft: number;
  streakPulseKey?: number;
  onClaimBounty: (bountyId: string) => void;
  onNavigate: (screen: ScreenId) => void;
}

const EMBLEM_ICONS: Record<AvatarEmblem, React.ComponentType<{ className?: string }>> = {
  bolt: Zap,
  compass: Compass,
  code: Terminal,
  flame: Flame,
  trophy: Trophy,
  star: Star,
};

const TONE_CLASSES: Record<AvatarTone, string> = {
  indigo: 'bg-[#f2f3ff] text-[#4648d4] border-[#c0c1ff]',
  emerald: 'bg-[#e6fbf3] text-[#006c49] border-[#6ffbbe]',
  amber: 'bg-[#fff5e4] text-[#855300] border-[#ffb95f]',
  coral: 'bg-[#fff1f3] text-[#ba1a1a] border-[#ffdad6]',
};

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PlayerRail: React.FC<PlayerRailProps> = ({
  state,
  timerRunning,
  timerSecondsLeft,
  streakPulseKey = 0,
  onClaimBounty,
  onNavigate,
}) => {
  const levelInfo = getLevelInfo(state.xp);
  const EmblemIcon = EMBLEM_ICONS[state.avatarEmblem] || Zap;
  const toneClass = TONE_CLASSES[state.avatarTone] || TONE_CLASSES.indigo;

  const prevPulseKeyRef = useRef(streakPulseKey);
  const [isStreakPulsing, setIsStreakPulsing] = useState(false);

  useEffect(() => {
    if (streakPulseKey > prevPulseKeyRef.current) {
      prevPulseKeyRef.current = streakPulseKey;
      setIsStreakPulsing(false);
      const rafId = window.requestAnimationFrame(() => {
        setIsStreakPulsing(true);
      });
      const timerId = window.setTimeout(() => {
        setIsStreakPulsing(false);
      }, 420);
      return () => {
        window.cancelAnimationFrame(rafId);
        window.clearTimeout(timerId);
      };
    }
    prevPulseKeyRef.current = streakPulseKey;
  }, [streakPulseKey]);

  const getMetricValue = (metric: 'quests' | 'habits' | 'focusMinutes'): number => {
    if (metric === 'quests') return state.questsCompletedToday;
    if (metric === 'habits') return state.habitsCheckedToday;
    return state.focusMinutesToday;
  };

  return (
    <aside className="space-y-6">
      {/* Player Level & Telemetry Module */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.04em] text-[#4648d4]">
              Level {levelInfo.level} · {levelInfo.rankTitle}
            </p>
            <h2 className="mt-1 truncate text-xl font-extrabold tracking-[-0.02em] text-[#131b2e]">
              {state.playerName}
            </h2>
            <p className="mt-0.5 truncate text-xs font-medium text-[#464554]">
              {state.playerRole}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('experience')}
            aria-label="Personalize player profile and manage data"
            title="Personalize player & manage data"
            className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform hover:scale-105 cursor-pointer ${toneClass}`}
          >
            <EmblemIcon className="h-5 w-5" />
          </button>
        </div>

        {/* XP Progress Track */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-bold text-[#131b2e]">Experience</span>
            <span className="font-mono font-bold tabular-nums text-[#464554]">
              {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={levelInfo.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Level progress"
            className="arcade-well mt-2 h-3.5 w-full overflow-hidden rounded-full p-0.5"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4648d4] to-[#6366f1] transition-all duration-300"
              style={{ width: `${Math.max(6, levelInfo.percent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#464554]">
            <span>{levelInfo.nextLevelXp - levelInfo.currentLevelXp} XP to Level {levelInfo.level + 1}</span>
            <button
              type="button"
              onClick={() => onNavigate('experience')}
              className="inline-flex items-center gap-1 font-bold text-[#4648d4] hover:underline cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Customize</span>
            </button>
          </div>
        </div>

        {/* Stat Strip (Clean Typographic Columns with Hairline Dividers) */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-[#e2e7ff] border-t border-[#e8ebf8] pt-5">
          <div className="pr-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#464554]">
              <Coins className="h-3.5 w-3.5 text-[#d97706]" />
              <span>Coins</span>
            </div>
            <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums text-[#131b2e]">
              {state.coins}
            </p>
          </div>
          <div className="px-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#464554]">
              <Flame
                className={`h-3.5 w-3.5 text-[#10b981] transition-transform duration-200 ${
                  isStreakPulsing ? 'scale-125' : ''
                }`}
              />
              <span>Streak</span>
            </div>
            <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums text-[#131b2e]">
              <span
                data-streak-pulsing={isStreakPulsing ? 'true' : 'false'}
                className={`inline-block rounded-lg px-1.5 -mx-1.5 transition-colors duration-200 ${
                  isStreakPulsing ? 'animate-streak-pulse text-[#006c49]' : ''
                }`}
              >
                {state.streakDays}d
              </span>
            </p>
          </div>
          <div className="pl-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#464554]">
              <Timer className="h-3.5 w-3.5 text-[#4648d4]" />
              <span>Focus</span>
            </div>
            <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums text-[#131b2e]">
              {state.focusMinutesToday}m
              <span className="text-xs font-semibold text-[#767586]">
                /{state.dailyFocusGoalMinutes}
              </span>
            </p>
          </div>
        </div>

        {/* Active Power-ups summary */}
        {(state.doubleXpCharges > 0 || state.streakShields > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e8ebf8] pt-3.5 text-xs font-medium text-[#464554]">
            {state.doubleXpCharges > 0 && (
              <span className="inline-flex items-center gap-1 text-[#4648d4] font-semibold">
                <Zap className="h-3.5 w-3.5" />
                2x XP Active ({state.doubleXpCharges} quests left)
              </span>
            )}
            {state.streakShields > 0 && (
              <span className="inline-flex items-center gap-1 text-[#006c49] font-semibold">
                <Shield className="h-3.5 w-3.5" />
                {state.streakShields} Streak Shield{state.streakShields > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Focus Sprint Quick Launcher */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#131b2e]">Focus Arena</h3>
            <p className="mt-0.5 text-xs text-[#464554]">
              {timerRunning
                ? 'Sprint in progress — stay locked in'
                : 'Run a timed sprint to earn bonus XP'}
            </p>
          </div>
          <span className="font-mono text-lg font-bold tabular-nums text-[#4648d4]">
            {formatClock(timerSecondsLeft)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('focus')}
          className="btn-tactile-ghost mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold cursor-pointer"
        >
          <Play className="h-4 w-4 text-[#4648d4]" />
          <span>{timerRunning ? 'Open Active Timer' : 'Launch Focus Sprint'}</span>
        </button>
      </section>

      {/* Daily Bounties */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-baseline justify-between">
          <h3 className="text-base font-bold text-[#131b2e]">Daily Bounties</h3>
          <span className="text-xs font-semibold tabular-nums text-[#464554]">
            {state.bounties.filter((b) => b.claimed).length}/{state.bounties.length} claimed
          </span>
        </div>

        <div className="mt-4 divide-y divide-[#eef0ff]">
          {state.bounties.map((bounty) => {
            const current = getMetricValue(bounty.metric);
            const progress = Math.min(bounty.target, current);
            const pct = Math.round((progress / bounty.target) * 100);
            const ready = current >= bounty.target && !bounty.claimed;

            return (
              <div key={bounty.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#131b2e]">{bounty.title}</p>
                    <p className="mt-0.5 text-xs text-[#464554]">
                      {bounty.description} · +{bounty.xpReward} XP · +{bounty.coinReward} Coins
                    </p>
                  </div>
                  {bounty.claimed ? (
                    <span className="shrink-0 text-xs font-bold text-[#006c49]">
                      Claimed
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => onClaimBounty(bounty.id)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer ${
                        ready
                          ? 'btn-tactile-amber'
                          : 'bg-[#f2f3ff] text-[#767586] border border-[#dfe3f4]'
                      }`}
                    >
                      {ready ? 'Claim' : `${progress}/${bounty.target}`}
                    </button>
                  )}
                </div>

                <div className="arcade-well mt-2.5 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      bounty.claimed || ready
                        ? 'bg-gradient-to-r from-[#10b981] to-[#34d399]'
                        : 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]'
                    }`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
