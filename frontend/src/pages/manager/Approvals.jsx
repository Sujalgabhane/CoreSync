import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { StatusBadge, UomBadge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

export default function ManagerApprovals() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [returnDialog, setReturnDialog] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/approvals/pending');
      setGroups(res.data);
      // Auto-expand first group
      if (res.data.length > 0) {
        setExpanded({ [res.data[0].employee_id]: true });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEmployee = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const approveGoal = async (goalId, employeeId) => {
    setProcessing(goalId);
    try {
      await api.patch(`/approvals/${goalId}/approve`);
      toast.success('Goal approved ✓');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    } finally {
      setProcessing(null);
    }
  };

  const approveAll = async (goals) => {
    setProcessing('all');
    try {
      await Promise.all(goals.map(g => api.patch(`/approvals/${g.id}/approve`)));
      toast.success(`${goals.length} goals approved`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    } finally {
      setProcessing(null);
    }
  };

  const returnGoal = async () => {
    if (!returnDialog || returnReason.trim().length < 5) {
      toast.error('Please enter a reason (min 5 characters)');
      return;
    }
    setProcessing(returnDialog.id);
    try {
      await api.patch(`/approvals/${returnDialog.id}/return`, { reason: returnReason });
      toast.success('Goal returned for rework');
      setReturnDialog(null);
      setReturnReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Return failed');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return (
    <div className="space-y-4">
      {[1,2].map(i => <SkeletonCard key={i} lines={5} />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pending Approvals</h1>
        <p className="text-muted text-sm mt-0.5">
          {groups.reduce((s, g) => s + g.goals.length, 0)} goals from {groups.length} team members awaiting review
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="goals"
            title="All caught up!"
            description="No pending goal submissions from your team. Check back after the next submission window."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.employee_id} className="card overflow-hidden">
              {/* Employee header */}
              <button
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                onClick={() => toggleEmployee(group.employee_id)}
                aria-expanded={!!expanded[group.employee_id]}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                    {group.employee_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">{group.employee_name}</p>
                    <p className="text-xs text-muted">{group.employee_email} · {group.department}</p>
                  </div>
                  <span className="ml-2 badge badge-submitted">{group.goals.length} goals pending</span>
                </div>
                <div className="flex items-center gap-3">
                  {expanded[group.employee_id] && (
                    <button
                      onClick={e => { e.stopPropagation(); approveAll(group.goals); }}
                      disabled={processing === 'all'}
                      className="btn-primary btn-sm"
                      id={`approve-all-${group.employee_id}`}
                    >
                      <CheckIcon className="w-3.5 h-3.5" />
                      Approve All
                    </button>
                  )}
                  {expanded[group.employee_id]
                    ? <ChevronDownIcon className="w-5 h-5 text-muted" />
                    : <ChevronRightIcon className="w-5 h-5 text-muted" />
                  }
                </div>
              </button>

              {/* Goals table */}
              {expanded[group.employee_id] && (
                <div className="border-t border-border">
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Thrust Area</th>
                          <th>Goal Title</th>
                          <th>UoM</th>
                          <th>Target</th>
                          <th>Weightage</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.goals.map(goal => (
                          <tr key={goal.id}>
                            <td>
                              <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                                {goal.thrust_area}
                              </span>
                            </td>
                            <td>
                              <div>
                                <p className="text-sm font-medium text-slate-800 max-w-[220px] truncate">{goal.title}</p>
                                {goal.description && (
                                  <p className="text-xs text-muted truncate max-w-[220px]">{goal.description}</p>
                                )}
                              </div>
                            </td>
                            <td><UomBadge type={goal.uom_type} /></td>
                            <td className="font-mono text-sm">
                              {goal.uom_type === 'TIMELINE'
                                ? goal.target_date ? new Date(goal.target_date).toLocaleDateString('en-IN') : '-'
                                : goal.target_value ?? '-'
                              }
                            </td>
                            <td>
                              <span className="font-mono font-semibold text-slate-700">{goal.weightage}%</span>
                            </td>
                            <td><StatusBadge status={goal.status} /></td>
                            <td>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => approveGoal(goal.id, group.employee_id)}
                                  disabled={processing === goal.id}
                                  className="btn-sm bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 font-medium"
                                >
                                  <CheckIcon className="w-3.5 h-3.5" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => { setReturnDialog(goal); setReturnReason(''); }}
                                  className="btn-sm bg-danger-50 text-danger-700 border border-danger-200 hover:bg-danger-100 font-medium"
                                >
                                  <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                  Return
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Weightage total for this employee */}
                  <div className="px-6 py-3 bg-slate-50 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted">Total weightage</span>
                    <span className={`font-mono font-bold text-sm ${
                      Math.abs(group.goals.reduce((s,g) => s + parseFloat(g.weightage), 0) - 100) < 0.01
                        ? 'text-success-700' : 'text-danger-600'
                    }`}>
                      {group.goals.reduce((s,g) => s + parseFloat(g.weightage), 0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Return dialog */}
      <ConfirmDialog
        isOpen={!!returnDialog}
        onClose={() => setReturnDialog(null)}
        onConfirm={returnGoal}
        title="Return goal for rework?"
        confirmLabel="Return Goal"
        isLoading={!!processing}
      >
        <p className="text-sm text-slate-700 mb-3">
          Returning: <strong>{returnDialog?.title}</strong>
        </p>
        <label className="label">Reason for returning *</label>
        <textarea
          value={returnReason}
          onChange={e => setReturnReason(e.target.value)}
          className="input h-24 resize-none"
          placeholder="Explain what needs to be changed..."
          autoFocus
        />
        {returnReason.length > 0 && returnReason.length < 5 && (
          <p className="error-text">Must be at least 5 characters</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
