import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  FollowUpRule,
  Quest,
  QuestCategory,
  QuestPriority,
  QuestReference,
} from '../types';
import { inferReferenceKind } from '../utils/workspaceState';

interface NewQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateQuest: (quest: Omit<Quest, 'id' | 'completed'>) => void;
}

const CATEGORIES: QuestCategory[] = [
  'Deep Work',
  'Engineering',
  'Design',
  'Writing',
  'Health',
];

const PRIORITIES: { id: QuestPriority; label: string; defaultXp: number; defaultCoins: number }[] = [
  { id: 'critical', label: 'Critical', defaultXp: 140, defaultCoins: 35 },
  { id: 'focus', label: 'Focus', defaultXp: 90, defaultCoins: 24 },
  { id: 'routine', label: 'Routine', defaultXp: 55, defaultCoins: 15 },
];

export const NewQuestModal: React.FC<NewQuestModalProps> = ({
  isOpen,
  onClose,
  onCreateQuest,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<QuestCategory>('Deep Work');
  const [priority, setPriority] = useState<QuestPriority>('focus');
  const [xpReward, setXpReward] = useState(90);
  const [dueLabel, setDueLabel] = useState('Today, 5:00 PM');
  const [refLabel, setRefLabel] = useState('');
  const [refLocation, setRefLocation] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDelayHours, setFollowUpDelayHours] = useState(24);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePriorityChange = (nextPriority: QuestPriority) => {
    setPriority(nextPriority);
    const preset = PRIORITIES.find((p) => p.id === nextPriority);
    if (preset) setXpReward(preset.defaultXp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const coinReward = Math.max(10, Math.round(xpReward * 0.25));

    const cleanLocation = refLocation.trim();
    const references: QuestReference[] | undefined = cleanLocation
      ? [
          {
            id: `ref-${Date.now()}`,
            label: refLabel.trim() || 'Reference',
            location: cleanLocation,
            kind: inferReferenceKind(cleanLocation),
          },
        ]
      : undefined;

    const cleanFollowUp = followUpTitle.trim();
    const followUpRules: FollowUpRule[] | undefined = cleanFollowUp
      ? [
          {
            id: `fur-${Date.now()}`,
            title: cleanFollowUp,
            category,
            priority: 'focus',
            delayHours: Math.max(0, followUpDelayHours),
            xpReward: 85,
            coinReward: 22,
          },
        ]
      : undefined;

    onCreateQuest({
      title: trimmed,
      notes: notes.trim() || undefined,
      category,
      priority,
      xpReward,
      coinReward,
      dueLabel: dueLabel.trim() || 'Today',
      references,
      followUpRules,
    });
    setTitle('');
    setNotes('');
    setRefLabel('');
    setRefLocation('');
    setFollowUpTitle('');
    setFollowUpDelayHours(24);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/35 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-quest-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-[#dfe3f4] bg-white p-6 sm:p-7 shadow-[0_12px_32px_-4px_rgba(70,72,212,0.18),0_6px_16px_-2px_rgba(19,27,46,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="new-quest-title"
              className="text-xl font-extrabold tracking-[-0.02em] text-[#131b2e]"
            >
              Create New Quest
            </h2>
            <p className="mt-0.5 text-xs text-[#464554]">
              Define a concrete outcome and set its XP bounty.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#464554] hover:bg-[#f2f3ff] hover:text-[#131b2e] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="quest-title" className="block text-xs font-bold text-[#131b2e]">
              Quest Objective
            </label>
            <input
              id="quest-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Ship interactive onboarding checklist"
              className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm text-[#131b2e] placeholder:text-[#767586]"
            />
          </div>

          <div>
            <label htmlFor="quest-notes" className="block text-xs font-bold text-[#131b2e]">
              Brief Notes (optional)
            </label>
            <textarea
              id="quest-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key acceptance criteria or links..."
              className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm text-[#131b2e] placeholder:text-[#767586]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="quest-category" className="block text-xs font-bold text-[#131b2e]">
                Category
              </label>
              <select
                id="quest-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as QuestCategory)}
                className="arcade-input mt-1.5 w-full rounded-2xl px-3.5 py-2.5 text-sm font-medium text-[#131b2e]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quest-due" className="block text-xs font-bold text-[#131b2e]">
                Target Window
              </label>
              <input
                id="quest-due"
                type="text"
                value={dueLabel}
                onChange={(e) => setDueLabel(e.target.value)}
                placeholder="Today, 5:00 PM"
                className="arcade-input mt-1.5 w-full rounded-2xl px-3.5 py-2.5 text-sm text-[#131b2e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-bold text-[#131b2e]">Priority Tier</span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#f2f3ff] p-1">
                {PRIORITIES.map((p) => {
                  const active = priority === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePriorityChange(p.id)}
                      className={`rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-white text-[#4648d4] shadow-sm'
                          : 'text-[#464554] hover:text-[#131b2e]'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="quest-xp" className="block text-xs font-bold text-[#131b2e]">
                XP Bounty
              </label>
              <input
                id="quest-xp"
                type="number"
                min={20}
                max={500}
                step={5}
                value={xpReward}
                onChange={(e) => setXpReward(Math.max(20, Number(e.target.value) || 20))}
                className="arcade-input mt-1.5 w-full rounded-2xl px-3.5 py-2.5 text-sm font-mono font-bold tabular-nums text-[#131b2e]"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-[#e8ebf8] pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="quest-ref-label" className="block text-xs font-bold text-[#131b2e]">
                  Location Label (optional)
                </label>
                <input
                  id="quest-ref-label"
                  type="text"
                  value={refLabel}
                  onChange={(e) => setRefLabel(e.target.value)}
                  placeholder="e.g., Design Doc"
                  className="arcade-input mt-1 w-full rounded-2xl px-3 py-2 text-xs text-[#131b2e]"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="quest-ref-location" className="block text-xs font-bold text-[#131b2e]">
                  Reference URL, Path, or Place
                </label>
                <input
                  id="quest-ref-location"
                  type="text"
                  value={refLocation}
                  onChange={(e) => setRefLocation(e.target.value)}
                  placeholder="https://..., src/App.tsx, or folder name"
                  className="arcade-input mt-1 w-full rounded-2xl px-3 py-2 text-xs text-[#131b2e]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="quest-followup-title" className="block text-xs font-bold text-[#131b2e]">
                  Follow-Up Quest Trigger (optional)
                </label>
                <input
                  id="quest-followup-title"
                  type="text"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                  placeholder="Next quest to trigger once this is completed..."
                  className="arcade-input mt-1 w-full rounded-2xl px-3 py-2 text-xs text-[#131b2e]"
                />
              </div>
              <div>
                <label htmlFor="quest-followup-delay" className="block text-xs font-bold text-[#131b2e]">
                  Trigger Timing
                </label>
                <select
                  id="quest-followup-delay"
                  value={followUpDelayHours}
                  onChange={(e) => setFollowUpDelayHours(Number(e.target.value))}
                  className="arcade-input mt-1 w-full rounded-2xl px-3 py-2 text-xs font-semibold text-[#131b2e]"
                >
                  <option value={0}>Immediately</option>
                  <option value={24}>In 24 hours</option>
                  <option value={72}>In 3 days</option>
                  <option value={168}>In 7 days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile-ghost rounded-full px-5 py-2.5 text-sm font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-tactile-primary rounded-full px-6 py-2.5 text-sm font-bold cursor-pointer"
            >
              Add Quest
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
