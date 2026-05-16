import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { MomentumBadge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { UserIcon, FlagIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function TeamDashboard() {
  const navigate = useNavigate();
  const [team, setTeam] = useState([]);
  const [teamGoals, setTeamGoals] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    try {
      const teamRes = await api.get('/users/team');
      setTeam(teamRes.data);

      // Fetch goals for each team member
      const goalsMap = {};
      await Promise.all(
        teamRes.data.map(async (member) => {
          try {
            const goalsRes = await api.get(`/goals?employee_id=${member.id}`);
            const achRes = await api.get('/reports/achievement', { params: { employee_id: member.id } });
            goalsMap[member.id] = { goals: goalsRes.data, achievements: achRes.data };
          } catch {
            goalsMap[member.id] = { goals: [], achievements: [] };
          }
        })
      );
      setTeamGoals(goalsMap);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1,2,3,4,5].map(i => <SkeletonCard key={i} lines={4} />)}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Team Dashboard</h1>
        <p className="text-muted text-sm mt-0.5">{team.length} direct reports</p>
      </div>

      {team.length === 0 ? (
        <div className="card">
          <EmptyState icon="team" title="No team members" description="You don't have any direct reports assigned yet." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.map(member => {
            const data = teamGoals[member.id] || { goals: [], achievements: [] };
            const approvedGoals = data.goals.filter(g => g.status === 'APPROVED');
            const latestAchs = data.achievements.filter(a => a.quarter === 'Q2' || a.quarter === 'Q1');
            const avgScore = latestAchs.length > 0
              ? latestAchs.reduce((s, a) => s + parseFloat(a.progress_score || 0), 0) / latestAchs.length
              : null;

            const hasDecelerating = data.achievements.some(a => a.momentum_flag === 'DECELERATING');
            const latestMomentum = data.achievements[data.achievements.length - 1]?.momentum_flag;
            const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

            return (
              <div
                key={member.id}
                className={`card p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
                  hasDecelerating ? 'border-warning-200 bg-warning-50/30' : ''
                }`}
                onClick={() => navigate(`/manager/team/${member.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/manager/team/${member.id}`)}
                aria-label={`View ${member.name}'s goals`}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    hasDecelerating ? 'bg-warning-100 text-warning-800' : 'bg-primary-100 text-primary-700'
                  }`}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{member.name}</p>
                    <p className="text-xs text-muted truncate">{member.department}</p>
                  </div>
                  {hasDecelerating && (
                    <span className="ml-auto badge bg-warning-100 text-warning-700 text-xs">⚠️</span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <FlagIcon className="w-3.5 h-3.5 text-muted" />
                      <span className="text-xs text-muted">Approved Goals</span>
                    </div>
                    <p className="font-mono font-bold text-lg text-slate-800">{approvedGoals.length}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ChartBarIcon className="w-3.5 h-3.5 text-muted" />
                      <span className="text-xs text-muted">Avg Progress</span>
                    </div>
                    <p className="font-mono font-bold text-lg text-slate-800">
                      {avgScore !== null ? `${(avgScore * 100).toFixed(0)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                {avgScore !== null && (
                  <div className="mb-3">
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${
                          avgScore >= 0.8 ? 'bg-success-500' :
                          avgScore >= 0.5 ? 'bg-primary-500' : 'bg-warning-500'
                        }`}
                        style={{ width: `${Math.min(avgScore * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Momentum */}
                {latestMomentum && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Latest momentum</span>
                    <MomentumBadge flag={latestMomentum} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
