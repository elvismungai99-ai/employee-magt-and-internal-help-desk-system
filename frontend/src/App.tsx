import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeavePortalPage } from './pages/LeavePortalPage';
import { ManagerApprovalsPage } from './pages/ManagerApprovalsPage';
import { HelpDeskPage } from './pages/HelpDeskPage';
import { AgentQueuePage } from './pages/AgentQueuePage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { TeamHubLayout } from './components/TeamHubLayout';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TeamHubLayout>{children}</TeamHubLayout>
);

export default function App() {
  React.useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    if (apiBase) {
      fetch(`${apiBase}/actuator/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    }
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated Application Home & Landing Page */}
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
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/landing" element={<Navigate to="/" replace />} />
          <Route path="/app" element={<Navigate to="/" replace />} />

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
