import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

const typeConfig = {
  GOAL_NOT_SUBMITTED: { label: 'Goal Not Submitted', className: 'badge bg-warning-100 text-warning-800' },
  GOAL_NOT_APPROVED:  { label: 'Goal Not Approved',  className: 'badge bg-primary-100 text-primary-800' },
  CHECKIN_OVERDUE:    { label: 'Check-in Overdue',   className: 'badge badge-returned' },
};

export default function Escalations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('false'); // 'false' = unresolved only
  const [resolving, setResolving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/escalations', { params: { resolved: filter } });
      setData(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id) {
    setResolving(id);
    try {
      await api.patch(`/admin/escalations/${id}/resolve`);
      toast.success('Escalation marked resolved');
      load();
    } catch {
      toast.error('Failed to resolve');
    } finally {
      setResolving(null);
    }
  }

  const unresolvedCount = data.filter(d => !d.resolved_at).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Escalation Log</h1>
          <p className="text-muted text-sm mt-0.5">
            {unresolvedCount > 0
              ? <span className="text-danger-600 font-semibold">{unresolvedCount} unresolved escalation{unresolvedCount > 1 ? 's' : ''}</span>
              : 'All escalations resolved ✓'
            }
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { value: 'false', label: 'Unresolved' },
            { value: 'true',  label: 'Resolved' },
            { value: '',      label: 'All' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                filter === opt.value ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-slate-600 border-border hover:border-primary-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="goals"
            title={filter === 'false' ? 'No active escalations' : 'No escalations found'}
            description={filter === 'false' ? 'Great! Everything is on track.' : 'Adjust filters to see more escalations.'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Triggered</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map(esc => {
                  const cfg = typeConfig[esc.type] || { label: esc.type, className: 'badge-draft' };
                  return (
                    <tr key={esc.id} className={!esc.resolved_at ? 'bg-danger-50/20' : ''}>
                      <td>
                        <div>
                          <p className="font-medium text-slate-800">{esc.user_name}</p>
                          <p className="text-xs text-muted">{esc.user_email}</p>
                        </div>
                      </td>
                      <td className="text-muted text-sm">{esc.department}</td>
                      <td><span className={cfg.className}>{cfg.label}</span></td>
                      <td className="text-xs text-muted">
                        {new Date(esc.triggered_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {[1, 2, 3].map(lvl => (
                            <div
                              key={lvl}
                              className={`w-5 h-5 rounded text-xs flex items-center justify-center font-bold ${
                                esc.notified_levels >= lvl
                                  ? 'bg-danger-500 text-white'
                                  : 'bg-slate-200 text-slate-400'
                              }`}
                            >
                              {lvl}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {esc.notified_levels === 1 ? 'Employee notified'
                            : esc.notified_levels === 2 ? 'Manager notified'
                            : 'HR/Admin notified'}
                        </p>
                      </td>
                      <td>
                        {esc.resolved_at ? (
                          <span className="badge badge-approved">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Resolved
                          </span>
                        ) : (
                          <span className="badge badge-returned">Active</span>
                        )}
                      </td>
                      <td className="text-right">
                        {!esc.resolved_at && (
                          <button
                            onClick={() => resolve(esc.id)}
                            disabled={resolving === esc.id}
                            className="btn-sm btn-secondary text-success-700 border-success-200 hover:bg-success-50"
                          >
                            {resolving === esc.id ? 'Saving...' : 'Mark Resolved'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
