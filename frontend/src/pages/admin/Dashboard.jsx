import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import ProgressRing from '../../components/ui/ProgressRing';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import { ExclamationTriangleIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function HeatmapCell({ pct }) {
  const color = pct === null || pct === undefined
    ? 'bg-slate-100 text-muted'
    : pct >= 80 ? 'bg-success-500 text-white'
    : pct >= 50 ? 'bg-warning-500 text-white'
    : 'bg-danger-500 text-white';

  return (
    <td className={`px-3 py-2.5 text-center text-xs font-mono font-bold rounded ${color} transition-colors`}>
      {pct !== null && pct !== undefined ? `${Math.round(pct)}%` : '—'}
    </td>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard-stats')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;
  if (!stats?.cycle) return (
    <div className="text-center py-20">
      <p className="text-lg font-semibold text-slate-700">No active cycle found</p>
      <p className="text-muted text-sm mt-2">Create a goal cycle to get started</p>
      <Link to="/admin/cycles" className="btn-primary mt-4 inline-flex">Manage Cycles</Link>
    </div>
  );

  const { cycle, employees, submitted, approved, activeEscalations, heatmap } = stats;
  const submittedPct = employees ? Math.round((submitted / employees) * 100) : 0;
  const approvedPct  = employees ? Math.round((approved  / employees) * 100) : 0;

  // Build heatmap data: { department -> { Q1: pct, Q2: pct, ... } }
  const departments = [...new Set(heatmap.map(h => h.department))].sort();
  const heatmapByDept = {};
  heatmap.forEach(row => {
    if (!heatmapByDept[row.department]) heatmapByDept[row.department] = {};
    const completedGoals = parseInt(row.completed || 0);
    const totalEmployees = parseInt(row.total_employees || 1);
    heatmapByDept[row.department][row.quarter] =
      totalEmployees > 0 ? Math.round((completedGoals / totalEmployees) * 100) : null;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-muted text-sm mt-0.5">Active cycle: <strong>{cycle.name}</strong></p>
        </div>
        {activeEscalations > 0 && (
          <Link to="/admin/escalations" className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-danger-100 transition-colors">
            <ExclamationTriangleIcon className="w-4 h-4" />
            {activeEscalations} Active Escalation{activeEscalations > 1 ? 's' : ''}
          </Link>
        )}
      </div>

      {/* KPI rings */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-6 flex flex-col items-center">
          <ProgressRing value={submittedPct} size={100} color="#4F46E5" />
          <div className="mt-4 text-center">
            <p className="font-semibold text-slate-800">Goals Submitted</p>
            <p className="text-xs text-muted mt-0.5">{submitted} of {employees} employees</p>
          </div>
        </div>
        <div className="card p-6 flex flex-col items-center">
          <ProgressRing value={approvedPct} size={100} color="#10B981" />
          <div className="mt-4 text-center">
            <p className="font-semibold text-slate-800">Goals Approved</p>
            <p className="text-xs text-muted mt-0.5">{approved} of {employees} employees</p>
          </div>
        </div>
        <div className="card p-6 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-danger-50 border-4 border-danger-200">
            <span className="font-mono font-bold text-2xl text-danger-700">{activeEscalations}</span>
          </div>
          <div className="mt-4 text-center">
            <p className="font-semibold text-slate-800">Active Escalations</p>
            <p className="text-xs text-muted mt-0.5">
              {activeEscalations === 0 ? 'All clear ✓' : 'Requires attention'}
            </p>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      {departments.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-slate-800">Department Check-in Completion Heatmap</h2>
          </div>
          <div className="card-body overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 min-w-[400px]">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-muted pb-2 pr-4">Department</th>
                  {QUARTERS.map(q => (
                    <th key={q} className="text-center text-xs font-semibold text-muted pb-2 w-20">{q}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map(dept => (
                  <tr key={dept}>
                    <td className="text-sm font-medium text-slate-700 pr-4 py-1 whitespace-nowrap">{dept}</td>
                    {QUARTERS.map(q => (
                      <HeatmapCell key={q} pct={heatmapByDept[dept]?.[q] ?? null} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <span className="text-xs text-muted">Legend:</span>
              {[
                { color: 'bg-success-500', label: '≥ 80%' },
                { color: 'bg-warning-500', label: '50–79%' },
                { color: 'bg-danger-500',  label: '< 50%' },
                { color: 'bg-slate-100',   label: 'No data' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${color}`} />
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/admin/cascade',     label: 'Cascade View',  desc: 'Org tree' },
          { to: '/admin/analytics',   label: 'Analytics',     desc: 'Charts & trends' },
          { to: '/admin/reports',     label: 'Reports',       desc: 'Export data' },
          { to: '/admin/escalations', label: 'Escalations',   desc: `${activeEscalations} active` },
        ].map(({ to, label, desc }) => (
          <Link key={to} to={to} className="card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
            <p className="font-semibold text-slate-800 text-sm">{label}</p>
            <p className="text-xs text-muted mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
