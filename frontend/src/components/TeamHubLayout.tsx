import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TeamHubSidebar } from './TeamHubSidebar';
import { TeamHubHeader } from './TeamHubHeader';

interface TeamHubLayoutProps {
  children: React.ReactNode;
  title?: string;
  breadcrumb?: string;
}

export const TeamHubLayout: React.FC<TeamHubLayoutProps> = ({
  children,
  title,
  breadcrumb,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/leave') {
      return {
        title: title || 'Leave Management',
        breadcrumb: breadcrumb || 'Dashboard / Leave Management',
      };
    }
    if (path.startsWith('/helpdesk')) {
      return {
        title: title || 'Inbox & Help Desk',
        breadcrumb: breadcrumb || 'Dashboard / Inbox',
      };
    }
    if (path.startsWith('/approvals')) {
      return {
        title: title || 'Manager Approvals',
        breadcrumb: breadcrumb || 'Dashboard / Approvals',
      };
    }
    if (path.startsWith('/agent-queue')) {
      return {
        title: title || 'Support Agent Queue',
        breadcrumb: breadcrumb || 'Dashboard / Support Queue',
      };
    }
    if (path.startsWith('/admin')) {
      return {
        title: title || 'Employee Administration',
        breadcrumb: breadcrumb || 'Dashboard / Administration',
      };
    }
    return {
      title: title || 'Dashboard Overview',
      breadcrumb: breadcrumb || 'Dashboard / Overview',
    };
  };

  const pageInfo = getPageInfo();

  return (
    <div className="min-h-screen bg-[#f2f8f8] flex text-[#0d2836] font-sans antialiased selection:bg-teal-200 selection:text-teal-900">
      {/* Fixed Left Sidebar */}
      <TeamHubSidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TeamHubHeader
          title={pageInfo.title}
          breadcrumb={pageInfo.breadcrumb}
          onToggleMobileMenu={() => setMobileOpen(!mobileOpen)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
