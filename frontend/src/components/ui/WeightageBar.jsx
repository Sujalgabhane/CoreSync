import React from 'react';

/**
 * Live weightage total bar.
 * Green at exactly 100%, red if under or over.
 */
export default function WeightageBar({ total, max = 100 }) {
  const pct = Math.min((total / max) * 100, 100);
  const exact = Math.abs(total - max) < 0.01;
  const over  = total > max;

  const barColor = exact ? 'bg-success-500' : over ? 'bg-danger-500' : 'bg-primary-500';
  const textColor = exact ? 'text-success-700' : over ? 'text-danger-600' : 'text-primary-700';
  const bgColor = exact ? 'bg-success-50' : over ? 'bg-danger-50' : 'bg-primary-50';

  return (
    <div className={`rounded-lg p-3 border ${exact ? 'border-success-200' : over ? 'border-danger-200' : 'border-primary-100'} ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-600">Total Weightage</span>
        <span className={`font-mono font-bold text-sm ${textColor}`}>
          {total.toFixed(0)}% / {max}%
        </span>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-fill ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!exact && (
        <p className={`text-xs mt-1.5 font-medium ${textColor}`}>
          {over
            ? `↑ ${(total - max).toFixed(0)}% over — reduce weightage`
            : `↓ ${(max - total).toFixed(0)}% remaining — add more weightage`
          }
        </p>
      )}
      {exact && (
        <p className="text-xs mt-1.5 font-medium text-success-700">
          ✓ Weightage balanced — ready to submit
        </p>
      )}
    </div>
  );
}
