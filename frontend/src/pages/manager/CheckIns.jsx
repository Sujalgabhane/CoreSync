import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import SlideOver from '../../components/ui/SlideOver';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const statusConfig = {
  COMPLETED: { label: 'Completed',  className: 'badge badge-approved' },
  PARTIAL:   { label: 'Partial',    className: 'badge badge-submitted' },
  PENDING:   { label: 'Pending',    className: 'badge bg-warning-50 text-warning-700' },
  OVERDUE:   { label: 'Overdue',    className: 'badge badge-returned' },
  NO_GOALS:  { label: 'No Goals',   className: 'badge badge-draft' },
};

export default function ManagerCheckIns() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQ, setActiveQ] = useState('Q2');
  const [commentPanel, setCommentPanel] = useState(null);
  const [goalAchievements, setGoalAchievements] = useState([]);
  const [comment, setComment] = useState('');
  const [savingComment, setSavingComment] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeQ]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get('/reports/completion', { params: { quarter: activeQ } });
      setData(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function openCommentPanel(member) {
    setCommentPanel(member);
    try {
      const achRes = await api.get('/reports/achievement', {
        params: { employee_id: member.id, quarter: activeQ }
      });
      setGoalAchievements(achRes.data);
    } catch {
      setGoalAchievements([]);
    }
  }

  async function saveComment(achievementId) {
    setSavingComment(achievementId);
    try {
      await api.patch(`/achievements/${achievementId}/comment`, { comment });
      toast.success('Comment saved');
      setComment('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save comment');
    } finally {
      setSavingComment(null);
    }
  }

  const completedCount = data.filter(d => d.completion_status === 'COMPLETED').length;
  const completionPct = data.length ? Math.round((completedCount / data.length) * 100) : 0;

  if (loading) return <SkeletonTable rows={6} cols={5} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Check-in Management</h1>
          <p className="text-muted text-sm mt-0.5">
            {completedCount} of {data.length} team members completed {activeQ} check-in
            <span className="ml-2 font-mono font-bold text-primary-600">({completionPct}%)</span>
          </p>
        </div>

        {/* Quarter selector */}
        <div className="flex gap-2">
          {QUARTERS.map(q => (
            <button
              key={q}
              onClick={() => setActiveQ(q)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeQ === q
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-border text-slate-600 hover:border-primary-300'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="card">
          <EmptyState icon="team" title="No team data" description="No employees found for this quarter." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Approved Goals</th>
                  <th>{activeQ} Check-ins Done</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map(member => {
                  const cfg = statusConfig[member.completion_status] || statusConfig.PENDING;
                  const pct = member.approved_goals > 0
                    ? Math.round((member.checkins_done / member.approved_goals) * 100)
                    : 0;

                  return (
                    <tr key={member.id} className={member.completion_status === 'PENDING' ? 'bg-warning-50/30' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                            {member.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                          </div>
                          <span className="font-medium text-slate-800">{member.name}</span>
                        </div>
                      </td>
                      <td className="text-muted text-sm">{member.department}</td>
                      <td className="font-mono font-semibold text-slate-700">{member.approved_goals}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-24 progress-bar">
                            <div
                              className={`progress-fill ${pct === 100 ? 'bg-success-500' : pct > 0 ? 'bg-primary-500' : 'bg-slate-300'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm text-slate-700">{member.checkins_done}/{member.approved_goals}</span>
                        </div>
                      </td>
                      <td><span className={cfg.className}>{cfg.label}</span></td>
                      <td className="text-right">
                        <button
                          onClick={() => openCommentPanel(member)}
                          className="btn-sm btn-secondary"
                        >
                          Add Comment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comment panel */}
      <SlideOver
        isOpen={!!commentPanel}
        onClose={() => { setCommentPanel(null); setGoalAchievements([]); }}
        title={commentPanel ? `${commentPanel.name} — ${activeQ} Check-ins` : ''}
      >
        {goalAchievements.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            No {activeQ} check-ins recorded yet for this employee.
          </div>
        ) : (
          <div className="space-y-6">
            {goalAchievements.map(ach => (
              <div key={ach.goal_id || ach.id} className="border border-border rounded-xl p-4">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-primary-600 mb-0.5">{ach.thrust_area}</p>
                  <p className="font-medium text-slate-800 text-sm">{ach.title}</p>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                  <div>
                    <p className="text-muted">Status</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{ach.progress_status || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted">Score</p>
                    <p className="font-mono font-bold text-primary-700 mt-0.5">
                      {ach.progress_score !== null && ach.progress_score !== undefined
                        ? `${(parseFloat(ach.progress_score) * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted">Actual</p>
                    <p className="font-mono font-semibold mt-0.5">{ach.actual_value ?? ach.actual_date ?? '—'}</p>
                  </div>
                </div>

                {ach.employee_notes && (
                  <div className="bg-slate-50 rounded-lg p-3 mb-3 text-xs text-slate-600">
                    <p className="font-semibold text-muted mb-1">Employee notes</p>
                    {ach.employee_notes}
                  </div>
                )}

                {ach.manager_comment ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
                    <p className="font-semibold mb-1">Your comment</p>
                    {ach.manager_comment}
                  </div>
                ) : null}

                {ach.id && (
                  <div>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      className="input h-16 resize-none text-sm"
                      placeholder="Add or update your comment..."
                    />
                    <button
                      onClick={() => saveComment(ach.id)}
                      disabled={!comment.trim() || savingComment === ach.id}
                      className="btn-primary btn-sm mt-2"
                    >
                      {savingComment === ach.id ? 'Saving...' : 'Save Comment'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
