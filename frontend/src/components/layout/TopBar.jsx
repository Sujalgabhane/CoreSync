import React from 'react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';
import useAuthStore from '../../stores/authStore';
import useCycleStore from '../../stores/cycleStore';

const phaseColors = {
  'Goal Setting': 'bg-primary-50 text-primary-700 border-primary-200',
  'Q1':           'bg-success-50 text-success-700 border-success-200',
  'Q2':           'bg-success-50 text-success-700 border-success-200',
  'Q3':           'bg-success-50 text-success-700 border-success-200',
  'Q4':           'bg-success-50 text-success-700 border-success-200',
  'Upcoming':     'bg-slate-100 text-slate-600 border-slate-200',
};

export default function TopBar({ onMenuToggle }) {
  const { user } = useAuthStore();
  const { cycle, currentPhase } = useCycleStore();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  const phaseLabel = currentPhase
    ? currentPhase === 'Goal Setting'
      ? 'Goal Setting Open'
      : `${currentPhase} Check-in`
    : null;

  const phaseClass = phaseColors[currentPhase] || phaseColors['Upcoming'];

  return (
    <header className="
      fixed top-0 right-0 left-0 lg:left-64
      h-16 bg-white border-b border-border z-10
      flex items-center justify-between px-4 lg:px-6
      transition-all duration-300
    ">
      {/* Left: Hamburger + App name on mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
        <span className="font-bold text-slate-800 text-base lg:hidden">CoreSync</span>
      </div>

      {/* Center: Active cycle + phase badge */}
      <div className="flex items-center gap-3">
        {cycle && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-muted font-medium">{cycle.name}</span>
            {phaseLabel && (
              <span className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                text-xs font-semibold border ${phaseClass}
              `}>
                <span className={`
                  w-1.5 h-1.5 rounded-full
                  ${currentPhase !== 'Upcoming' ? 'bg-current animate-pulse' : 'bg-current'}
                `} />
                {phaseLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Notifications + Avatar */}
      <div className="flex items-center gap-2">
        <button
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Notifications"
        >
          <BellIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="
            w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center
            text-white text-xs font-bold flex-shrink-0
          ">
            {initials}
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold text-slate-800 leading-tight">{user?.name}</p>
            <p className="text-xs text-muted capitalize leading-tight">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
