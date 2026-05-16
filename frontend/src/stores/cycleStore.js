import { create } from 'zustand';
import api from '../api/axios';

const useCycleStore = create((set, get) => ({
  cycle: null,
  currentPhase: null,
  isLoading: false,
  error: null,

  fetchActiveCycle: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/admin/cycles');
      const cycles = res.data;
      const active = cycles.find(c => c.is_active) || null;
      const phase = active ? computeCurrentPhase(active) : null;
      set({ cycle: active, currentPhase: phase, isLoading: false });
      return active;
    } catch (err) {
      set({ error: 'Could not load cycle', isLoading: false });
      return null;
    }
  },

  getCycle: () => get().cycle,
  getPhase: () => get().currentPhase,
}));

/**
 * Determine the current phase label from the active cycle.
 */
function computeCurrentPhase(cycle) {
  const now = new Date();
  const dates = {
    Q4: cycle.q4_open ? new Date(cycle.q4_open) : null,
    Q3: cycle.q3_open ? new Date(cycle.q3_open) : null,
    Q2: cycle.q2_open ? new Date(cycle.q2_open) : null,
    Q1: cycle.q1_open ? new Date(cycle.q1_open) : null,
    'Goal Setting': cycle.phase1_open ? new Date(cycle.phase1_open) : null,
  };

  for (const [phase, date] of Object.entries(dates)) {
    if (date && now >= date) return phase;
  }
  return 'Upcoming';
}

export { computeCurrentPhase };
export default useCycleStore;
