import React from 'react';
import { Plus } from 'lucide-react';
import { ScreenId } from '../types';

interface TopBarProps {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onOpenNewQuest: () => void;
}

const NAV_ITEMS: { id: ScreenId; label: string }[] = [
  { id: 'quests', label: 'Quest Board' },
  { id: 'habits', label: 'Habits' },
  { id: 'focus', label: 'Focus Arena' },
  { id: 'vault', label: 'Reward Vault' },
  { id: 'experience', label: 'Experience' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeScreen,
  onNavigate,
  onOpenNewQuest,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe3f4] bg-[#faf8ff]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('quests')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4648d4] rounded-lg"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#4648d4] text-white shadow-[0_3px_0_0_#2f2ebe]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M9.5 1.5L3.5 9H8L6.5 14.5L12.5 7H8L9.5 1.5Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-lg font-extrabold tracking-[-0.025em] text-[#131b2e]">
            Kinetic Arcade
          </span>
        </button>

        {/* Zone 2: Single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4648d4] rounded ${
                  isActive
                    ? 'text-[#4648d4]'
                    : 'text-[#464554] hover:text-[#131b2e]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-[2.5px] rounded-full bg-[#4648d4]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewQuest}
            className="btn-tactile-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>New Quest</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-[#e8ebf8] px-4 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#4648d4] text-white'
                  : 'text-[#464554] hover:bg-[#eaedff]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
