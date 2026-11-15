import React, { useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FlaskConical,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLab } from '../context/LabContext';
import type { ModuleId } from '../types/lab';
import { currentMonthPrefix, formatCurrency, todayISO } from '../utils/labCalculations';

interface DashboardModuleProps {
  onNavigate: (module: ModuleId) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { patients, bookings, labReports, cashbook, samples, homeCollections, dataLoading } =
    useLab();

  const today = todayISO();
  const monthPrefix = currentMonthPrefix();

  const stats = useMemo(() => {
    const todayBookings = bookings.filter((b) => b.bookingDate === today);
    const todayPatientsSet = new Set(todayBookings.map((b) => b.patientId));
    const totalTestsBooked = todayBookings.reduce((sum, b) => sum + b.testItems.length, 0);
    const allTimeTests = bookings.reduce((sum, b) => sum + b.testItems.length, 0);

    const pendingReports = labReports.filter((r) => r.status !== 'approved').length;
    const completedReports = labReports.filter((r) => r.status === 'approved').length;

    const todayIncome = cashbook
      .filter((e) => e.entryDate === today && e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    const todayExpense = cashbook
      .filter((e) => e.entryDate === today && e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    const monthlyIncome = cashbook
      .filter((e) => e.entryDate.startsWith(monthPrefix) && e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    const monthlyExpense = cashbook
      .filter((e) => e.entryDate.startsWith(monthPrefix) && e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      todayPatients: todayPatientsSet.size,
      totalPatients: patients.length,
      todayTests: totalTestsBooked,
      allTimeTests,
      pendingReports,
      completedReports,
      todayIncome,
      todayExpense,
      monthlyIncome,
      monthlyExpense,
      pendingSamples: samples.filter(
        (s) => s.status === 'pending_collection' || s.status === 'collected'
      ).length,
      pendingHomeVisits: homeCollections.filter(
        (h) => h.status === 'scheduled' || h.status === 'en_route'
      ).length,
    };
  }, [bookings, patients.length, labReports, cashbook, samples, homeCollections, today, monthPrefix]);

  // Last 14 days daily revenue & expense chart data
  const dailyChartData = useMemo(() => {
    const days: { date: string; label: string; income: number; expense: number; bookings: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const income = cashbook
        .filter((e) => e.entryDate === iso && e.type === 'income')
        .reduce((s, e) => s + e.amount, 0);
      const expense = cashbook
        .filter((e) => e.entryDate === iso && e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0);
      const dayBookings = bookings.filter((b) => b.bookingDate === iso).length;
      days.push({ date: iso, label, income, expense, bookings: dayBookings });
    }
    return days;
  }, [cashbook, bookings]);

  // Last 6 months monthly revenue chart
  const monthlyChartData = useMemo(() => {
    const months: { month: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const income = cashbook
        .filter((e) => e.entryDate.startsWith(key) && e.type === 'income')
        .reduce((s, e) => s + e.amount, 0);
      const expense = cashbook
        .filter((e) => e.entryDate.startsWith(key) && e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0);
      months.push({ month: key, label, income, expense });
    }
    return months;
  }, [cashbook]);

  const recentBookings = bookings.slice(0, 6);

  if (dataLoading && bookings.length === 0 && patients.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse p-5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Laboratory Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time diagnostic operations for {today} · {stats.pendingSamples} samples in queue ·{' '}
            {stats.pendingHomeVisits} active home visits
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('bookings')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
          >
            New Test Booking
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Enter Lab Results
          </button>
        </div>
      </div>

      {/* 6 Core Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Today&apos;s Patients</span>
            <Users className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {stats.todayPatients}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Total registered: {stats.totalPatients}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Tests (Today / Overall)</span>
            <FlaskConical className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {stats.todayTests}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Cumulative: {stats.allTimeTests}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending vs Completed Reports</span>
            <Activity className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="text-2xl font-bold font-mono tabular-nums">
                {stats.pendingReports}
              </span>
              <span className="text-xs font-medium">Pending</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="text-2xl font-bold font-mono tabular-nums">
                {stats.completedReports}
              </span>
              <span className="text-xs font-medium">Approved</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Daily Income</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(stats.todayIncome)}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Month: {formatCurrency(stats.monthlyIncome)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Daily Expenses</span>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(stats.todayExpense)}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Month: {formatCurrency(stats.monthlyExpense)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Monthly Net Cashflow</span>
            <IndianRupee className="h-4 w-4 text-sky-700" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(stats.monthlyIncome - stats.monthlyExpense)}
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Today Net: {formatCurrency(stats.todayIncome - stats.todayExpense)}
            </span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">14-Day Cashflow Trend</h2>
              <p className="text-xs text-slate-500">Daily cashbook income vs expenses</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expenses"
                  stroke="#dc2626"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">6-Month Revenue & Expenses</h2>
              <p className="text-xs text-slate-500">Monthly financial performance</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="income" name="Income" fill="#0f4c81" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Accession Queue */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Bookings & Sample Status</h2>
            <p className="text-xs text-slate-500">Live synchronized patient accession queue</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('bookings')}
            className="text-xs font-semibold text-sky-700 hover:text-sky-800 whitespace-nowrap"
          >
            View All Bookings
          </button>
        </div>

        {recentBookings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No bookings recorded yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Create your first patient test booking to start tracking samples, billing, and lab reports.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('bookings')}
              className="mt-4 inline-flex items-center rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
            >
              Create First Booking
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Accession</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Tests</th>
                  <th className="px-5 py-3">Sample</th>
                  <th className="px-5 py-3">Report</th>
                  <th className="px-5 py-3 text-right">Net / Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-sky-800 whitespace-nowrap">
                      {b.accessionNo}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{b.patientName}</div>
                      <div className="text-xs text-slate-500">
                        {b.bookingDate} · {b.doctorName || 'Walk-in'}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-700">
                      {b.testItems.map((t) => t.testCode).join(', ')}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium text-slate-700 capitalize whitespace-nowrap">
                      {b.sampleStatus.replace('_', ' ')}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium whitespace-nowrap">
                      <span
                        className={
                          b.reportStatus === 'approved'
                            ? 'text-emerald-700 font-semibold'
                            : b.reportStatus === 'verified'
                            ? 'text-sky-700 font-semibold'
                            : 'text-amber-700'
                        }
                      >
                        {b.reportStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{formatCurrency(b.netAmount)}</div>
                      {b.dueAmount > 0 && (
                        <div className="text-rose-600">Due: {formatCurrency(b.dueAmount)}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
