import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import useCycleStore from '../../stores/cycleStore';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { fetchActiveCycle } = useCycleStore();

  useEffect(() => {
    fetchActiveCycle();
  }, []);

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={!sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content — offset for fixed sidebar on desktop */}
      <div className="flex-1 flex flex-col lg:ml-64">
        <TopBar onMenuToggle={() => setSidebarOpen(o => !o)} />

        {/* Page content */}
        <main className="flex-1 pt-16">
          <div className="max-w-screen-xl mx-auto px-4 lg:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
