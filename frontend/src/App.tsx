import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeavePortalPage } from './pages/LeavePortalPage';
import { ManagerApprovalsPage } from './pages/ManagerApprovalsPage';
import { HelpDeskPage } from './pages/HelpDeskPage';
import { AgentQueuePage } from './pages/AgentQueuePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#f0f6fc] flex flex-col font-sans">
    <Navbar />
    <main className="flex-1 pb-12">{children}</main>
    <footer className="border-t border-blue-100 bg-white/95 py-4 text-center text-xs text-slate-600">
      Employee Management &amp; Internal Help Desk System &bull; &copy; 2026 All rights reserved.
    </footer>
  </div>
);

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/leave"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <LeavePortalPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/helpdesk"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <HelpDeskPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Role-Restricted Manager Approvals Route */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute allowedRoles={['LINE_MANAGER', 'HR_ADMIN']}>
                <AppLayout>
                  <ManagerApprovalsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Role-Restricted Support Agent Queue Route */}
          <Route
            path="/agent-queue"
            element={
              <ProtectedRoute allowedRoles={['SUPPORT_AGENT', 'HR_ADMIN']}>
                <AppLayout>
                  <AgentQueuePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Role-Restricted Admin Monitoring Route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['HR_ADMIN']}>
                <AppLayout>
                  <AdminDashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
