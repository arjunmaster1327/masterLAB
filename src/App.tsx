import React, { Component, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FlaskConical,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Microscope,
  Settings,
  ShieldCheck,
  Stethoscope,
  TestTube,
  Users,
  UserSquare2,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { LabProvider, useLab } from './context/LabContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PWAInstallButton } from './components/PWAInstallButton';
import type { ModuleId, UserRole } from './types/lab';
import labLogoImg from './assets/images/lab_logo_crest_1794746419559.jpg';
import pathologistAvatarImg from './assets/images/lab_avatar_pathologist_1794746421267.jpg';

import { DashboardModule } from './modules/DashboardModule';
import { PatientsModule } from './modules/PatientsModule';
import { BookingsModule } from './modules/BookingsModule';
import { SamplesModule } from './modules/SamplesModule';
import { ReportsModule } from './modules/ReportsModule';
import { TestsModule } from './modules/TestsModule';
import { BillingModule } from './modules/BillingModule';
import { AccountsModule } from './modules/AccountsModule';
import { HomeCollectionModule } from './modules/HomeCollectionModule';
import { DoctorsModule } from './modules/DoctorsModule';
import { StaffModule } from './modules/StaffModule';
import { NotificationsModule } from './modules/NotificationsModule';
import { AnalyticsModule } from './modules/AnalyticsModule';
import { SettingsModule } from './modules/SettingsModule';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-rose-200 bg-white p-6 space-y-3 shadow-sm">
            <h2 className="text-base font-bold text-rose-800">Application Error</h2>
            <p className="text-xs text-slate-600 font-mono break-all">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
            >
              Reload Laboratory App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV_ITEMS: { id: ModuleId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'bookings', label: 'Test Booking', icon: ClipboardList },
  { id: 'samples', label: 'Sample Tracking', icon: TestTube },
  { id: 'reports', label: 'Lab Reports', icon: Microscope },
  { id: 'tests', label: 'Test Catalog', icon: FlaskConical },
  { id: 'billing', label: 'Billing & Receipts', icon: CreditCard },
  { id: 'accounts', label: 'Accounts & Cashbook', icon: Wallet },
  { id: 'home_collection', label: 'Home Collection', icon: Home },
  { id: 'doctors', label: 'Referring Doctors', icon: Stethoscope },
  { id: 'staff', label: 'Staff & Attendance', icon: UserSquare2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'analytics', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings & Security', icon: Settings },
];

const LabShell: React.FC = () => {
  const {
    authUser,
    authLoading,
    userProfile,
    profileLoading,
    effectiveRole,
    previewRole,
    setPreviewRole,
    hasPermission,
    signInWithGoogle,
    logout,
    toasts,
    dismissToast,
    settings,
  } = useLab();

  const isOnline = useOnlineStatus();
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(item.id)),
    [hasPermission]
  );

  const handleSelectModule = (id: ModuleId) => {
    setActiveModule(id);
    setMobileMenuOpen(false);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <img
            src={labLogoImg}
            alt="Master Computerized Laboratory"
            className="h-14 w-14 mx-auto rounded-xl object-contain border border-slate-200 bg-white p-1"
          />
          <div className="text-sm font-semibold text-slate-800">
            Loading Master Computerized Laboratory...
          </div>
        </div>
      </div>
    );
  }

  // Sign-In Screen
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <img
              src={labLogoImg}
              alt="Master Computerized Laboratory Crest"
              className="h-20 w-20 rounded-2xl border border-slate-200 bg-white p-1.5 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                MASTER COMPUTERIZED LABORATORY
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Clinical Pathology, Diagnostics & Laboratory Management System
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-sky-900">
              <ShieldCheck className="h-4 w-4 text-sky-700 shrink-0" />
              Role-Based Clinical Access & Offline Cloud Sync
            </div>
            <p className="text-slate-600 leading-relaxed">
              Supports Admin, Manager, Receptionist, Technician, and Staff roles with real-time
              Firestore synchronization and local offline caching.
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 transition-colors"
          >
            Sign In with Google
          </button>

          <div className="flex justify-center">
            <PWAInstallButton />
          </div>
        </div>
      </div>
    );
  }

  // Pending Activation Gate for uninvited users
  const isActiveUser =
    userProfile?.status === 'active' ||
    authUser.email?.toLowerCase() === 'arjunmaster1327@gmail.com';

  if (!isActiveUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-7 space-y-4 text-center">
          <ShieldCheck className="h-10 w-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Staff Approval Required</h2>
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-mono font-medium">{authUser.email}</span>. Your
            account is currently pending activation by the Laboratory Administrator.
          </p>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const currentModuleMeta =
    NAV_ITEMS.find((i) => i.id === activeModule) || NAV_ITEMS[0];

  const renderModule = () => {
    if (!hasPermission(activeModule)) {
      return <DashboardModule onNavigate={handleSelectModule} />;
    }
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule onNavigate={handleSelectModule} />;
      case 'patients':
        return <PatientsModule />;
      case 'bookings':
        return <BookingsModule />;
      case 'samples':
        return <SamplesModule />;
      case 'reports':
        return <ReportsModule />;
      case 'tests':
        return <TestsModule />;
      case 'billing':
        return <BillingModule />;
      case 'accounts':
        return <AccountsModule />;
      case 'home_collection':
        return <HomeCollectionModule />;
      case 'doctors':
        return <DoctorsModule />;
      case 'staff':
        return <StaffModule />;
      case 'notifications':
        return <NotificationsModule />;
      case 'analytics':
        return <AnalyticsModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <DashboardModule onNavigate={handleSelectModule} />;
    }
  };

  const isActualAdmin = userProfile?.role === 'admin' || authUser.email?.toLowerCase() === 'arjunmaster1327@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white z-30 no-print">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200">
          <img
            src={settings.logoDataUrl || labLogoImg}
            alt="Lab Logo"
            className="h-9 w-9 rounded-lg border border-slate-200 object-contain bg-white p-0.5 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-tight text-sky-900 truncate">
              {settings.labName || 'MASTER LAB'}
            </div>
            <div className="text-[11px] text-slate-500 capitalize truncate">
              {effectiveRole} Workspace
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-sky-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={userProfile?.avatarUrl || authUser.photoURL || pathologistAvatarImg}
              alt={userProfile?.displayName || 'User'}
              className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {userProfile?.displayName || authUser.displayName}
              </div>
              <div className="text-[11px] text-slate-500 uppercase truncate">
                {effectiveRole}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 shadow-2xl">
            <div className="flex items-center justify-between px-5 h-14 border-b border-slate-200">
              <span className="text-xs font-bold text-sky-900 truncate">
                {settings.labName}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectModule(item.id)}
                    className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      active ? 'bg-sky-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-4 flex items-center justify-between">
              <div className="text-xs font-medium text-slate-800 truncate">
                {userProfile?.displayName || authUser.email}
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400">MasterLab</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {currentModuleMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {!isOnline && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                <WifiOff className="h-3.5 w-3.5" />
                Offline Sync Queued
              </div>
            )}

            {isActualAdmin && (
              <select
                aria-label="Preview Role View"
                value={previewRole || 'admin'}
                onChange={(e) => {
                  const val = e.target.value as UserRole;
                  setPreviewRole(val === 'admin' ? null : val);
                  setActiveModule('dashboard');
                }}
                className="hidden md:block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                title="Preview Role Permissions"
              >
                <option value="admin">Role: Admin</option>
                <option value="manager">Preview: Manager</option>
                <option value="receptionist">Preview: Receptionist</option>
                <option value="technician">Preview: Technician</option>
                <option value="staff">Preview: Staff</option>
              </select>
            )}

            <PWAInstallButton />
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-[1440px] w-full mx-auto">
          {renderModule()}
        </main>

        {/* Mobile Bottom Quick Nav (<= 56px to stay well under 15% mobile sticky cap) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 h-14 bg-white/95 backdrop-blur border-t border-slate-200 grid grid-cols-4 no-print">
          {(
            [
              { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
              { id: 'bookings', label: 'Booking', icon: ClipboardList },
              { id: 'samples', label: 'Samples', icon: TestTube },
              { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                  active ? 'text-sky-700 font-semibold' : 'text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 lg:bottom-5 right-4 z-50 space-y-2 max-w-sm w-[calc(100%-2rem)] no-print">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-lg ${
                t.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : t.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-sky-200 bg-white text-slate-900'
              }`}
            >
              <span>{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <LabProvider>
        <LabShell />
      </LabProvider>
    </AppErrorBoundary>
  );
}
