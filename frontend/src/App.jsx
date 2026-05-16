import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

// ── Page imports ─────────────────────────────────────────────────────────
import Login             from './pages/Login';

// Employee
import EmployeeDashboard from './pages/employee/Dashboard';
import GoalSheet         from './pages/employee/GoalSheet';
import CheckIn           from './pages/employee/CheckIn';

// Manager
import ManagerApprovals  from './pages/manager/Approvals';
import TeamDashboard     from './pages/manager/TeamDashboard';
import ManagerCheckIns   from './pages/manager/CheckIns';

// Admin
import AdminDashboard    from './pages/admin/Dashboard';
import CascadeView       from './pages/admin/Cascade';
import AdminReports      from './pages/admin/Reports';
import AuditTrail        from './pages/admin/Audit';
import AdminCycles       from './pages/admin/Cycles';
import Escalations       from './pages/admin/Escalations';
import Analytics         from './pages/admin/Analytics';

// ── Auth guards ───────────────────────────────────────────────────────────

function RequireAuth({ allowedRoles }) {
  const { user, accessToken } = useAuthStore();

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the correct dashboard for the user's role
    const roleRoutes = {
      admin:    '/admin/dashboard',
      manager:  '/manager/approvals',
      employee: '/dashboard',
    };
    return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </Layout>
  );
}

function RedirectIfAuth() {
  const { user } = useAuthStore();
  if (user) {
    const roleRoutes = { admin: '/admin/dashboard', manager: '/manager/approvals', employee: '/dashboard' };
    return <Navigate to={roleRoutes[user.role] || '/dashboard'} replace />;
  }
  return <Outlet />;
}

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          },
          success: {
            iconTheme: { primary: '#10B981', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: '#F43F5E', secondary: 'white' },
          },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route element={<RedirectIfAuth />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Employee routes */}
        <Route element={<RequireAuth allowedRoles={['employee']} />}>
          <Route path="/dashboard" element={<EmployeeDashboard />} />
          <Route path="/goals"     element={<GoalSheet />} />
          <Route path="/goals/:id/checkin" element={<CheckIn />} />
        </Route>

        {/* Manager routes */}
        <Route element={<RequireAuth allowedRoles={['manager']} />}>
          <Route path="/manager/approvals" element={<ManagerApprovals />} />
          <Route path="/manager/team"      element={<TeamDashboard />} />
          <Route path="/manager/checkins"  element={<ManagerCheckIns />} />
        </Route>

        {/* Admin routes */}
        <Route element={<RequireAuth allowedRoles={['admin']} />}>
          <Route path="/admin/dashboard"   element={<AdminDashboard />} />
          <Route path="/admin/cascade"     element={<CascadeView />} />
          <Route path="/admin/analytics"   element={<Analytics />} />
          <Route path="/admin/reports"     element={<AdminReports />} />
          <Route path="/admin/cycles"      element={<AdminCycles />} />
          <Route path="/admin/escalations" element={<Escalations />} />
          <Route path="/admin/audit"       element={<AuditTrail />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
