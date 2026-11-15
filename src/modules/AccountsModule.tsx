import React, { useMemo, useState } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { currentMonthPrefix, formatCurrency, todayISO } from '../utils/labCalculations';

const INCOME_CATEGORIES = ['Lab Billing', 'Home Visit Fee', 'Corporate Tie-up', 'Other Income'];
const EXPENSE_CATEGORIES = [
  'Reagents & Kits',
  'Lab Consumables',
  'Staff Salary',
  'Doctor Commission',
  'Rent & Utilities',
  'Equipment Maintenance',
  'Other Expense',
];

export const AccountsModule: React.FC = () => {
  const { cashbook, effectiveRole, addCashbookEntry, deleteCashbookEntry, pushToast } = useLab();
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    entryDate: todayISO(),
    type: 'expense' as 'income' | 'expense',
    category: 'Reagents & Kits',
    description: '',
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'upi' | 'card' | 'bank',
  });

  const today = todayISO();
  const monthPrefix = currentMonthPrefix();

  const filtered = useMemo(() => {
    return cashbook.filter((e) => {
      const matchPeriod =
        period === 'all' ||
        (period === 'today' && e.entryDate === today) ||
        (period === 'month' && e.entryDate.startsWith(monthPrefix));
      const matchType = typeFilter === 'all' || e.type === typeFilter;
      return matchPeriod && matchType;
    });
  }, [cashbook, period, typeFilter, today, monthPrefix]);

  const summary = useMemo(() => {
    const income = filtered.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = filtered.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, profit: income - expense };
  }, [filtered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.description.trim() || Number.isNaN(amt) || amt <= 0) {
      pushToast('error', 'Enter a valid description and positive amount.');
      return;
    }

    setSubmitting(true);
    try {
      await addCashbookEntry({
        entryDate: form.entryDate,
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount: amt,
        paymentMethod: form.paymentMethod,
      });
      setModalOpen(false);
      setForm({
        entryDate: todayISO(),
        type: 'expense',
        category: 'Reagents & Kits',
        description: '',
        amount: '',
        paymentMethod: 'cash',
      });
    } catch {
      pushToast('error', 'Failed to record cashbook entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Accounts & Daily Cashbook
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track laboratory income, reagent & operational expenses, and net profit/loss
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Record Income / Expense
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                period === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {(['all', 'income', 'expense'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                typeFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* P&L Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Income</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatCurrency(summary.income)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Expenses</span>
            <TrendingDown className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {formatCurrency(summary.expense)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net Profit / Loss</span>
            <Wallet className="h-4 w-4 text-sky-700" />
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.profit >= 0 ? 'text-slate-900' : 'text-rose-700'
            }`}
          >
            {formatCurrency(summary.profit)}
          </div>
        </div>
      </div>

      {/* Cashbook Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No cashbook transactions recorded for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  {effectiveRole === 'admin' && <th className="px-5 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {entry.entryDate}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold capitalize whitespace-nowrap">
                      <span
                        className={
                          entry.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                        }
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-medium text-slate-800">
                      {entry.category}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">{entry.description}</td>
                    <td className="px-5 py-3 text-xs uppercase font-mono text-slate-600">
                      {entry.paymentMethod}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        entry.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {entry.type === 'income' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </td>
                    {effectiveRole === 'admin' && (
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteCashbookEntry(entry.id)}
                          className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                          title="Delete Entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">New Cashbook Entry</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['income', 'expense'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        type: t,
                        category:
                          t === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
                      })
                    }
                    className={`py-2 rounded-lg text-xs font-semibold capitalize border ${
                      form.type === t
                        ? t === 'income'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.entryDate}
                    onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentMethod: e.target.value as 'cash' | 'upi' | 'card' | 'bank',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Amount (INR) *
                </label>
                <input
                  type="number"
                  step="any"
                  min={1}
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Hematology reagent pack purchase"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-sky-700 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
