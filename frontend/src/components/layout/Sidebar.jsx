import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import {
  HomeIcon,
  FlagIcon,
  CheckCircleIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  CogIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const navConfig = {
  employee: [
    { to: '/dashboard',    icon: HomeIcon,                    label: 'Dashboard' },
    { to: '/goals',        icon: FlagIcon,                    label: 'My Goals' },
  ],
  manager: [
    { to: '/manager/approvals',   icon: ClipboardDocumentListIcon, label: 'Approvals' },
    { to: '/manager/team',        icon: UsersIcon,                  label: 'Team Dashboard' },
    { to: '/manager/checkins',    icon: CheckCircleIcon,            label: 'Check-ins' },
  ],
  admin: [
    { to: '/admin/dashboard',    icon: HomeIcon,                    label: 'Dashboard' },
    { to: '/admin/cascade',      icon: BoltIcon,                    label: 'Cascade View' },
    { to: '/admin/analytics',    icon: ChartBarIcon,                label: 'Analytics' },
    { to: '/admin/reports',      icon: DocumentChartBarIcon,        label: 'Reports' },
    { to: '/admin/cycles',       icon: CogIcon,                     label: 'Cycles' },
    { to: '/admin/escalations',  icon: ExclamationTriangleIcon,     label: 'Escalations' },
    { to: '/admin/audit',        icon: ClockIcon,                   label: 'Audit Trail' },
  ],
};

export default function Sidebar({ collapsed, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const links = navConfig[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          bg-white border-r border-border shadow-lg
          transition-transform duration-300 ease-in-out
          w-64
          ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3" fill="white" />
              <path d="M9 2v2M9 14v2M2 9h2M14 9h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-slate-800 tracking-tight">CoreSync</span>
          )}
        </div>

        {/* Role label */}
        {!collapsed && user && (
          <div className="px-4 pt-4 pb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-widest">
              {user.role === 'employee' ? 'Employee' : user.role === 'manager' ? 'Manager' : 'Admin'}
            </span>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-3 space-y-1">
          {user && !collapsed && (
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-muted truncate">{user.email}</p>
              {user.department && (
                <p className="text-xs text-primary-600 font-medium mt-0.5">{user.department}</p>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-danger-600 hover:bg-danger-50 hover:text-danger-700"
            aria-label="Sign out"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
