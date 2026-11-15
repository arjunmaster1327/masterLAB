import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Download,
  IndianRupee,
  MessageSquare,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { Booking } from '../types/lab';
import { buildWhatsAppUrl, formatCurrency } from '../utils/labCalculations';
import { generateInvoicePdf } from '../utils/pdfGenerator';

export const BillingModule: React.FC = () => {
  const { bookings, payments, settings, collectPayment, logNotification, pushToast } = useLab();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card' | 'bank'>('cash');
  const [payRef, setPayRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchFilter = filter === 'all' || b.paymentStatus === filter;
      const matchQ =
        !q ||
        b.accessionNo.toLowerCase().includes(q) ||
        b.patientName.toLowerCase().includes(q) ||
        (b.patientMobile || '').toLowerCase().includes(q);
      return matchFilter && matchQ;
    });
  }, [bookings, search, filter]);

  const totals = useMemo(() => {
    const billed = bookings.reduce((s, b) => s + b.netAmount, 0);
    const collected = bookings.reduce((s, b) => s + b.paidAmount, 0);
    const due = bookings.reduce((s, b) => s + b.dueAmount, 0);
    return { billed, collected, due };
  }, [bookings]);

  const openCollectModal = (b: Booking) => {
    setPayingBooking(b);
    setPayAmount(String(b.dueAmount));
    setPayMethod('cash');
    setPayRef('');
  };

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBooking) return;
    const amt = Number(payAmount);
    if (Number.isNaN(amt) || amt <= 0 || amt > payingBooking.dueAmount) {
      pushToast('error', `Enter a valid amount up to ${formatCurrency(payingBooking.dueAmount)}.`);
      return;
    }

    setSubmitting(true);
    try {
      await collectPayment({
        booking: payingBooking,
        amount: amt,
        method: payMethod,
        referenceNo: payRef.trim() || undefined,
      });
      setPayingBooking(null);
    } catch {
      pushToast('error', 'Could not record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendPaymentWhatsApp = async (b: Booking) => {
    if (!b.patientMobile) {
      pushToast('error', 'Patient mobile number not available.');
      return;
    }
    const msg = `Payment Receipt - ${settings.labName}\nPatient: ${b.patientName}\nAccession: ${b.accessionNo}\nNet Bill: ${formatCurrency(b.netAmount)}\nPaid: ${formatCurrency(b.paidAmount)}\nBalance Due: ${formatCurrency(b.dueAmount)}`;
    window.open(buildWhatsAppUrl(b.patientMobile, msg), '_blank', 'noopener,noreferrer');
    await logNotification({
      patientId: b.patientId,
      patientName: b.patientName,
      mobile: b.patientMobile,
      channel: 'whatsapp',
      eventType: 'payment',
      message: msg,
      status: 'dispatched',
      referenceId: b.id,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Billing, Invoices & Receipts
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage patient invoices, collect partial or full balances via Cash/UPI/Card, and print receipts
        </p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Total Billed</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrency(totals.billed)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Total Collected</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatCurrency(totals.collected)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Outstanding Receivables</div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {formatCurrency(totals.due)}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice by accession no or patient..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-sky-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(['all', 'unpaid', 'partial', 'paid'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                filter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No invoices match the selected payment filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Accession / Date</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3 text-right">Net Bill</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Balance Due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => {
                  const bookingPays = payments.filter((p) => p.bookingId === b.id);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-sky-800">
                          {b.accessionNo}
                        </div>
                        <div className="text-xs text-slate-500">{b.bookingDate}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{b.patientName}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {bookingPays.map((p) => p.receiptNo).join(', ') || 'No receipt yet'}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-slate-900">
                        {formatCurrency(b.netAmount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-emerald-700">
                        {formatCurrency(b.paidAmount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-rose-700">
                        {formatCurrency(b.dueAmount)}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold capitalize whitespace-nowrap">
                        <span
                          className={
                            b.paymentStatus === 'paid'
                              ? 'text-emerald-700'
                              : b.paymentStatus === 'partial'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }
                        >
                          {b.paymentStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {b.dueAmount > 0 && (
                            <button
                              type="button"
                              onClick={() => openCollectModal(b)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                            >
                              <IndianRupee className="h-3.5 w-3.5" />
                              Collect Due
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => generateInvoicePdf(b, bookingPays, settings, 'download')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Download className="h-3.5 w-3.5 text-sky-700" />
                            Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => generateInvoicePdf(b, bookingPays, settings, 'print')}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                            title="Print Invoice"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => sendPaymentWhatsApp(b)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-800 hover:bg-emerald-100"
                            title="Send WhatsApp Receipt"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      {payingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-sky-700" />
                <h2 className="text-base font-semibold text-slate-900">Collect Balance Payment</h2>
              </div>
              <button
                type="button"
                onClick={() => setPayingBooking(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCollect} className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  {payingBooking.patientName} ({payingBooking.accessionNo})
                </div>
                <div className="text-slate-600 font-mono">
                  Due Balance: {formatCurrency(payingBooking.dueAmount)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Amount Receiving (INR) *
                </label>
                <input
                  type="number"
                  step="any"
                  min={1}
                  max={payingBooking.dueAmount}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(e.target.value as 'cash' | 'upi' | 'card' | 'bank')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              {payMethod !== 'cash' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    UPI / Transaction Reference
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="UTR / Reference ID"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayingBooking(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-sky-700 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
