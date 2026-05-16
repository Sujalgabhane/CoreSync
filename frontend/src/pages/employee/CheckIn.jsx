import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { UomBadge, MomentumBadge } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// Client-side score computation (mirrors backend)
function computeScore(uomType, actualValue, targetValue, actualDate, targetDate) {
  switch (uomType) {
    case 'MIN':
      if (!targetValue || targetValue === 0) return 0;
      return Math.min(actualValue / targetValue, 1.5);
    case 'MAX':
      if (!actualValue || actualValue === 0) return 0;
      return Math.min(targetValue / actualValue, 1.5);
    case 'ZERO':
      return Number(actualValue) === 0 ? 1.0 : 0.0;
    case 'TIMELINE':
      if (!actualDate || !targetDate) return 0;
      const actual = new Date(actualDate);
      const target = new Date(targetDate);
      if (actual <= target) return 1.0;
      const daysLate = (actual - target) / (1000 * 60 * 60 * 24);
      return Math.max(0, 1 - daysLate / 30);
    default: return 0;
  }
}

export default function CheckIn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [achievements, setAchievements] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState('Q1');
  const [form, setForm] = useState({ actual_value: '', actual_date: '', progress_status: 'ON_TRACK', employee_notes: '' });
  const [saving, setSaving] = useState(false);
  const [previewScore, setPreviewScore] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [goalRes, achRes] = await Promise.all([
        api.get(`/goals/${id}`),
        api.get(`/achievements/${id}`),
      ]);
      setGoal(goalRes.data);
      const achMap = {};
      achRes.data.forEach(a => { achMap[a.quarter] = a; });
      setAchievements(achMap);

      // Pre-fill form if current quarter has data
      if (achMap[activeQ]) {
        const a = achMap[activeQ];
        setForm({
          actual_value: a.actual_value?.toString() || '',
          actual_date: a.actual_date || '',
          progress_status: a.progress_status || 'ON_TRACK',
          employee_notes: a.employee_notes || '',
        });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  // Live score preview
  useEffect(() => {
    if (!goal) return;
    const score = computeScore(
      goal.uom_type,
      parseFloat(form.actual_value) || null,
      parseFloat(goal.target_value) || null,
      form.actual_date || null,
      goal.target_date || null,
    );
    setPreviewScore(isNaN(score) ? null : score);
  }, [form, goal]);

  const switchQuarter = (q) => {
    setActiveQ(q);
    const a = achievements[q];
    if (a) {
      setForm({
        actual_value: a.actual_value?.toString() || '',
        actual_date: a.actual_date || '',
        progress_status: a.progress_status || 'ON_TRACK',
        employee_notes: a.employee_notes || '',
      });
    } else {
      setForm({ actual_value: '', actual_date: '', progress_status: 'ON_TRACK', employee_notes: '' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        goal_id: id,
        quarter: activeQ,
        actual_value: goal.uom_type !== 'TIMELINE' ? (parseFloat(form.actual_value) || null) : null,
        actual_date: goal.uom_type === 'TIMELINE' ? (form.actual_date || null) : null,
        progress_status: form.progress_status,
        employee_notes: form.employee_notes,
      };
      const res = await api.post('/achievements', payload);
      toast.success(`${activeQ} check-in saved! Score: ${(res.data.computed_score * 100).toFixed(1)}%`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save check-in');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={6} />
    </div>
  );

  if (!goal) return <div className="text-center py-12 text-muted">Goal not found</div>;

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate('/goals')} className="flex items-center gap-2 text-sm text-muted hover:text-slate-700 transition-colors">
        <ArrowLeftIcon className="w-4 h-4" />
        Back to My Goals
      </button>

      {/* Goal details */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">{goal.thrust_area}</p>
            <h1 className="text-xl font-bold text-slate-800">{goal.title}</h1>
            {goal.description && <p className="text-sm text-muted mt-2">{goal.description}</p>}
          </div>
          <UomBadge type={goal.uom_type} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
          <div>
            <p className="text-xs text-muted">Target</p>
            <p className="font-mono font-semibold text-slate-800 mt-0.5">
              {goal.uom_type === 'TIMELINE'
                ? goal.target_date ? new Date(goal.target_date).toLocaleDateString('en-IN') : '-'
                : goal.target_value ?? '-'
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Weightage</p>
            <p className="font-mono font-semibold text-slate-800 mt-0.5">{goal.weightage}%</p>
          </div>
          <div>
            <p className="text-xs text-muted">Cycle</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">{goal.cycle_name}</p>
          </div>
        </div>
      </div>

      {/* Quarter tabs */}
      <div className="flex gap-2">
        {QUARTERS.map(q => {
          const done = !!achievements[q]?.checkin_completed_at;
          return (
            <button
              key={q}
              onClick={() => switchQuarter(q)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                activeQ === q
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : done
                    ? 'bg-success-50 text-success-700 border-success-200'
                    : 'bg-white text-slate-600 border-border hover:border-primary-300'
              }`}
            >
              {q}
              {done && <span className="ml-1 text-xs">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Check-in form */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-5">{activeQ} Check-in</h2>

        {/* Previous quarter result */}
        {achievements[activeQ] && (
          <div className="bg-slate-50 rounded-lg p-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Previous entry</p>
              <p className="text-sm font-medium text-slate-700 mt-0.5">
                Score: <span className="font-mono font-bold text-primary-700">
                  {(parseFloat(achievements[activeQ].progress_score) * 100).toFixed(1)}%
                </span>
              </p>
            </div>
            <MomentumBadge flag={achievements[activeQ].momentum_flag} />
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Actual input */}
          {goal.uom_type === 'TIMELINE' ? (
            <div>
              <label className="label">Actual Completion Date</label>
              <input
                type="date"
                value={form.actual_date}
                onChange={e => setForm(f => ({ ...f, actual_date: e.target.value }))}
                className="input"
              />
            </div>
          ) : (
            <div>
              <label className="label">
                Actual Value
                <span className="ml-2 text-xs text-muted font-normal">
                  (Target: {goal.uom_type === 'ZERO' ? '0' : goal.target_value})
                </span>
              </label>
              <input
                type="number"
                step="any"
                value={form.actual_value}
                onChange={e => setForm(f => ({ ...f, actual_value: e.target.value }))}
                className="input"
                placeholder="Enter actual achievement"
              />
            </div>
          )}

          {/* Progress status */}
          <div>
            <label className="label">Progress Status *</label>
            <div className="grid grid-cols-3 gap-3">
              {['NOT_STARTED', 'ON_TRACK', 'COMPLETED'].map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, progress_status: status }))}
                  className={`py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.progress_status === status
                      ? status === 'COMPLETED' ? 'bg-success-600 text-white border-success-600'
                        : status === 'NOT_STARTED' ? 'bg-slate-600 text-white border-slate-600'
                        : 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-slate-600 border-border hover:border-slate-400'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-muted font-normal">(optional)</span></label>
            <textarea
              value={form.employee_notes}
              onChange={e => setForm(f => ({ ...f, employee_notes: e.target.value }))}
              className="input h-20 resize-none"
              placeholder="Any context about your progress this quarter..."
            />
          </div>

          {/* Live score preview */}
          {previewScore !== null && (form.actual_value || form.actual_date) && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary-600 mb-2">Score Preview</p>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="progress-bar">
                    <div
                      className="progress-fill bg-primary-500"
                      style={{ width: `${Math.min(previewScore * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="ml-4 font-mono font-bold text-primary-800 text-lg">
                  {(previewScore * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full py-3">
            {saving ? 'Saving...' : `Save ${activeQ} Check-in`}
          </button>
        </form>

        {/* Manager comment */}
        {achievements[activeQ]?.manager_comment && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Manager Comment</p>
            <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {achievements[activeQ].manager_comment}
            </p>
          </div>
        )}
      </div>

      {/* All quarters summary */}
      {Object.keys(achievements).length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4">All Quarters Summary</h2>
          <div className="space-y-3">
            {QUARTERS.filter(q => achievements[q]).map(q => {
              const a = achievements[q];
              const score = parseFloat(a.progress_score || 0) * 100;
              return (
                <div key={q} className="flex items-center gap-4">
                  <span className="font-mono text-xs font-bold text-slate-500 w-8">{q}</span>
                  <div className="flex-1">
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${score >= 80 ? 'bg-success-500' : score >= 50 ? 'bg-primary-500' : 'bg-warning-500'}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-700 w-14 text-right">{score.toFixed(1)}%</span>
                  <MomentumBadge flag={a.momentum_flag} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
