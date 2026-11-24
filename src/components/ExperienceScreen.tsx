import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Compass,
  Cpu,
  Download,
  Flame,
  FolderOpen,
  RotateCcw,
  Save,
  Star,
  Terminal,
  Trash2,
  Trophy,
  Upload,
  Zap,
} from 'lucide-react';
import { AiModelId, AppState, AvatarEmblem, AvatarTone } from '../types';
import { AI_MODEL_OPTIONS, getAiModelLabel } from '../utils/workspaceState';

export type ExperiencePresetId = 'product' | 'study' | 'starter';

interface ExperienceScreenProps {
  state: AppState;
  onUpdateProfile: (updates: {
    playerName: string;
    playerRole: string;
    avatarEmblem: AvatarEmblem;
    avatarTone: AvatarTone;
    dailyFocusGoalMinutes: number;
    defaultSprintMinutes: number;
    soundEnabled: boolean;
  }) => void;
  onUpdateAiSettings: (updates: {
    aiModel: AiModelId;
    aiAutoFallback: boolean;
  }) => void;
  onLoadPreset: (preset: ExperiencePresetId) => void;
  onImportState: (jsonText: string) => { ok: boolean; error?: string };
  onPurgeData: (keepPersonalization: boolean) => void;
}

const EMBLEMS: { id: AvatarEmblem; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'bolt', label: 'Bolt', Icon: Zap },
  { id: 'compass', label: 'Compass', Icon: Compass },
  { id: 'code', label: 'Terminal', Icon: Terminal },
  { id: 'flame', label: 'Flame', Icon: Flame },
  { id: 'trophy', label: 'Trophy', Icon: Trophy },
  { id: 'star', label: 'Star', Icon: Star },
];

const TONES: { id: AvatarTone; label: string; bg: string; text: string; border: string }[] = [
  {
    id: 'indigo',
    label: 'Indigo',
    bg: 'bg-[#f2f3ff]',
    text: 'text-[#4648d4]',
    border: 'border-[#c0c1ff]',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    bg: 'bg-[#e6fbf3]',
    text: 'text-[#006c49]',
    border: 'border-[#6ffbbe]',
  },
  {
    id: 'amber',
    label: 'Amber',
    bg: 'bg-[#fff5e4]',
    text: 'text-[#855300]',
    border: 'border-[#ffb95f]',
  },
  {
    id: 'coral',
    label: 'Coral',
    bg: 'bg-[#fff1f3]',
    text: 'text-[#ba1a1a]',
    border: 'border-[#ffdad6]',
  },
];

export const ExperienceScreen: React.FC<ExperienceScreenProps> = ({
  state,
  onUpdateProfile,
  onUpdateAiSettings,
  onLoadPreset,
  onImportState,
  onPurgeData,
}) => {
  const [name, setName] = useState(state.playerName);
  const [role, setRole] = useState(state.playerRole);
  const [emblem, setEmblem] = useState<AvatarEmblem>(state.avatarEmblem);
  const [tone, setTone] = useState<AvatarTone>(state.avatarTone);
  const [focusGoal, setFocusGoal] = useState(state.dailyFocusGoalMinutes);
  const [sprintDefault, setSprintDefault] = useState(state.defaultSprintMinutes);
  const [soundEnabled, setSoundEnabled] = useState(state.soundEnabled);

  const [confirmPurgeMode, setConfirmPurgeMode] = useState<'none' | 'blank' | 'full'>('none');
  const [importFeedback, setImportFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(state.playerName);
    setRole(state.playerRole);
    setEmblem(state.avatarEmblem);
    setTone(state.avatarTone);
    setFocusGoal(state.dailyFocusGoalMinutes);
    setSprintDefault(state.defaultSprintMinutes);
    setSoundEnabled(state.soundEnabled);
  }, [
    state.playerName,
    state.playerRole,
    state.avatarEmblem,
    state.avatarTone,
    state.dailyFocusGoalMinutes,
    state.defaultSprintMinutes,
    state.soundEnabled,
  ]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      playerName: name.trim() || 'Player One',
      playerRole: role.trim() || 'Kinetic Builder',
      avatarEmblem: emblem,
      avatarTone: tone,
      dailyFocusGoalMinutes: Math.max(15, Math.min(480, Number(focusGoal) || 90)),
      defaultSprintMinutes: Number(sprintDefault) || 25,
      soundEnabled,
    });
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kinetic-arcade-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = onImportState(text);
      if (result.ok) {
        setImportFeedback({ type: 'ok', message: `Loaded workspace from "${file.name}".` });
      } else {
        setImportFeedback({
          type: 'err',
          message: result.error || 'Could not parse workspace JSON file.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedToneStyle = TONES.find((t) => t.id === tone) || TONES[0];
  const SelectedEmblemIcon =
    EMBLEMS.find((e) => e.id === emblem)?.Icon || Zap;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#131b2e]">
          Player &amp; Data Experience
        </h1>
        <p className="mt-1 text-sm text-[#464554]">
          Personalize your player identity, load curated workspace presets, back up JSON, or purge local data.
        </p>
      </div>

      {/* Section 1: Personalize Player */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex flex-col gap-4 border-b border-[#e8ebf8] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${selectedToneStyle.bg} ${selectedToneStyle.text} ${selectedToneStyle.border}`}
            >
              <SelectedEmblemIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-[-0.015em] text-[#131b2e]">
                Personalize Profile
              </h2>
              <p className="text-xs text-[#464554]">
                Previewing <span className="font-bold text-[#131b2e]">{name || 'Player One'}</span> ·{' '}
                <span>{role || 'Kinetic Builder'}</span>
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-name" className="block text-xs font-bold text-[#131b2e]">
                Player Name
              </label>
              <input
                id="profile-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#131b2e]"
              />
            </div>

            <div>
              <label htmlFor="profile-role" className="block text-xs font-bold text-[#131b2e]">
                Role or Focus Title
              </label>
              <input
                id="profile-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Product Builder, Researcher"
                className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm text-[#131b2e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-bold text-[#131b2e]">Emblem Icon</span>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {EMBLEMS.map(({ id, label, Icon }) => {
                  const active = emblem === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setEmblem(id)}
                      aria-label={`Select ${label} emblem`}
                      aria-pressed={active}
                      className={`flex h-11 items-center justify-center rounded-2xl border transition-colors cursor-pointer ${
                        active
                          ? 'border-[#4648d4] bg-[#f2f3ff] text-[#4648d4]'
                          : 'border-[#dfe3f4] bg-white text-[#464554] hover:border-[#c0c1ff]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-[#131b2e]">Badge Accent</span>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {TONES.map((t) => {
                  const active = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      aria-pressed={active}
                      className={`h-11 rounded-2xl border text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? `${t.bg} ${t.text} ${t.border} ring-2 ring-[#4648d4]/25`
                          : 'border-[#dfe3f4] bg-white text-[#464554] hover:bg-[#faf8ff]'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="focus-goal" className="block text-xs font-bold text-[#131b2e]">
                Daily Focus Goal (min)
              </label>
              <input
                id="focus-goal"
                type="number"
                min={15}
                max={480}
                step={5}
                value={focusGoal}
                onChange={(e) => setFocusGoal(Number(e.target.value) || 15)}
                className="arcade-input mt-1.5 w-full rounded-2xl px-4 py-2.5 text-sm font-mono font-bold tabular-nums text-[#131b2e]"
              />
            </div>

            <div>
              <label htmlFor="default-sprint" className="block text-xs font-bold text-[#131b2e]">
                Default Focus Sprint
              </label>
              <select
                id="default-sprint"
                value={sprintDefault}
                onChange={(e) => setSprintDefault(Number(e.target.value))}
                className="arcade-input mt-1.5 w-full rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-[#131b2e]"
              >
                <option value={5}>5 min Quick Sprint</option>
                <option value={15}>15 min Warmup</option>
                <option value={25}>25 min Classic</option>
                <option value={50}>50 min Deep Block</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex h-[42px] w-full items-center justify-between rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] px-4 cursor-pointer">
                <span className="text-xs font-bold text-[#131b2e]">Audio Chimes</span>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="h-4 w-4 accent-[#4648d4]"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="btn-tactile-primary inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </section>

      {/* Section 2: AI Drafting Model Selection */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex flex-col gap-3 border-b border-[#e8ebf8] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#c0c1ff] bg-[#f2f3ff] text-[#4648d4]">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-[-0.015em] text-[#131b2e]">
                AI Drafting Model
              </h2>
              <p className="text-xs text-[#464554]">
                Active for Quest Planner, Follow-Ups, Habits &amp; Boss Raids:{' '}
                <span className="font-bold text-[#131b2e]">
                  {getAiModelLabel(state.aiModel)}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Select AI drafting model"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {AI_MODEL_OPTIONS.map((option) => {
            const active = state.aiModel === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  onUpdateAiSettings({
                    aiModel: option.id,
                    aiAutoFallback: state.aiAutoFallback,
                  })
                }
                className={`flex flex-col items-start rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-[#4648d4] bg-[#f2f3ff]/75 ring-2 ring-[#4648d4]/20'
                    : 'border-[#dfe3f4] bg-white hover:border-[#c0c1ff] hover:bg-[#faf8ff]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#131b2e]">
                    {option.label}
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? 'border-[#4648d4] bg-[#4648d4] text-white'
                        : 'border-[#c7c4d7] bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] font-bold text-[#4648d4]">
                  {option.id} · {option.tagline}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#464554]">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] px-4 py-3 cursor-pointer">
          <div>
            <span className="block text-xs font-bold text-[#131b2e]">
              Auto-fallback on high demand (503)
            </span>
            <span className="mt-0.5 block text-xs text-[#464554]">
              Automatically retry with the alternate model if the selected model is temporarily overloaded.
            </span>
          </div>
          <input
            type="checkbox"
            checked={state.aiAutoFallback}
            onChange={(e) =>
              onUpdateAiSettings({
                aiModel: state.aiModel,
                aiAutoFallback: e.target.checked,
              })
            }
            className="h-4 w-4 shrink-0 accent-[#4648d4]"
          />
        </label>
      </section>

      {/* Section 3: Load Experience & JSON Backup */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex flex-col gap-3 border-b border-[#e8ebf8] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-[-0.015em] text-[#131b2e]">
              Load Experience &amp; Backup
            </h2>
            <p className="mt-0.5 text-xs text-[#464554]">
              Switch between curated workspace scenarios or import/export your local state as JSON.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#4648d4]" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-tactile-ghost inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-[#006c49]" />
              <span>Load JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {importFeedback && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-semibold ${
              importFeedback.type === 'ok'
                ? 'border-[#d3f5e8] bg-[#f4fcf8] text-[#006c49]'
                : 'border-[#ffdad6] bg-[#fff1f3] text-[#ba1a1a]'
            }`}
          >
            {importFeedback.message}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] p-4">
            <div>
              <h3 className="text-sm font-bold text-[#131b2e]">Product Launch Sprint</h3>
              <p className="mt-1 text-xs text-[#464554]">
                Release Candidate Boss Raid, 6 engineering &amp; design quests, and 5 daily habits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadPreset('product')}
              className="btn-tactile-ghost mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#4648d4]" />
              <span>Load Launch Preset</span>
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] p-4">
            <div>
              <h3 className="text-sm font-bold text-[#131b2e]">Deep Study &amp; Research</h3>
              <p className="mt-1 text-xs text-[#464554]">
                Thesis Milestone Boss Raid, spaced-repetition quests, reading &amp; recall habits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadPreset('study')}
              className="btn-tactile-ghost mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
            >
              <FolderOpen className="h-3.5 w-3.5 text-[#4648d4]" />
              <span>Load Study Preset</span>
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#dfe3f4] bg-[#faf8ff] p-4">
            <div>
              <h3 className="text-sm font-bold text-[#131b2e]">Fresh Level 1 Starter</h3>
              <p className="mt-1 text-xs text-[#464554]">
                Keeps your personalized player profile, resets XP &amp; Coins to 0 with a clean starter board.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadPreset('starter')}
              className="btn-tactile-ghost mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#006c49]" />
              <span>Load Clean Starter</span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Purge Local Data */}
      <section className="arcade-card rounded-3xl p-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ffdad6] bg-[#fff1f3] text-[#ba1a1a]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold tracking-[-0.015em] text-[#131b2e]">
              Purge Workspace Data
            </h2>
            <p className="mt-1 text-sm text-[#464554]">
              Clear stored quests, habits, focus history, coins, and XP from browser storage. Export JSON above first if you want a backup.
            </p>

            {confirmPurgeMode === 'none' ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmPurgeMode('blank')}
                  className="btn-tactile-ghost inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-[#ba1a1a] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purge Activity Data (Keep Profile)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPurgeMode('full')}
                  className="rounded-full border border-[#ffdad6] bg-[#fff1f3] px-4 py-2 text-xs font-bold text-[#ba1a1a] hover:bg-[#ffe4e8] transition-colors cursor-pointer"
                >
                  Purge Everything &amp; Reset Profile
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffdad6] bg-[#fff1f3] p-4">
                <p className="text-xs font-bold text-[#93000a]">
                  {confirmPurgeMode === 'blank'
                    ? 'Confirm purging all quests, habits, focus logs, XP, and coins while keeping your profile name & emblem?'
                    : 'Confirm wiping all local storage data and resetting the player profile back to blank Level 1?'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmPurgeMode('none')}
                    className="btn-tactile-ghost rounded-full px-4 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onPurgeData(confirmPurgeMode === 'blank');
                      setConfirmPurgeMode('none');
                    }}
                    className="rounded-full bg-[#ba1a1a] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#93000a] transition-colors cursor-pointer"
                  >
                    Confirm Purge
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
