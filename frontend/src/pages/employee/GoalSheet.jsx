import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { StatusBadge, UomBadge } from '../../components/ui/Badge';
import WeightageBar from '../../components/ui/WeightageBar';
import SlideOver from '../../components/ui/SlideOver';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/SkeletonLoader';
import { PlusIcon, TrashIcon, PencilIcon, LockClosedIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

const goalSchema = z.object({
  thrust_area: z.string().min(1, 'Thrust area is required').max(150),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  uom_type: z.enum(['MIN', 'MAX', 'TIMELINE', 'ZERO'], { required_error: 'Select a UoM type' }),
  target_value: z.string().optional(),
  target_date: z.string().optional(),
  weightage: z.number({ invalid_type_error: 'Enter a number' }).min(10, 'Minimum 10%').max(100, 'Maximum 100%'),
}).refine(d => d.uom_type === 'TIMELINE' ? !!d.target_date : !!d.target_value || d.uom_type === 'ZERO', {
  message: 'Target value or date is required',
  path: ['target_value'],
});

const UOM_OPTIONS = [
  { value: 'MIN', label: 'MIN — Higher is better (e.g. Revenue)' },
  { value: 'MAX', label: 'MAX — Lower is better (e.g. Response time)' },
  { value: 'TIMELINE', label: 'TIMELINE — Must be done by a date' },
  { value: 'ZERO', label: 'ZERO — Must be zero (e.g. Bugs)' },
];

export default function GoalSheet() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [weightages, setWeightages] = useState({});

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(goalSchema),
    defaultValues: { uom_type: 'MIN', weightage: 20 },
  });

  const uomType = watch('uom_type');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
      const w = {};
      res.data.forEach(g => { w[g.id] = g.weightage; });
      setWeightages(w);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalWeightage = Object.values(weightages).reduce((s, v) => s + parseFloat(v || 0), 0);
  const canSubmit = goals.filter(g => ['DRAFT', 'RETURNED'].includes(g.status)).length > 0
    && Math.abs(totalWeightage - 100) < 0.01;

  const openCreate = () => { setEditingGoal(null); reset({ uom_type: 'MIN', weightage: 20 }); setDrawerOpen(true); };
  const openEdit = (goal) => {
    setEditingGoal(goal);
    reset({
      thrust_area: goal.thrust_area,
      title: goal.title,
      description: goal.description || '',
      uom_type: goal.uom_type,
      target_value: goal.target_value?.toString() || '',
      target_date: goal.target_date || '',
      weightage: parseFloat(goal.weightage),
    });
    setDrawerOpen(true);
  };

  const onSave = async (data) => {
    try {
      const payload = {
        ...data,
        target_value: data.uom_type !== 'TIMELINE' && data.uom_type !== 'ZERO' ? parseFloat(data.target_value) : null,
        target_date: data.uom_type === 'TIMELINE' ? data.target_date : null,
      };

      if (editingGoal) {
        await api.patch(`/goals/${editingGoal.id}`, payload);
        toast.success('Goal updated');
      } else {
        await api.post('/goals', payload);
        toast.success('Goal created');
      }
      setDrawerOpen(false);
      load();
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        toast.error(errors.map(e => e.message).join(', '));
      } else {
        toast.error(err.response?.data?.error || 'Failed to save goal');
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/goals/${deleteTarget.id}`);
      toast.success('Goal deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete goal');
    }
  };

  const handleSubmitGoals = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/goals/submit');
      toast.success(res.data.message);
      setSubmitDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const updateWeightage = (id, val) => {
    setWeightages(w => ({ ...w, [id]: parseFloat(val) || 0 }));
  };

  const saveWeightage = async (goal, newVal) => {
    try {
      await api.patch(`/goals/${goal.id}`, { ...goal, weightage: parseFloat(newVal) });
      toast.success('Weightage updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  if (loading) return <SkeletonTable rows={5} cols={6} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Goal Sheet</h1>
          <p className="text-muted text-sm mt-0.5">{goals.length} of 8 goals · Total weightage: <span className="font-mono font-semibold">{totalWeightage.toFixed(0)}%</span></p>
        </div>
        <div className="flex gap-3">
          {goals.some(g => ['DRAFT','RETURNED'].includes(g.status)) && (
            <button
              onClick={() => setSubmitDialog(true)}
              disabled={!canSubmit}
              title={!canSubmit ? 'Weightage must total exactly 100% to submit' : ''}
              className="btn-primary"
              id="submit-goals-btn"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
              Submit for Approval
            </button>
          )}
          {goals.length < 8 && (
            <button onClick={openCreate} className="btn-secondary" id="add-goal-btn">
              <PlusIcon className="w-4 h-4" />
              Add Goal
            </button>
          )}
        </div>
      </div>

      {/* Weightage bar */}
      <WeightageBar total={totalWeightage} />

      {/* Goals table */}
      {goals.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="goals"
            title="No goals yet"
            description="Add your first goal for this cycle. You need 1–8 goals with a total weightage of exactly 100%."
            action={openCreate}
            actionLabel="Add First Goal"
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Thrust Area</th>
                  <th>Title</th>
                  <th>UoM</th>
                  <th>Target</th>
                  <th>Weightage %</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {goals.map(goal => {
                  const isEditable = ['DRAFT', 'RETURNED'].includes(goal.status);
                  const isLocked = !!goal.locked_at;

                  return (
                    <tr key={goal.id}>
                      <td>
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                          {goal.thrust_area}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 min-w-0">
                          {goal.is_shared && (
                            <LockClosedIcon className="w-3.5 h-3.5 text-muted flex-shrink-0" title="Shared goal — title locked" />
                          )}
                          <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                            {goal.title}
                          </span>
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
                        {isEditable ? (
                          <input
                            type="number"
                            min={10}
                            max={100}
                            value={weightages[goal.id] ?? goal.weightage}
                            onChange={e => updateWeightage(goal.id, e.target.value)}
                            onBlur={e => saveWeightage(goal, e.target.value)}
                            className="input w-20 py-1 text-sm font-mono"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-slate-700">{goal.weightage}%</span>
                        )}
                      </td>
                      <td><StatusBadge status={goal.status} /></td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          {goal.status === 'APPROVED' && (
                            <button
                              onClick={() => navigate(`/goals/${goal.id}/checkin`)}
                              className="btn-sm btn-secondary text-success-700 border-success-200 hover:bg-success-50"
                            >
                              Check-in
                            </button>
                          )}
                          {isEditable && (
                            <>
                              <button
                                onClick={() => openEdit(goal)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label={`Edit ${goal.title}`}
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(goal)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                                aria-label={`Delete ${goal.title}`}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit goal slide-over */}
      <SlideOver
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingGoal ? 'Edit Goal' : 'Add New Goal'}
      >
        <form onSubmit={handleSubmit(onSave)} className="space-y-5">
          <div>
            <label className="label">Thrust Area *</label>
            <input
              {...register('thrust_area')}
              className={`input ${errors.thrust_area ? 'input-error' : ''}`}
              placeholder="e.g. Product Development"
              disabled={editingGoal?.is_shared}
            />
            {errors.thrust_area && <p className="error-text">{errors.thrust_area.message}</p>}
          </div>

          <div>
            <label className="label">
              Goal Title *
              {editingGoal?.is_shared && <span className="ml-2 text-xs text-muted">(shared — read only)</span>}
            </label>
            <input
              {...register('title')}
              className={`input ${errors.title ? 'input-error' : ''} ${editingGoal?.is_shared ? 'bg-slate-50' : ''}`}
              placeholder="What do you want to achieve?"
              disabled={editingGoal?.is_shared}
            />
            {errors.title && <p className="error-text">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              className="input h-20 resize-none"
              placeholder="Additional context (optional)"
            />
          </div>

          <div>
            <label className="label">Unit of Measure *</label>
            <select
              {...register('uom_type')}
              className={`input ${errors.uom_type ? 'input-error' : ''}`}
              disabled={editingGoal?.is_shared}
            >
              {UOM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.uom_type && <p className="error-text">{errors.uom_type.message}</p>}
          </div>

          {uomType === 'TIMELINE' ? (
            <div>
              <label className="label">Target Date *</label>
              <input type="date" {...register('target_date')} className={`input ${errors.target_date ? 'input-error' : ''}`} disabled={editingGoal?.is_shared} />
              {errors.target_date && <p className="error-text">{errors.target_date.message}</p>}
            </div>
          ) : uomType !== 'ZERO' ? (
            <div>
              <label className="label">Target Value *</label>
              <input
                type="number"
                step="any"
                {...register('target_value')}
                className={`input ${errors.target_value ? 'input-error' : ''}`}
                placeholder="e.g. 100"
                disabled={editingGoal?.is_shared}
              />
              {errors.target_value && <p className="error-text">{errors.target_value.message}</p>}
            </div>
          ) : (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-700">
              <strong>ZERO type:</strong> The goal score is 1.0 if actual = 0, otherwise 0.0
            </div>
          )}

          <div>
            <label className="label">Weightage % * <span className="text-muted font-normal">(min 10%)</span></label>
            <input
              type="number"
              min={10}
              max={100}
              {...register('weightage', { valueAsNumber: true })}
              className={`input ${errors.weightage ? 'input-error' : ''}`}
              placeholder="20"
            />
            {errors.weightage && <p className="error-text">{errors.weightage.message}</p>}
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button type="button" onClick={() => setDrawerOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Saving...' : editingGoal ? 'Update Goal' : 'Add Goal'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this goal?"
        description={`"${deleteTarget?.title}" will be permanently removed.`}
        confirmLabel="Delete Goal"
      />

      {/* Submit confirm */}
      <ConfirmDialog
        isOpen={submitDialog}
        onClose={() => setSubmitDialog(false)}
        onConfirm={handleSubmitGoals}
        title="Submit goals for approval?"
        description="Once submitted, your goals will be sent to your manager for review. You cannot edit them until they are returned."
        confirmLabel="Submit Goals"
        confirmVariant="primary"
        isLoading={submitting}
      />
    </div>
  );
}
