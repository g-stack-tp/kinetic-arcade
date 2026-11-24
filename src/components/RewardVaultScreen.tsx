import React, { useState } from 'react';
import { Award, Check, Coins, Gift, Plus, Shield, Sparkles, Zap } from 'lucide-react';
import { AppState, RewardItem } from '../types';
import { getBossProgress } from '../utils/workspaceState';

interface RewardVaultScreenProps {
  state: AppState;
  onRedeemReward: (rewardId: string) => void;
  onUseRedeemedReward: (redeemedId: string) => void;
  onCreateReward: (title: string, description: string, costCoins: number) => void;
}

export const RewardVaultScreen: React.FC<RewardVaultScreenProps> = ({
  state,
  onRedeemReward,
  onUseRedeemedReward,
  onCreateReward,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(75);

  const completedQuestsTotal = state.quests.filter((q) => q.completed).length;

  const achievements = [
    {
      id: 'ach-1',
      title: 'First Clear',
      description: 'Complete at least 1 quest on the board',
      current: Math.min(1, completedQuestsTotal),
      target: 1,
    },
    {
      id: 'ach-2',
      title: 'Momentum Architect',
      description: 'Reach 1,000 total Experience Points',
      current: Math.min(1000, state.xp),
      target: 1000,
    },
    {
      id: 'ach-3',
      title: 'Boss Slayer',
      description: 'Defeat a Boss Encounter',
      current:
        state.raidHistory.length > 0 ||
        (state.boss ? getBossProgress(state.boss).bossDefeated : false)
          ? 1
          : 0,
      target: 1,
    },
    {
      id: 'ach-4',
      title: 'Streak Keeper',
      description: 'Maintain a 5-day global streak',
      current: Math.min(5, state.streakDays),
      target: 5,
    },
    {
      id: 'ach-5',
      title: 'Deep Sprinter',
      description: 'Log 50 focus minutes in a single day',
      current: Math.min(50, state.focusMinutesToday),
      target: 50,
    },
    {
      id: 'ach-6',
      title: 'Vault Patron',
      description: 'Redeem 2 rewards from the Vault',
      current: Math.min(2, state.redeemedRewards.length),
      target: 2,
    },
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateReward(
      trimmed,
      description.trim() || 'Personal milestone reward',
      Math.max(10, cost)
    );
    setTitle('');
    setDescription('');
    setCost(75);
    setShowCreateForm(false);
  };

  const renderIcon = (kind: RewardItem['kind']) => {
    if (kind === 'boost') return <Zap className="h-5 w-5 text-[#4648d4]" />;
    if (kind === 'shield') return <Shield className="h-5 w-5 text-[#006c49]" />;
    return <Gift className="h-5 w-5 text-[#d97706]" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#131b2e]">
            Reward Vault
          </h1>
          <p className="mt-1 text-sm text-[#464554]">
            Trade earned coins for power-ups, streak shields, and real-world breaks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#dfe3f4] bg-white px-4 py-2 text-sm font-extrabold tabular-nums text-[#131b2e]">
            <Coins className="h-4 w-4 text-[#f59e0b]" />
            <span>{state.coins} Coins Available</span>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Custom Reward</span>
          </button>
        </div>
      </div>

      {/* Create Custom Reward Drawer */}
      {showCreateForm && (
        <form onSubmit={handleCreateSubmit} className="arcade-card rounded-3xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#131b2e]">Add Personal Vault Reward</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="reward-title" className="block text-xs font-bold text-[#131b2e]">
                Reward Title
              </label>
              <input
                id="reward-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Order Friday Ramen Takeout"
                className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm text-[#131b2e]"
              />
            </div>
            <div>
              <label htmlFor="reward-cost" className="block text-xs font-bold text-[#131b2e]">
                Coin Price
              </label>
              <input
                id="reward-cost"
                type="number"
                min={10}
                max={2000}
                step={5}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value) || 10)}
                className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm font-mono font-bold tabular-nums text-[#131b2e]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="reward-desc" className="block text-xs font-bold text-[#131b2e]">
              Description
            </label>
            <input
              id="reward-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note or rule..."
              className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm text-[#131b2e]"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="btn-tactile-ghost rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-tactile-primary rounded-full px-5 py-2 text-xs font-bold cursor-pointer"
            >
              Save to Vault
            </button>
          </div>
        </form>
      )}

      {/* Shop Catalog Grid */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {state.rewards.map((reward) => {
          const canAfford = state.coins >= reward.costCoins;
          return (
            <div
              key={reward.id}
              className="arcade-card flex flex-col justify-between rounded-3xl p-6"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f2f3ff] border border-[#dfe3f4]">
                  {renderIcon(reward.kind)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#131b2e]">{reward.title}</h3>
                  <p className="mt-1 text-sm text-[#464554]">{reward.description}</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#eef0ff] pt-4">
                <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-[#855300]">
                  <Coins className="h-4 w-4 text-[#f59e0b]" />
                  {reward.costCoins} Coins
                </span>
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onRedeemReward(reward.id)}
                  className={`rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer ${
                    canAfford
                      ? 'btn-tactile-amber'
                      : 'bg-[#f2f3ff] text-[#767586] border border-[#dfe3f4]'
                  }`}
                >
                  {canAfford ? 'Redeem Reward' : `Need ${reward.costCoins - state.coins} more`}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Redeemed Inventory */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#f59e0b]" />
            <h2 className="text-base font-bold text-[#131b2e]">Claimed Passes &amp; History</h2>
          </div>
          <span className="text-xs font-semibold tabular-nums text-[#464554]">
            {state.redeemedRewards.filter((r) => !r.used).length} ready to use
          </span>
        </div>

        {state.redeemedRewards.length === 0 ? (
          <p className="mt-4 text-sm text-[#464554]">
            No rewards redeemed yet. Complete quests and bounties to earn coins.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[#eef0ff]">
            {state.redeemedRewards.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-bold text-[#131b2e]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[#464554]">
                    Redeemed {new Date(item.redeemedAt).toLocaleDateString()} ·{' '}
                    {item.kind === 'boost'
                      ? 'Applied automatically to next quests'
                      : item.kind === 'shield'
                        ? 'Stored in Streak Protection'
                        : item.used
                          ? 'Enjoyed'
                          : 'Ready to claim break'}
                  </p>
                </div>

                {item.kind === 'treat' && !item.used ? (
                  <button
                    type="button"
                    onClick={() => onUseRedeemedReward(item.id)}
                    className="btn-tactile-emerald rounded-full px-4 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    Mark Used
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006c49]">
                    <Check className="h-3.5 w-3.5" />
                    {item.used ? 'Used' : 'Active'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Achievements Grid */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#4648d4]" />
            <h2 className="text-base font-bold text-[#131b2e]">Achievements</h2>
          </div>
          <span className="text-xs font-semibold tabular-nums text-[#464554]">
            {achievements.filter((a) => a.current >= a.target).length}/{achievements.length} unlocked
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((ach) => {
            const unlocked = ach.current >= ach.target;
            const pct = Math.round((ach.current / ach.target) * 100);
            return (
              <div
                key={ach.id}
                className={`rounded-2xl border p-4 ${
                  unlocked
                    ? 'border-[#d3f5e8] bg-[#f4fcf8]'
                    : 'border-[#dfe3f4] bg-[#faf8ff]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#131b2e]">{ach.title}</h3>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      unlocked ? 'text-[#006c49]' : 'text-[#464554]'
                    }`}
                  >
                    {unlocked ? 'Unlocked' : `${ach.current}/${ach.target}`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#464554]">{ach.description}</p>
                <div className="arcade-well mt-3 h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${
                      unlocked ? 'bg-[#10b981]' : 'bg-[#4648d4]'
                    }`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
