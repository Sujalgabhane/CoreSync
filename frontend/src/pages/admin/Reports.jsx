import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import { MomentumBadge, UomBadge } from '../../components/ui/Badge';
import { ArrowDownTrayIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminReports() {
  const [data, setData] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ cycle_id: '', department: '', quarter: '', employee_id: '' });
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/admin/cycles'),
      api.get('/users', { params: { role: 'employee' } }),
    ]).then(([cyclesRes, empRes]) => {
      setCycles(cyclesRes.data);
      setEmployees(empRes.data);
      // Auto-select active cycle
      const active = cyclesRes.data.find(c => c.is_active);
      if (active) {
        setFilters(f => ({ ...f, cycle_id: active.id }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (filters.cycle_id) fetchReport();
  }, [filters]);

  async function fetchReport() {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/reports/achievement', { params });
      setData(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/reports/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coresync_report_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel report downloaded!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports & Export</h1>
          <p className="text-muted text-sm mt-0.5">{data.length} records matching current filters</p>
        </div>
        <button
          onClick={exportExcel}
          disabled={exporting || data.length === 0}
          className="btn-primary"
          id="export-excel-btn"
        >
          {exporting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75"/>
              </svg>
              Generating...
            </span>
          ) : (
            <>
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export to Excel
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="w-4 h-4 text-primary-600" />
          <h2 className="font-semibold text-slate-800">Filters</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Cycle</label>
            <select
              value={filters.cycle_id}
              onChange={e => setFilters(f => ({ ...f, cycle_id: e.target.value }))}
              className="input"
            >
              <option value="">All Cycles</option>
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.is_active ? ' (Active)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select
              value={filters.department}
              onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}
              className="input"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quarter</label>
            <select
              value={filters.quarter}
              onChange={e => setFilters(f => ({ ...f, quarter: e.target.value }))}
              className="input"
            >
              <option value="">All Quarters</option>
              {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Employee</label>
            <select
              value={filters.employee_id}
              onChange={e => setFilters(f => ({ ...f, employee_id: e.target.value }))}
              className="input"
            >
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Results table */}
      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState icon="document" title="No data" description="Adjust your filters to see achievement data." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Dept</th>
                  <th>Thrust Area</th>
                  <th>Goal</th>
                  <th>UoM</th>
                  <th>Target</th>
                  <th>Quarter</th>
                  <th>Actual</th>
                  <th>Score</th>
                  <th>Momentum</th>
                  <th>Weight</th>
                  <th>Manager</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const score = row.progress_score != null
                    ? parseFloat(row.progress_score) * 100
                    : null;
                  const scoreColor = score === null ? 'text-muted'
                    : score >= 80 ? 'text-success-700'
                    : score >= 50 ? 'text-warning-700'
                    : 'text-danger-700';

                  return (
                    <tr key={i}>
                      <td className="font-medium text-slate-800">{row.employee_name}</td>
                      <td className="text-muted">{row.department}</td>
                      <td>
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">
                          {row.thrust_area}
                        </span>
                      </td>
                      <td className="max-w-[160px]">
                        <p className="truncate font-medium" title={row.title}>{row.title}</p>
                      </td>
                      <td><UomBadge type={row.uom_type} /></td>
                      <td className="font-mono">
                        {row.uom_type === 'TIMELINE'
                          ? row.target_date ? new Date(row.target_date).toLocaleDateString('en-IN') : '—'
                          : row.target_value ?? '—'
                        }
                      </td>
                      <td className="font-mono font-semibold text-slate-600">{row.quarter || '—'}</td>
                      <td className="font-mono font-semibold">
                        {row.uom_type === 'TIMELINE'
                          ? row.actual_date ? new Date(row.actual_date).toLocaleDateString('en-IN') : '—'
                          : row.actual_value ?? '—'
                        }
                      </td>
                      <td>
                        <span className={`font-mono font-bold ${scoreColor}`}>
                          {score !== null ? `${score.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td><MomentumBadge flag={row.momentum_flag} /></td>
                      <td className="font-mono font-semibold text-slate-700">{row.weightage}%</td>
                      <td className="text-muted">{row.manager_name || '—'}</td>
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
