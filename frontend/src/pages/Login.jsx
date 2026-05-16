import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const demoCredentials = [
  { label: 'Admin',    email: 'admin@align.demo',    password: 'Admin@123',    role: 'admin' },
  { label: 'Manager',  email: 'manager1@align.demo', password: 'Manager@123',  role: 'manager' },
  { label: 'Employee', email: 'emp1@align.demo',     password: 'Employee@123', role: 'employee' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    const result = await login(data.email, data.password);
    if (result.success) {
      toast.success(`Welcome back!`);
      const roleRoutes = { admin: '/admin/dashboard', manager: '/manager/approvals', employee: '/dashboard' };
      navigate(roleRoutes[result.role] || '/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  const fillDemo = (cred) => {
    setValue('email', cred.email);
    setValue('password', cred.password);
    toast.success(`Demo ${cred.label} credentials loaded`, { icon: '👤' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-80 h-80 bg-indigo-400/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-modal overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-8 pt-10 pb-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="3" fill="white" />
                  <path d="M9 2v2M9 14v2M2 9h2M14 9h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">CoreSync</h1>
                <p className="text-primary-200 text-xs">Goal Setting & Tracking Portal</p>
              </div>
            </div>
            <p className="text-primary-100 text-sm">Sign in to your organization's workspace</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@company.com"
                />
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="btn-primary w-full py-3 text-base"
                id="login-submit"
              >
                {(isSubmitting || isLoading) ? (
                  <span className="flex items-center gap-2 justify-center">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75"/>
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Demo Credentials
              </p>
              <div className="grid grid-cols-3 gap-2">
                {demoCredentials.map((cred) => (
                  <button
                    key={cred.label}
                    onClick={() => fillDemo(cred)}
                    type="button"
                    className="text-xs py-2 px-3 rounded-lg border border-border bg-slate-50 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 font-medium transition-all duration-150"
                  >
                    {cred.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2 text-center">
                Click to auto-fill demo credentials
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-200 text-xs mt-6">
          CoreSync © 2025 — AtomBerg Hackathon Demo
        </p>
      </div>
    </div>
  );
}
