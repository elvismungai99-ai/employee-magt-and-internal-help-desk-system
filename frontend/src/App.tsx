import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TeamHubLayout } from './components/TeamHubLayout';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LeavePortalPage = lazy(() => import('./pages/LeavePortalPage').then((m) => ({ default: m.LeavePortalPage })));
const ManagerApprovalsPage = lazy(() => import('./pages/ManagerApprovalsPage').then((m) => ({ default: m.ManagerApprovalsPage })));
const HelpDeskPage = lazy(() => import('./pages/HelpDeskPage').then((m) => ({ default: m.HelpDeskPage })));
const AgentQueuePage = lazy(() => import('./pages/AgentQueuePage').then((m) => ({ default: m.AgentQueuePage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));

const PageLoader: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0e4a5c] border-t-transparent" />
  </div>
);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TeamHubLayout>
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  </TeamHubLayout>
);

export default function App() {
  React.useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    if (apiBase) {
      fetch(`${apiBase}/api/auth/ping`, { cache: 'no-store' }).catch(() => {});
    }
  }, []);

  return (
    <ThemeProvider>
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
  </ThemeProvider>
);
}
