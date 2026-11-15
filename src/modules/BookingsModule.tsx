import React, { useMemo, useState } from 'react';
import {
  Check,
  MessageSquare,
  Plus,
  Printer,
  Receipt,
  Search,
  UserPlus,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { Booking, BookingTestItem, Patient } from '../types/lab';
import { buildWhatsAppUrl, formatCurrency } from '../utils/labCalculations';
import { openExternalActionUrl } from '../utils/nativeBridge';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import { BarcodeCanvas, PrintStickerButton } from '../components/BarcodeCanvas';

const COMBO_PACKAGES = [
  { id: 'basic', name: 'Basic Wellness', description: 'CBC + Fasting Sugar + Urine Routine', codes: ['CBC', 'SUGAR', 'URINE'], price: 599 },
  { id: 'diabetes', name: 'Diabetes Care', description: 'Sugar + HbA1c + Lipid Profile + Urine Routine', codes: ['SUGAR', 'HBA1C', 'LIPID', 'URINE'], price: 1099 },
  { id: 'kidney', name: 'Kidney Care', description: 'KFT + CBC + Urine Routine', codes: ['KFT', 'CBC', 'URINE'], price: 899 },
  { id: 'fullbody', name: 'Full Body Check-up', description: 'CBC, LFT, KFT, Lipid, Sugar, HbA1c, Thyroid + Urine', codes: ['CBC', 'LFT', 'KFT', 'LIPID', 'SUGAR', 'HBA1C', 'THYROID', 'URINE'], price: 2499 },
];

export const BookingsModule: React.FC = () => {
  const {
    patients,
    tests,
    doctors,
    bookings,
    payments,
    settings,
    savePatient,
    createBooking,
    logNotification,
    pushToast,
  } = useLab();

  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [quickRegOpen, setQuickRegOpen] = useState(false);
  const [quickPatient, setQuickPatient] = useState({
    name: '',
    age: '30',
    ageUnit: 'Years' as Patient['ageUnit'],
    gender: 'Male' as Patient['gender'],
    mobile: '',
    address: '',
  });

  const [doctorId, setDoctorId] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [discount, setDiscount] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [collectionType, setCollectionType] = useState<'walk_in' | 'home_collection'>('walk_in');
  const [paidInput, setPaidInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank'>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);

  const [historySearch, setHistorySearch] = useState('');

  const matchingPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients.slice(0, 6);
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.patientCode.toLowerCase().includes(q) ||
          p.mobile.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [patients, patientSearch]);

  const activeTests = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    return tests.filter(
      (t) =>
        t.isActive &&
        (!q ||
          t.code.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q))
    );
  }, [tests, testSearch]);

  const selectedItems: BookingTestItem[] = useMemo(() => {
    return selectedTestIds
      .map((id) => tests.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => ({
        testId: t!.id,
        testCode: t!.code,
        testName: t!.name,
        price: t!.price,
        department: t!.department,
        sampleType: t!.sampleType,
      }));
  }, [selectedTestIds, tests]);

  const subtotal = selectedItems.reduce((sum, t) => sum + t.price, 0);
  const discountVal = Math.max(0, Math.min(subtotal, Number(discount) || 0));
  const netAmount = Math.max(0, subtotal - discountVal);
  const paidVal = paidInput === '' ? netAmount : Math.max(0, Math.min(netAmount, Number(paidInput) || 0));
  const dueAmount = Math.max(0, netAmount - paidVal);

  const applyPackage = (pkg: typeof COMBO_PACKAGES[number]) => {
    const matched = tests.filter((test) => pkg.codes.includes(test.code) && test.isActive);
    if (matched.length !== pkg.codes.length) {
      pushToast('error', 'Some tests in this package are not available in the active catalogue.');
      return;
    }
    const regularTotal = matched.reduce((sum, test) => sum + test.price, 0);
    setSelectedTestIds(matched.map((test) => test.id));
    setSelectedPackageId(pkg.id);
    setDiscount(String(Math.max(0, regularTotal - pkg.price)));
    setDiscountReason(pkg.name + ' combo offer');
    setPaidInput('');
    pushToast('success', pkg.name + ' package selected.');
  };

  const toggleTest = (id: string) => {
    setSelectedPackageId(null);
    setDiscount('0');
    setDiscountReason('');
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPatient.name.trim() || !quickPatient.mobile.trim()) {
      pushToast('error', 'Name and mobile are required.');
      return;
    }
    const created = await savePatient({
      name: quickPatient.name.trim(),
      age: Number(quickPatient.age) || 30,
      ageUnit: quickPatient.ageUnit,
      gender: quickPatient.gender,
      mobile: quickPatient.mobile.trim(),
      address: quickPatient.address.trim() || undefined,
    });
    setSelectedPatient(created);
    setQuickRegOpen(false);
    setQuickPatient({ name: '', age: '30', ageUnit: 'Years', gender: 'Male', mobile: '', address: '' });
  };

  const handleCreateBooking = async () => {
    if (!selectedPatient) {
      pushToast('error', 'Select or register a patient first.');
      return;
    }
    if (selectedItems.length === 0) {
      pushToast('error', 'Select at least one laboratory test.');
      return;
    }

    const docObj = doctors.find((d) => d.id === doctorId);
    setSubmitting(true);
    try {
      const created = await createBooking({
        patient: selectedPatient,
        doctorId: docObj?.id,
        doctorName: docObj?.name || selectedPatient.referringDoctorName,
        testItems: selectedItems,
        discount: discountVal,
        discountReason: discountReason.trim() || undefined,
        initialPaidAmount: paidVal,
        paymentMethod,
        paymentReference: paymentRef.trim() || undefined,
        collectionType,
      });
      setLastBooking(created);
      setSelectedTestIds([]);
      setSelectedPackageId(null);
      setDiscount('0');
      setDiscountReason('');
      setPaidInput('');
      setPaymentRef('');
    } catch {
      pushToast('error', 'Could not complete booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendWhatsAppBooking = async (b: Booking) => {
    if (!b.patientMobile) {
      pushToast('error', 'Patient mobile number not available.');
      return;
    }
    const message = `Hello ${b.patientName}, your test booking at ${settings.labName} is confirmed.\nAccession: ${b.accessionNo}\nTests: ${b.testItems.map((t) => t.testCode).join(', ')}\nTotal: ${formatCurrency(b.netAmount)} | Paid: ${formatCurrency(b.paidAmount)} | Due: ${formatCurrency(b.dueAmount)}.`;
    await openExternalActionUrl(buildWhatsAppUrl(b.patientMobile, message));
    await logNotification({
      patientId: b.patientId,
      patientName: b.patientName,
      mobile: b.patientMobile,
      channel: 'whatsapp',
      eventType: 'booking',
      message,
      status: 'dispatched',
      referenceId: b.id,
    });
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.accessionNo.toLowerCase().includes(q) ||
        b.patientName.toLowerCase().includes(q) ||
        (b.patientMobile || '').toLowerCase().includes(q)
    );
  }, [bookings, historySearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Test Booking & Accession</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Multi-test booking, automatic billing, barcode generation, and booking history
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === 'new' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            New Booking
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Booking History ({bookings.length})
          </button>
        </div>
      </div>

      {tab === 'new' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Patient & Tests */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Patient Selection */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">1. Select Patient</h2>
                <button
                  type="button"
                  onClick={() => setQuickRegOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {quickRegOpen ? 'Close Quick Form' : 'Quick Register New Patient'}
                </button>
              </div>

              {quickRegOpen && (
                <form
                  onSubmit={handleQuickRegister}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-sky-50/50 border border-sky-100"
                >
                  <input
                    type="text"
                    required
                    placeholder="Patient Full Name *"
                    value={quickPatient.name}
                    onChange={(e) => setQuickPatient({ ...quickPatient, name: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={150}
                      required
                      placeholder="Age"
                      value={quickPatient.age}
                      onChange={(e) => setQuickPatient({ ...quickPatient, age: e.target.value })}
                      className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono"
                    />
                    <select
                      value={quickPatient.gender}
                      onChange={(e) =>
                        setQuickPatient({
                          ...quickPatient,
                          gender: e.target.value as Patient['gender'],
                        })
                      }
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      required
                      placeholder="Mobile *"
                      value={quickPatient.mobile}
                      onChange={(e) => setQuickPatient({ ...quickPatient, mobile: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              {selectedPatient ? (
                <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedPatient.name}
                    </div>
                    <div className="text-xs text-slate-600 font-mono">
                      {selectedPatient.patientCode} · {selectedPatient.age} {selectedPatient.ageUnit} ·{' '}
                      {selectedPatient.gender} · {selectedPatient.mobile}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs font-semibold text-sky-800 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Search existing patient by name, code, or mobile..."
                      className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {matchingPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPatient(p)}
                        className="text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-sky-400 hover:bg-sky-50/40 transition-colors"
                      >
                        <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">
                          {p.patientCode} · {p.mobile}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Referring Doctor
                  </label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Walk-in / Patient Default</option>
                    {doctors
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Collection Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCollectionType('walk_in')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                        collectionType === 'walk_in'
                          ? 'border-sky-700 bg-sky-50 text-sky-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Walk-In Lab
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectionType('home_collection')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                        collectionType === 'home_collection'
                          ? 'border-sky-700 bg-sky-50 text-sky-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Home Collection
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Select Multiple Tests */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  2. Select Laboratory Tests ({selectedItems.length} selected)
                </h2>
                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    placeholder="Filter tests..."
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Value Combo Packages · Prices in ₹</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMBO_PACKAGES.map((pkg) => (
                    <button key={pkg.id} type="button" onClick={() => applyPackage(pkg)}
                      className={`rounded-xl border p-3 text-left transition-colors ${selectedPackageId === pkg.id ? 'border-sky-700 bg-sky-50' : 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{pkg.name}</span>
                        <span className="text-sm font-bold text-emerald-700">{formatCurrency(pkg.price)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600">{pkg.description}</div>
                      <div className="mt-1 text-[10px] font-semibold text-emerald-700">Select package</div>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500">Suggested introductory prices. Confirm actual rates and test availability before use.</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {activeTests.map((t) => {
                  const selected = selectedTestIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTest(t.id)}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                        selected
                          ? 'border-sky-700 bg-sky-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-sky-800">
                            {t.code}
                          </span>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {t.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {t.department} · {t.sampleType}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(t.price)}
                        </span>
                        <span
                          className={`h-5 w-5 rounded flex items-center justify-center border ${
                            selected
                              ? 'bg-sky-700 border-sky-700 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Billing & Confirmation */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900">3. Billing & Sample Accession</h2>

              {selectedItems.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Select tests on the left to compute invoice total.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {selectedItems.map((item) => (
                    <div key={item.testId} className="py-2 flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate pr-2">{item.testName}</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Discount (INR)</span>
                  <input
                    type="number"
                    min={0}
                    max={subtotal}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 text-right font-mono text-sm"
                  />
                </div>
                {discountVal > 0 && (
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Discount reason (optional)"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                )}
                <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2">
                  <span>Net Payable</span>
                  <span className="font-mono tabular-nums">{formatCurrency(netAmount)}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Amount Paid Now
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={netAmount}
                      value={paidInput === '' ? String(netAmount) : paidInput}
                      onChange={(e) => setPaidInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value as 'cash' | 'upi' | 'card' | 'bank')
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                {paymentMethod !== 'cash' && (
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="UPI / Transaction Reference No."
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono"
                  />
                )}

                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-500">Balance Due</span>
                  <span
                    className={`font-mono tabular-nums ${
                      dueAmount > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(dueAmount)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={submitting || !selectedPatient || selectedItems.length === 0}
                  onClick={handleCreateBooking}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  {submitting ? 'Generating Accession...' : 'Confirm Booking & Generate Barcode'}
                </button>
              </div>
            </div>

            {/* Instant Generated Accession & Barcode Card */}
            {lastBooking && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800">
                    Accession Generated
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {lastBooking.accessionNo}
                  </span>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-2 flex justify-center">
                  <BarcodeCanvas value={lastBooking.barcodeValue} height={38} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      generateInvoicePdf(
                        lastBooking,
                        payments.filter((p) => p.bookingId === lastBooking.id),
                        settings,
                        'print'
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Receipt
                  </button>
                  <PrintStickerButton
                    accessionNo={lastBooking.accessionNo}
                    patientName={lastBooking.patientName}
                    sampleType={lastBooking.testItems[0]?.sampleType || 'Blood'}
                  />
                  <button
                    type="button"
                    onClick={() => sendWhatsAppBooking(lastBooking)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Send WhatsApp Confirmation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search booking by accession no, patient, or mobile..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-sky-600 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {filteredHistory.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No bookings found matching your query.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Accession / Date</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Tests</th>
                      <th className="px-5 py-3 text-right">Net / Paid / Due</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((b) => (
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
                            {b.patientMobile || '-'}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-700">
                          {b.testItems.map((t) => t.testCode).join(', ')}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(b.netAmount)}
                          </div>
                          <div className="text-emerald-700">Paid: {formatCurrency(b.paidAmount)}</div>
                          {b.dueAmount > 0 && (
                            <div className="text-rose-600">Due: {formatCurrency(b.dueAmount)}</div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs whitespace-nowrap">
                          <div className="capitalize text-slate-700">
                            Sample: {b.sampleStatus.replace('_', ' ')}
                          </div>
                          <div className="capitalize text-slate-500">Report: {b.reportStatus}</div>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                generateInvoicePdf(
                                  b,
                                  payments.filter((p) => p.bookingId === b.id),
                                  settings,
                                  'download'
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Receipt className="h-3.5 w-3.5 text-sky-700" />
                              Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => sendWhatsAppBooking(b)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              WhatsApp
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
