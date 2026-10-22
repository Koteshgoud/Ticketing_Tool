import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { EmployeeTopNav } from './EmployeeTopNav';
import { EmployeeSidebar } from './EmployeeSidebar';
import { EmployeeService } from '../../services/employeeService';

export const EmployeeLayout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [assignedCount, setAssignedCount] = useState<number>(() => {
    return EmployeeService.getAssignedTickets().length;
  });

  useEffect(() => {
    let cancelled = false;
    const updateAssignedCount = async () => {
      await EmployeeService.fetchTickets();
      if (!cancelled) {
        setAssignedCount(EmployeeService.getAssignedTickets().length);
      }
    };
    updateAssignedCount();
    window.addEventListener('ticket-updated', updateAssignedCount);
    window.addEventListener('storage', updateAssignedCount);
    return () => {
      cancelled = true;
      window.removeEventListener('ticket-updated', updateAssignedCount);
      window.removeEventListener('storage', updateAssignedCount);
    };
  }, []);

  return (
    <div className="h-screen bg-[#F8FAFC] text-slate-900 flex overflow-hidden font-sans">
      {/* Sidebar (Dark Navy #0F172A continuous panel) */}
      <EmployeeSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        assignedCount={assignedCount}
      />

      {/* Main Container (Top Navigation + Scrollable Page Content) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <EmployeeTopNav
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic Page Content Area */}
        <main className="flex-1 bg-[#F8FAFC] overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
