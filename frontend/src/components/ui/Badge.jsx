import React from 'react';

const statusConfig = {
  DRAFT:        { label: 'Draft',        className: 'badge-draft' },
  SUBMITTED:    { label: 'Submitted',    className: 'badge-submitted' },
  UNDER_REVIEW: { label: 'Under Review', className: 'badge-review' },
  APPROVED:     { label: 'Approved',     className: 'badge-approved' },
  RETURNED:     { label: 'Returned',     className: 'badge-returned' },
};

export function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, className: 'badge-draft' };
  return (
    <span className={config.className}>
      {config.label}
    </span>
  );
}

export function MomentumBadge({ flag }) {
  if (!flag) return null;
  const config = {
    ACCELERATING: { label: '↑ Accelerating', className: 'momentum-accelerating' },
    STABLE:       { label: '→ Stable',        className: 'momentum-stable' },
    DECELERATING: { label: '↓ Decelerating',  className: 'momentum-decelerating' },
  };
  const { label, className } = config[flag] || config.STABLE;
  return <span className={className}>{label}</span>;
}

export function UomBadge({ type }) {
  const config = {
    MIN:      { label: 'MIN ↑', className: 'badge bg-blue-50 text-blue-700' },
    MAX:      { label: 'MAX ↓', className: 'badge bg-violet-50 text-violet-700' },
    TIMELINE: { label: 'Timeline', className: 'badge bg-orange-50 text-orange-700' },
    ZERO:     { label: 'Zero', className: 'badge bg-teal-50 text-teal-700' },
  };
  const { label, className } = config[type] || { label: type, className: 'badge-draft' };
  return <span className={className}>{label}</span>;
}

export function PhaseBadge({ phase }) {
  if (!phase) return null;
  const isCheckin = phase.startsWith('Q');
  return (
    <span className={`badge ${isCheckin ? 'badge-approved' : 'badge-submitted'}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse`} />
      {isCheckin ? `${phase} Check-in Open` : 'Goal Setting Open'}
    </span>
  );
}
