import React from 'react';
import { FlagIcon, UsersIcon, ChartBarIcon, DocumentIcon, BoltIcon } from '@heroicons/react/24/outline';

const iconMap = {
  goals: FlagIcon,
  team: UsersIcon,
  analytics: ChartBarIcon,
  document: DocumentIcon,
  default: BoltIcon,
};

export default function EmptyState({
  icon = 'default',
  title = 'Nothing here yet',
  description = 'Get started by creating your first item.',
  action,
  actionLabel = 'Get Started',
}) {
  const Icon = iconMap[icon] || iconMap.default;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Illustrated icon */}
      <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center mb-5 shadow-sm">
        <Icon className="w-10 h-10 text-primary-400" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-muted max-w-sm mb-6">{description}</p>

      {action && (
        <button onClick={action} className="btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
