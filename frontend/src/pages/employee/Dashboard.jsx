import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import useAuthStore from '../../stores/authStore';
import useCycleStore from '../../stores/cycleStore';
import { PhaseBadge, StatusBadge } from '../../components/ui/Badge';
import WeightageBar from '../../components/ui/WeightageBar';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import { FlagIcon, CheckCircleIcon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { cycle, currentPhase } = useCycleStore();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <SkeletonDashboard />;

  const totalWeightage = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);
  const statusCounts = {
    APPROVED:  goals.filter(g => g.status === 'APPROVED').length,
    SUBMITTED: goals.filter(g => g.status === 'SUBMITTED').length,
    RETURNED:  goals.filter(g => g.status === 'RETURNED').length,
    DRAFT:     goals.filter(g => g.status === 'DRAFT').length,
  };
  const canSubmit = goals.filter(g => ['DRAFT','RETURNED'].includes(g.status)).length > 0
    && Math.abs(totalWeightage - 100) < 0.01;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-muted text-sm mt-0.5">Here's your goal overview for {cycle?.name || 'the current cycle'}</p>
        </div>
        <div className="flex items-center gap-3">
          {currentPhase && <PhaseBadge phase={currentPhase} />}
          <Link to="/goals" className="btn-primary">
            <FlagIcon className="w-4 h-4" />
            Manage Goals
          </Link>
        </div>
      </div>

      {/* Cycle info */}
      {cycle && (
        <div className="card p-5 bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">Active Cycle</p>
              <p className="text-lg font-bold text-primary-800 mt-0.5">{cycle.name}</p>
            </div>
            {cycle.phase1_open && (
              <p className="text-xs text-muted">Goal setting opened {new Date(cycle.phase1_open).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            )}
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Approved',  value: statusCounts.APPROVED,  icon: CheckCircleIcon,         color: 'text-success-600 bg-success-50' },
          { label: 'Submitted', value: statusCounts.SUBMITTED, icon: ClockIcon,               color: 'text-primary-600 bg-primary-50' },
          { label: 'Returned',  value: statusCounts.RETURNED,  icon: ExclamationCircleIcon,   color: 'text-danger-600 bg-danger-50' },
          { label: 'Draft',     value: statusCounts.DRAFT,     icon: FlagIcon,                color: 'text-slate-600 bg-slate-100' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="font-mono text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-muted mt-0.5">{label} Goals</p>
          </div>
        ))}
      </div>

      {/* Weightage bar */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Goal Sheet Health</h2>
          <span className="text-sm text-muted">{goals.length} of 8 goals</span>
        </div>
        <WeightageBar total={totalWeightage} />

        {/* Goal count bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Goals created</span>
            <span className="font-mono">{goals.length} / 8</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill bg-primary-400"
              style={{ width: `${(goals.length / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recent goals preview */}
      {goals.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Recent Goals</h2>
            <Link to="/goals" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {goals.slice(0, 4).map(goal => (
              <div key={goal.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{goal.title}</p>
                  <p className="text-xs text-muted mt-0.5">{goal.thrust_area}</p>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className="font-mono text-sm font-medium text-slate-700">{goal.weightage}%</span>
                  <StatusBadge status={goal.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA if no goals */}
      {goals.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FlagIcon className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No goals yet</h3>
          <p className="text-muted text-sm mb-6">Start by creating your goals for this cycle. You need at least 1 goal with a total weightage of 100%.</p>
          <Link to="/goals" className="btn-primary">
            Create My First Goal
          </Link>
        </div>
      )}
    </div>
  );
}
