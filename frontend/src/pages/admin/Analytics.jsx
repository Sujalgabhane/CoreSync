import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import api from '../../api/axios';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';

// ─── Color palette ─────────────────────────────────────────────────────────
const DEPT_COLORS = ['#4F46E5','#10B981','#F59E0B','#F43F5E','#8B5CF6','#06B6D4','#EC4899'];
const UOM_COLORS  = { MIN: '#4F46E5', MAX: '#8B5CF6', TIMELINE: '#F59E0B', ZERO: '#10B981' };
const STATUS_COLORS = { APPROVED: '#10B981', SUBMITTED: '#4F46E5', RETURNED: '#F43F5E', DRAFT: '#94A3B8' };

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-xl shadow-modal px-4 py-3 text-sm">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="font-mono font-semibold text-slate-700">
            {typeof p.value === 'number' ? `${(p.value * 100).toFixed(1)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/analytics')
      .then(res => setAnalyticsData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;
  if (!analyticsData) return <div className="text-center py-20 text-muted">No analytics data available</div>;

  const { qoq, distribution, managerEffectiveness } = analyticsData;

  // ── QoQ: transform to { quarter: 'Q1', Dept1: 0.8, ... }
  const departments = [...new Set(qoq.map(r => r.department))];
  const qoqByQuarter = QUARTERS.map(q => {
    const entry = { quarter: q };
    qoq.filter(r => r.quarter === q).forEach(r => {
      entry[r.department] = parseFloat(r.avg_score || 0);
    });
    return entry;
  });

  // ── Distribution donuts
  const byUom = ['MIN','MAX','TIMELINE','ZERO'].map(uom => ({
    name: uom,
    value: distribution.filter(d => d.uom_type === uom).reduce((s, r) => s + parseInt(r.count), 0),
  })).filter(d => d.value > 0);

  const byStatus = ['APPROVED','SUBMITTED','RETURNED','DRAFT'].map(s => ({
    name: s,
    value: distribution.filter(d => d.status === s).reduce((sum, r) => sum + parseInt(r.count), 0),
    color: STATUS_COLORS[s],
  })).filter(d => d.value > 0);

  // ── Thrust area distribution
  const thrustAreas = {};
  distribution.forEach(d => {
    thrustAreas[d.thrust_area] = (thrustAreas[d.thrust_area] || 0) + parseInt(d.count);
  });
  const byThrust = Object.entries(thrustAreas)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ── Manager effectiveness
  const managers = [...new Set(managerEffectiveness.map(r => r.manager_name))];
  const mgrByQuarter = managers.map(mgr => {
    const entry = { manager: mgr.split(' ')[0] };
    QUARTERS.forEach(q => {
      const row = managerEffectiveness.find(r => r.manager_name === mgr && r.quarter === q);
      if (row) {
        const pct = row.team_size > 0 ? (row.completed_checkins / row.team_size) : 0;
        entry[q] = Math.min(pct, 1);
        entry[`${q}_low`] = pct < 0.6;
      }
    });
    return entry;
  });

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="text-muted text-sm mt-0.5">Goal progress trends, distributions, and team effectiveness</p>
      </div>

      {/* Row 1: QoQ Trend */}
      <ChartCard
        title="QoQ Achievement Trend"
        subtitle="Average progress score per department across quarters"
      >
        {qoq.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted text-sm">
            Check-in data will appear here after Q1 closes
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={qoqByQuarter} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, 1]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {departments.map((dept, i) => (
                <Line
                  key={dept}
                  type="monotone"
                  dataKey={dept}
                  name={dept}
                  stroke={DEPT_COLORS[i % DEPT_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: 'white' }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 2: Distribution donuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Goals by UoM Type" subtitle="Unit of Measure distribution">
          <div className="flex items-center justify-center">
            <PieChart width={220} height={200}>
              <Pie data={byUom} cx={110} cy={100} innerRadius={55} outerRadius={90}
                dataKey="value" labelLine={false} label={renderCustomLabel}>
                {byUom.map(entry => (
                  <Cell key={entry.name} fill={UOM_COLORS[entry.name] || '#CBD5E1'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
            {byUom.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: UOM_COLORS[d.name] }} />
                <span className="text-xs text-muted">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Goals by Status" subtitle="Current approval status">
          <div className="flex items-center justify-center">
            <PieChart width={220} height={200}>
              <Pie data={byStatus} cx={110} cy={100} innerRadius={55} outerRadius={90}
                dataKey="value" labelLine={false} label={renderCustomLabel}>
                {byStatus.map(entry => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
            {byStatus.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-muted">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Goals by Thrust Area" subtitle="Top 8 focus areas">
          <div className="space-y-2">
            {byThrust.map((t, i) => (
              <div key={t.name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-600 truncate max-w-[160px]" title={t.name}>{t.name}</span>
                  <span className="font-mono text-slate-700 font-semibold ml-2">{t.value}</span>
                </div>
                <div className="progress-bar h-1.5">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(t.value / byThrust[0].value) * 100}%`,
                      background: DEPT_COLORS[i % DEPT_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Manager Effectiveness */}
      <ChartCard
        title="Manager Check-in Effectiveness"
        subtitle="% of team with completed check-ins per quarter (amber = <60%)"
      >
        {mgrByQuarter.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted text-sm">
            Manager effectiveness data appears after check-in windows open
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mgrByQuarter} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="manager" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tickFormatter={v => `${Math.round(v * 100)}%`} domain={[0, 1]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {QUARTERS.map((q, i) => (
                <Bar
                  key={q}
                  dataKey={q}
                  name={q}
                  fill={DEPT_COLORS[i]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
