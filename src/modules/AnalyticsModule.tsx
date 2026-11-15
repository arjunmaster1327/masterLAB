import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLab } from '../context/LabContext';
import { currentMonthPrefix, formatCurrency, todayISO } from '../utils/labCalculations';
import { generateFinancialReportPdf } from '../utils/pdfGenerator';
import { exportBusinessReportExcel } from '../utils/excelExport';

export const AnalyticsModule: React.FC = () => {
  const { bookings, cashbook, patients, settings } = useLab();
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  const today = todayISO();
  const monthPrefix = currentMonthPrefix();

  const weekStartISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const scopedBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (range === 'daily') return b.bookingDate === today;
      if (range === 'weekly') return b.bookingDate >= weekStartISO;
      return b.bookingDate.startsWith(monthPrefix);
    });
  }, [bookings, range, today, weekStartISO, monthPrefix]);

  const scopedCashbook = useMemo(() => {
    return cashbook.filter((e) => {
      if (range === 'daily') return e.entryDate === today;
      if (range === 'weekly') return e.entryDate >= weekStartISO;
      return e.entryDate.startsWith(monthPrefix);
    });
  }, [cashbook, range, today, weekStartISO, monthPrefix]);

  const metrics = useMemo(() => {
    const netBilled = scopedBookings.reduce((s, b) => s + b.netAmount, 0);
    const collected = scopedBookings.reduce((s, b) => s + b.paidAmount, 0);
    const due = scopedBookings.reduce((s, b) => s + b.dueAmount, 0);
    const income = scopedCashbook.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = scopedCashbook.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { netBilled, collected, due, income, expense, profit: income - expense };
  }, [scopedBookings, scopedCashbook]);

  const departmentChart = useMemo(() => {
    const map: Record<string, { department: string; revenue: number; count: number }> = {};
    for (const b of scopedBookings) {
      for (const item of b.testItems) {
        if (!map[item.department]) {
          map[item.department] = { department: item.department, revenue: 0, count: 0 };
        }
        map[item.department].revenue += item.price;
        map[item.department].count += 1;
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [scopedBookings]);

  const topTests = useMemo(() => {
    const map: Record<string, { code: string; name: string; count: number; revenue: number }> = {};
    for (const b of scopedBookings) {
      for (const item of b.testItems) {
        if (!map[item.testCode]) {
          map[item.testCode] = { code: item.testCode, name: item.testName, count: 0, revenue: 0 };
        }
        map[item.testCode].count += 1;
        map[item.testCode].revenue += item.price;
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [scopedBookings]);

  const periodLabel =
    range === 'daily'
      ? `Daily (${today})`
      : range === 'weekly'
      ? `Last 7 Days (${weekStartISO} to ${today})`
      : `Monthly (${monthPrefix})`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Reports & Business Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Daily, weekly, and monthly diagnostic performance with PDF and Excel export
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              generateFinancialReportPdf(
                'Business & Financial Report',
                periodLabel,
                scopedCashbook,
                scopedBookings,
                settings
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-sky-700" />
            Export PDF Report
          </button>
          <button
            type="button"
            onClick={() =>
              exportBusinessReportExcel(periodLabel, scopedBookings, scopedCashbook, patients)
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['daily', 'weekly', 'monthly'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition-colors ${
              range === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {r} Report
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Bookings / Billed</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(metrics.netBilled)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {scopedBookings.length} bookings
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Cashbook Income</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatCurrency(metrics.income)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Cashbook Expenses</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {formatCurrency(metrics.expense)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Net Profit / Loss</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-sky-800">
            {formatCurrency(metrics.profit)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">
            Department Revenue Breakdown
          </h2>
          {departmentChart.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              No department test bookings in {periodLabel}.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0))} />
                  <Bar dataKey="revenue" name="Revenue" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Top Requested Tests</h2>
          </div>
          {topTests.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No tests performed in {periodLabel}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-2.5">Test</th>
                    <th className="px-5 py-2.5 text-right">Count</th>
                    <th className="px-5 py-2.5 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topTests.map((t) => (
                    <tr key={t.code}>
                      <td className="px-5 py-2.5">
                        <span className="font-mono text-xs font-semibold text-sky-800 mr-2">
                          {t.code}
                        </span>
                        <span className="text-xs text-slate-800">{t.name}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums">
                        {t.count}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
                        {formatCurrency(t.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
