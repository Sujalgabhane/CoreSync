import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import SlideOver from '../../components/ui/SlideOver';
import { PlusIcon, PencilIcon, CalendarIcon } from '@heroicons/react/24/outline';

const cycleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phase1_open: z.string().optional(),
  q1_open: z.string().optional(),
  q2_open: z.string().optional(),
  q3_open: z.string().optional(),
  q4_open: z.string().optional(),
});

function CycleField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="input pl-9"
        />
      </div>
    </div>
  );
}

export default function AdminCycles() {
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dates, setDates] = useState({ phase1_open: '', q1_open: '', q2_open: '', q3_open: '', q4_open: '' });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(cycleSchema),
  });

  async function load() {
    try {
      const res = await api.get('/admin/cycles');
      setCycles(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    reset({ name: '', is_active: false });
    setDates({ phase1_open: '', q1_open: '', q2_open: '', q3_open: '', q4_open: '' });
    setDrawerOpen(true);
  }

  function openEdit(cycle) {
    setEditing(cycle);
    reset({ name: cycle.name });
    setDates({
      phase1_open: cycle.phase1_open?.slice(0, 10) || '',
      q1_open:     cycle.q1_open?.slice(0, 10)     || '',
      q2_open:     cycle.q2_open?.slice(0, 10)     || '',
      q3_open:     cycle.q3_open?.slice(0, 10)     || '',
      q4_open:     cycle.q4_open?.slice(0, 10)     || '',
    });
    setDrawerOpen(true);
  }

  async function onSave(data) {
    const payload = { ...data, ...dates };
    try {
      if (editing) {
        await api.patch(`/admin/cycles/${editing.id}`, payload);
        toast.success('Cycle updated');
      } else {
        await api.post('/admin/cycles', { ...payload, is_active: false });
        toast.success('Cycle created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  }

  async function toggleActive(cycle) {
    try {
      await api.patch(`/admin/cycles/${cycle.id}`, { is_active: !cycle.is_active });
      toast.success(cycle.is_active ? 'Cycle deactivated' : 'Cycle set as active');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  }

  if (loading) return (
    <div className="space-y-4">
      {[1,2].map(i => <SkeletonCard key={i} lines={6} />)}
    </div>
  );

  const dateFields = [
    { key: 'phase1_open', label: 'Goal Setting Opens' },
    { key: 'q1_open',     label: 'Q1 Check-in Opens' },
    { key: 'q2_open',     label: 'Q2 Check-in Opens' },
    { key: 'q3_open',     label: 'Q3 Check-in Opens' },
    { key: 'q4_open',     label: 'Q4 Check-in Opens' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cycle Management</h1>
          <p className="text-muted text-sm mt-0.5">{cycles.length} cycle{cycles.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Cycle
        </button>
      </div>

      {cycles.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted">No cycles created yet. Create your first goal cycle to get started.</p>
          <button onClick={openCreate} className="btn-primary mt-4">Create Cycle</button>
        </div>
      ) : (
        <div className="space-y-4">
          {cycles.map(cycle => (
            <div key={cycle.id} className={`card ${cycle.is_active ? 'border-primary-300 ring-1 ring-primary-200' : ''}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-800">{cycle.name}</h2>
                    {cycle.is_active && (
                      <span className="badge badge-approved">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(cycle)}
                      className={`btn-sm ${cycle.is_active ? 'btn-secondary text-warning-700 border-warning-200' : 'btn-secondary text-success-700 border-success-200'}`}
                    >
                      {cycle.is_active ? 'Deactivate' : 'Set Active'}
                    </button>
                    <button onClick={() => openEdit(cycle)} className="btn-sm btn-secondary">
                      <PencilIcon className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {dateFields.map(({ key, label }) => (
                    <div key={key} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-muted mb-1">{label}</p>
                      <p className="text-sm font-semibold text-slate-700 font-mono">
                        {cycle[key]
                          ? new Date(cycle[key]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit drawer */}
      <SlideOver isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Cycle' : 'Create Goal Cycle'}>
        <form onSubmit={handleSubmit(onSave)} className="space-y-5">
          <div>
            <label className="label">Cycle Name *</label>
            <input {...register('name')} className={`input ${errors.name ? 'input-error' : ''}`} placeholder="e.g. FY 2025-26" />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Phase Dates</p>
            {dateFields.map(({ key, label }) => (
              <CycleField
                key={key}
                label={label}
                value={dates[key]}
                onChange={v => setDates(d => ({ ...d, [key]: v }))}
              />
            ))}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setDrawerOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Saving...' : editing ? 'Update Cycle' : 'Create Cycle'}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
