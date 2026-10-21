import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageSkeleton } from './components/Skeleton';

import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Layers,
  Film,
  FileText,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  Building2,
  BarChart3,
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30s
    },
  },
});

// Lazy-loaded pages
const AccessRequestsPage = React.lazy(() =>
  import('./pages/admin/AccessRequestsPage').then((m) => ({ default: m.AccessRequestsPage }))
);
const UsersPage = React.lazy(() =>
  import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage }))
);
const NotificationsPage = React.lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);

/**
 * RootRedirect: Directs all authenticated users to /dashboard for Phase 0.
 * (Role-specific redirection: admin/head/TL to /dashboard, member to /my-work, active in Phase 1)
 */
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Phase 1 Role-specific Redirection
  if (user.role === 'team_member') {
    return <Navigate to="/my-work" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <React.Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Public Authentication Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/set-password" element={<SetPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                {/* Root Redirection */}
                <Route path="/" element={<RootRedirect />} />

                {/* Screen 2: Team Dashboard (Phase 6) */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Team Dashboard"
                          screenNumber="Screen 2"
                          phase="Phase 6"
                          route="/dashboard"
                          description="One central executive cockpit where the Marketing Head and Team Leads track monthly marketing targets, live creative throughput, workload distribution, and lead metrics."
                          features={[
                            'Monthly Marketing Target editor & progress bar (revenue, leads, qualified leads, budget)',
                            'KPI strip: planned, completed, in progress, at risk, blocked, pending feedback, overdue',
                            "Today's Priorities table with immediate action triggers",
                            'Creative production output & trends across 7 brand profiles',
                            'Campaign Progress tracker linking to active business goals',
                            'Team Workload & Lead Funnel snapshots',
                            'Issues & Blockers overview with dependency warnings',
                            'Recent Activity stream with domain-wide event tracking',
                          ]}
                          icon={LayoutDashboard}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 3: My Work (Phase 3) */}
                <Route
                  path="/my-work"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="My Work"
                          screenNumber="Screen 3"
                          phase="Phase 3"
                          route="/my-work"
                          description="Personal priority queue for creative team members. Focuses entirely on personal work with one-click transitions and no distractions."
                          features={[
                            'Personal work partitioned into Today, Overdue, and Upcoming',
                            'One-click status transitions (Start, Submit for Review, Publish)',
                            'Mark Blocked action with mandatory blocker reason & dependency owner alert',
                            'Request Help and escalation trigger to assigned Team Lead',
                            'Personal rolling avgRevisions display and clarity empty states',
                          ]}
                          icon={CheckSquare}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 4: Monthly Marketing Calendar (Phase 3) */}
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Monthly Marketing Calendar"
                          screenNumber="Screen 4"
                          phase="Phase 3"
                          route="/calendar"
                          description="Multi-view calendar for scheduled work item deadlines, launch dates, and creative deliveries across 7 brand profiles."
                          features={[
                            'Month, Week, Campaign, and Owner calendar perspectives',
                            'Visual color coding by department and brand Profile',
                            'Filter by profile, department, owner, campaign, status',
                            'Click-through to Single Work Detail for immediate execution',
                          ]}
                          icon={Calendar}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 5: Projects / Campaigns (Phase 2) */}
                <Route
                  path="/campaigns"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Projects / Campaigns"
                          screenNumber="Screen 5"
                          phase="Phase 2"
                          route="/campaigns"
                          description="All marketing initiatives grouped into Campaigns tied directly to Monthly Targets. Prevents uncoordinated or orphaned marketing work."
                          features={[
                            'Enforced linkage: Target -> Campaign -> Work Items (no orphans)',
                            'Budget allocation vs spend actuals tracking and burn pace',
                            'Goal types (Leads, Reactivations, Enrollments)',
                            'Health status badges (In Progress, At Risk, Completed)',
                          ]}
                          icon={Layers}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 6: Project Detail (Phase 2) */}
                <Route
                  path="/campaigns/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Project Detail"
                          screenNumber="Screen 6"
                          phase="Phase 2"
                          route="/campaigns/:id"
                          description="Deep-dive into a single Campaign: business goals, budget pace, attached tasks, creative assets, and lead attribution."
                          features={[
                            'Traceability Overview tab showing target link and related OKR',
                            'Tasks tab with attached Work Items and owner assignments',
                            'Creatives tab previewing uploaded deliverables',
                            'Leads tab tracking incoming leads attributed to this campaign',
                          ]}
                          icon={Layers}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Work List (Phase 3) */}
                <Route
                  path="/work"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Work Items"
                          screenNumber="Work List"
                          phase="Phase 3"
                          route="/work"
                          description="Universal drill-down list for all marketing production deliverables, filterable across all 7 brand profiles and departments."
                          features={[
                            '14 work types (Reel, Ad Creative, Landing Page, Carousel, Post, Blog, Email, etc.)',
                            'Computed Overdue status (deadline passed without Approved/Published)',
                            'Global filter bar integration (Profile, Department, Owner, Status)',
                            'Full pagination, sorting, and universal link navigation',
                          ]}
                          icon={Film}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 7: Single Work Detail (Phase 3) */}
                <Route
                  path="/work/:id"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Single Work Detail"
                          screenNumber="Screen 7"
                          phase="Phase 3"
                          route="/work/:id"
                          description="The unified execution workplace for an individual work item: Brief, Files, Feedback rounds, ActivityEvent log, and Performance."
                          features={[
                            'Tabs: Overview, Brief, Files, Feedback, Activity, Performance, Related Leads',
                            'Strict status transitions via central transition service',
                            'Cloudinary signed asset uploads with thumbnail previews',
                            'Inline revision flag and blocker dependency warning',
                          ]}
                          icon={Film}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 8: Feedback & Revision History (Phase 5) */}
                <Route
                  path="/feedback"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Feedback & Revision History"
                          screenNumber="Screen 8"
                          phase="Phase 5"
                          route="/feedback"
                          description="Central review hub to triage open feedback threads and resolve flagged revision patterns in one place."
                          features={[
                            'Two-entry round structure: Reviewer decision + Owner response',
                            'Automatic RevisionFlag trigger on 4th round or baseline + 1',
                            '7 fixed root causes (Brief unclear, Creative direction, Skill gap, etc.)',
                            '48-hour unclassified escalation to Marketing Head',
                          ]}
                          icon={FileText}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 9: Team Workload (Phase 4) */}
                <Route
                  path="/workload"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Team Workload"
                          screenNumber="Screen 9"
                          phase="Phase 4"
                          route="/workload"
                          description="Capacity monitoring by department with visual workload bands, open task counts, and rolling 90-day avgRevisions."
                          features={[
                            'Three capacity bands: Healthy (<65%), High (65-85%), Overloaded (>85%)',
                            'Auto-assignment recommendation engine with explainable rationale',
                            'Mandatory AssignmentOverride logging when changing recommendations',
                            '5 performance dimensions (Output, Efficiency, Quality, Collaboration, Impact)',
                          ]}
                          icon={Users}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 10: Todo and Priorities (Phase 3) */}
                <Route
                  path="/todo"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Todo and Priorities"
                          screenNumber="Screen 10"
                          phase="Phase 3"
                          route="/todo"
                          description="Role-scoped todo list organized by Overdue, Today, and Upcoming. Designed for mental clarity and zero clutter."
                          features={[
                            'Role scoping: Head (org-wide), Team Lead (own team), Member (self)',
                            'Clean partitions: Overdue, Today, and Upcoming',
                            'One-click status transitions directly from the list',
                            'Clarity empty states without surveillance pressure',
                          ]}
                          icon={Clock}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 11: Issues and Blockers (Phase 5) */}
                <Route
                  path="/issues"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Issues and Blockers"
                          screenNumber="Screen 11"
                          phase="Phase 5"
                          route="/issues"
                          description="Dedicated operational console for active blockers and revision flags with inline notify and classify actions."
                          features={[
                            'Active blockers categorized by 9 fixed blocker reasons',
                            'Immediate notification to dependency owner for content/feedback/data',
                            'Flagged items with inline root-cause classification modal',
                            'Escalation badges for flags unclassified for >48 hours',
                          ]}
                          icon={AlertCircle}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 12: Lead Funnel (Phase 8) */}
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Lead Funnel"
                          screenNumber="Screen 12"
                          phase="Phase 8"
                          route="/leads"
                          description="12-stage LeadSquared funnel analytics, CPL and CPQL calculations, and source mix across 19 lead sources."
                          features={[
                            '12-stage funnel from Total Leads to Payment Received',
                            'Target vs actual qualified leads comparison',
                            'Cost per Lead (CPL) and Cost per Qualified Lead (CPQL)',
                            'Lead source distribution across all 19 defined sources',
                          ]}
                          icon={TrendingUp}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 13: Data Center / LSQ (Phase 8) */}
                <Route
                  path="/data-center"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Data Center / LSQ"
                          screenNumber="Screen 13"
                          phase="Phase 8"
                          route="/data-center"
                          description="LeadSquared sync health score, unassigned lead monitoring, and sync issue resolution console."
                          features={[
                            'LSQ integration health score & live sync status',
                            'Unassigned lead source monitoring and manual routing',
                            'Resolvable discrepancy and sync error list',
                            'Read-authoritative data integrity guarantees',
                          ]}
                          icon={Building2}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Screen 14: Reports and Automation (Phase 7) */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <PlaceholderPage
                          title="Reports and Automation"
                          screenNumber="Screen 14"
                          phase="Phase 7"
                          route="/reports"
                          description="6 Marketing OS Report Definitions with on-demand generation, plus 7 configurable Automation Rules."
                          features={[
                            '6 Report Definitions (Weekly Marketing, Monthly Scorecard, Output, Funnel, Digest, Campaign)',
                            'On-demand "Generate Now" HTML email & interactive in-app view',
                            '7 Automation Rules with active/paused toggle and last-run logging',
                            'Repeatable BullMQ schedule runner with idempotency checks',
                          ]}
                          icon={BarChart3}
                        />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Enabler: People Setup (Phase 1, adapted UsersPage) */}
                <Route
                  path="/people"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UsersPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Legacy Admin Users route alias */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <UsersPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Enabler: Access Requests (Phase 1, adapted AccessRequestsPage) */}
                <Route
                  path="/admin/access-requests"
                  element={
                    <ProtectedRoute requiredPermission="user.approve">
                      <Layout>
                        <AccessRequestsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Notifications Page (Kept Infrastructure) */}
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <NotificationsPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
export default App;
