import React from 'react';

/**
 * Circular progress ring using SVG.
 * @param {number} value - 0 to 100
 * @param {number} size - diameter in px
 * @param {number} stroke - stroke width
 * @param {string} color - Tailwind color class for stroke
 */
export default function ProgressRing({
  value = 0,
  size = 80,
  stroke = 8,
  label,
  sublabel,
  color = '#4F46E5',
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-bold text-slate-800" style={{ fontSize: size * 0.2 }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      {label && <p className="text-sm font-semibold text-slate-700 text-center">{label}</p>}
      {sublabel && <p className="text-xs text-muted text-center">{sublabel}</p>}
    </div>
  );
}
