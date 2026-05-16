import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const changeTypeColors = {
  CREATE: 'bg-success-50 text-success-700',
  EDIT:   'bg-primary-50 text-primary-700',
  APPROVE: 'bg-success-50 text-success-700',
  RETURN:  'bg-warning-50 text-warning-700',
  DELETE:  'bg-danger-50 text-danger-700',
  UNLOCK:  'bg-orange-50 text-orange-700',
  SUBMIT:  'bg-blue-50 text-blue-700',
};

function JsonDiff({ oldVal, newVal }) {
  if (!oldVal && !newVal) return null;

  const format = (v) => {
    try { return JSON.stringify(v, null, 2); }
    catch { return String(v); }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {oldVal && (
        <div>
          <p className="text-xs font-semibold text-danger-600 mb-1">Before</p>
          <pre className="bg-danger-50 border border-danger-100 rounded-lg p-3 text-xs text-danger-800 overflow-x-auto font-mono whitespace-pre-wrap">
            {format(oldVal)}
          </pre>
        </div>
      )}
      {newVal && (
        <div>
          <p className="text-xs font-semibold text-success-600 mb-1">After</p>
          <pre className="bg-success-50 border border-success-100 rounded-lg p-3 text-xs text-success-800 overflow-x-auto font-mono whitespace-pre-wrap">
            {format(newVal)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditTrail() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filters, setFilters] = useState({ entity_type: '', from_date: '', to_date: '' });
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) };
      const res = await api.get('/admin/audit-logs', { params });
      setLogs(res.data.data);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/users').then(res => setUsers(res.data)).catch(() => {});
  }, []);

  const toggleRow = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Audit Trail</h1>
        <p className="text-muted text-sm mt-0.5">{total.toLocaleString()} total log entries</p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Entity Type</label>
            <select
              value={filters.entity_type}
              onChange={e => setFilters(f => ({ ...f, entity_type: e.target.value }))}
              className="input"
            >
              <option value="">All Types</option>
              {['goal', 'achievement', 'cycle'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From Date</label>
            <input type="date" value={filters.from_date} onChange={e => setFilters(f => ({...f, from_date: e.target.value}))} className="input" />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" value={filters.to_date} onChange={e => setFilters(f => ({...f, to_date: e.target.value}))} className="input" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilters({ entity_type: '', from_date: '', to_date: '' }); setPage(1); }} className="btn-secondary w-full">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : logs.length === 0 ? (
        <div className="card">
          <EmptyState icon="document" title="No audit logs" description="Audit entries will appear here as actions are taken in the system." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 32 }} />
                  <th>Who</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="cursor-pointer hover:bg-primary-50/30"
                      onClick={() => toggleRow(log.id)}
                    >
                      <td className="text-muted">
                        {expanded[log.id]
                          ? <ChevronDownIcon className="w-4 h-4" />
                          : <ChevronRightIcon className="w-4 h-4" />
                        }
                      </td>
                      <td>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{log.changed_by_name || 'System'}</p>
                          <p className="text-xs text-muted">{log.changed_by_email}</p>
                        </div>
                      </td>
                      <td>
                        <span className={`badge text-xs ${changeTypeColors[log.change_type] || 'badge-draft'}`}>
                          {log.change_type}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className="text-xs font-semibold text-slate-600 uppercase">{log.entity_type}</span>
                          <p className="text-xs text-muted font-mono truncate max-w-[120px]" title={log.entity_id}>
                            {log.entity_id?.slice(0, 8)}...
                          </p>
                        </div>
                      </td>
                      <td className="text-xs text-muted">
                        {new Date(log.changed_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                    </tr>

                    {/* Expanded JSON diff */}
                    {expanded[log.id] && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-slate-50">
                          <p className="text-xs font-semibold text-muted mb-2">Change Details</p>
                          <JsonDiff oldVal={log.old_value} newVal={log.new_value} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted">Page {page} of {pages} · {total} entries</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary btn-sm"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="btn-secondary btn-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
