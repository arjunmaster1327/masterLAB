import React, { useMemo, useState } from 'react';
import { Calendar, Home, MapPin, Plus, UserCheck, X } from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { HomeCollection } from '../types/lab';
import { todayISO } from '../utils/labCalculations';

const HC_FILTERS: { id: 'all' | HomeCollection['status']; label: string }[] = [
  { id: 'all', label: 'All Visits' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'en_route', label: 'En Route' },
  { id: 'collected', label: 'Collected' },
  { id: 'delivered_to_lab', label: 'Delivered to Lab' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const HomeCollectionModule: React.FC = () => {
  const { homeCollections, staffUsers, tests, patients, saveHomeCollection, pushToast } =
    useLab();
  const [filter, setFilter] = useState<'all' | HomeCollection['status']>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HomeCollection | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    patientId: '',
    patientName: '',
    patientMobile: '',
    address: '',
    landmark: '',
    scheduledDate: todayISO(),
    scheduledSlot: '08:00 AM - 10:00 AM',
    requestedTests: [] as string[],
    assignedStaffId: '',
    status: 'scheduled' as HomeCollection['status'],
    notes: '',
  });

  const filtered = useMemo(() => {
    if (filter === 'all') return homeCollections;
    return homeCollections.filter((h) => h.status === filter);
  }, [homeCollections, filter]);

  const openNew = () => {
    setEditing(null);
    setForm({
      patientId: '',
      patientName: '',
      patientMobile: '',
      address: '',
      landmark: '',
      scheduledDate: todayISO(),
      scheduledSlot: '08:00 AM - 10:00 AM',
      requestedTests: [],
      assignedStaffId: '',
      status: 'scheduled',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (h: HomeCollection) => {
    setEditing(h);
    setForm({
      patientId: h.patientId || '',
      patientName: h.patientName,
      patientMobile: h.patientMobile,
      address: h.address,
      landmark: h.landmark || '',
      scheduledDate: h.scheduledDate,
      scheduledSlot: h.scheduledSlot,
      requestedTests: h.requestedTests || [],
      assignedStaffId: h.assignedStaffId || '',
      status: h.status,
      notes: h.notes || '',
    });
    setModalOpen(true);
  };

  const handleSelectPatient = (pid: string) => {
    const p = patients.find((x) => x.id === pid);
    if (!p) {
      setForm((f) => ({ ...f, patientId: '' }));
      return;
    }
    setForm((f) => ({
      ...f,
      patientId: p.id,
      patientName: p.name,
      patientMobile: p.mobile,
      address: p.address || f.address,
    }));
  };

  const toggleReqTest = (code: string) => {
    setForm((f) => ({
      ...f,
      requestedTests: f.requestedTests.includes(code)
        ? f.requestedTests.filter((c) => c !== code)
        : [...f.requestedTests, code],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim() || !form.patientMobile.trim() || !form.address.trim()) {
      pushToast('error', 'Patient name, mobile, and collection address are required.');
      return;
    }

    const staff = staffUsers.find((u) => u.uid === form.assignedStaffId);
    setSubmitting(true);
    try {
      await saveHomeCollection(
        {
          patientId: form.patientId || undefined,
          patientName: form.patientName.trim(),
          patientMobile: form.patientMobile.trim(),
          address: form.address.trim(),
          landmark: form.landmark.trim() || undefined,
          scheduledDate: form.scheduledDate,
          scheduledSlot: form.scheduledSlot,
          requestedTests: form.requestedTests,
          assignedStaffId: staff?.uid || undefined,
          assignedStaffName: staff?.displayName || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
        },
        editing?.id
      );
      setModalOpen(false);
    } catch {
      pushToast('error', 'Could not save home collection appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickAdvanceStatus = async (h: HomeCollection, nextStatus: HomeCollection['status']) => {
    await saveHomeCollection(
      {
        patientId: h.patientId,
        patientName: h.patientName,
        patientMobile: h.patientMobile,
        address: h.address,
        landmark: h.landmark,
        scheduledDate: h.scheduledDate,
        scheduledSlot: h.scheduledSlot,
        requestedTests: h.requestedTests,
        assignedStaffId: h.assignedStaffId,
        assignedStaffName: h.assignedStaffName,
        status: nextStatus,
        bookingId: h.bookingId,
        notes: h.notes,
      },
      h.id
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Home Sample Collection
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Schedule patient doorstep visits, assign phlebotomists, and track sample delivery
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Schedule Home Visit
        </button>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl w-fit max-w-full">
        {HC_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              filter === f.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Home className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No home collection visits found</p>
          <p className="text-xs text-slate-500 mt-1">
            Schedule a patient home collection to dispatch a phlebotomist.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((h) => (
            <div
              key={h.id}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-base text-slate-900">{h.patientName}</div>
                    <div className="text-xs font-mono text-slate-500">{h.patientMobile}</div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold capitalize whitespace-nowrap ${
                      h.status === 'delivered_to_lab'
                        ? 'bg-emerald-50 text-emerald-800'
                        : h.status === 'cancelled'
                        ? 'bg-rose-50 text-rose-800'
                        : 'bg-sky-50 text-sky-800'
                    }`}
                  >
                    {h.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {h.address}
                    {h.landmark ? ` (${h.landmark})` : ''}
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">
                    {h.scheduledDate} · {h.scheduledSlot}
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Assigned: {h.assignedStaffName || 'Unassigned'}</span>
                </div>

                {h.requestedTests && h.requestedTests.length > 0 && (
                  <div className="text-xs text-sky-800 font-mono">
                    Tests: {h.requestedTests.join(', ')}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                {h.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => quickAdvanceStatus(h, 'en_route')}
                    className="flex-1 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                  >
                    Mark En Route
                  </button>
                )}
                {h.status === 'en_route' && (
                  <button
                    type="button"
                    onClick={() => quickAdvanceStatus(h, 'collected')}
                    className="flex-1 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                  >
                    Mark Collected
                  </button>
                )}
                {h.status === 'collected' && (
                  <button
                    type="button"
                    onClick={() => quickAdvanceStatus(h, 'delivered_to_lab')}
                    className="flex-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Deliver to Lab
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(h)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit / Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Update Home Collection' : 'Schedule Home Collection'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Link Existing Patient (Optional)
                </label>
                <select
                  value={form.patientId}
                  onChange={(e) => handleSelectPatient(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">New / Walk-in Home Patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.patientCode} · {p.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.patientName}
                    onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.patientMobile}
                    onChange={(e) => setForm({ ...form, patientMobile: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Collection Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="House / Flat No, Street, Area"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Time Slot *
                  </label>
                  <select
                    value={form.scheduledSlot}
                    onChange={(e) => setForm({ ...form, scheduledSlot: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="07:00 AM - 08:30 AM">07:00 AM - 08:30 AM (Fasting)</option>
                    <option value="08:00 AM - 10:00 AM">08:00 AM - 10:00 AM</option>
                    <option value="10:00 AM - 12:00 PM">10:00 AM - 12:00 PM</option>
                    <option value="12:00 PM - 02:00 PM">12:00 PM - 02:00 PM</option>
                    <option value="04:00 PM - 06:00 PM">04:00 PM - 06:00 PM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assign Staff / Phlebotomist
                  </label>
                  <select
                    value={form.assignedStaffId}
                    onChange={(e) => setForm({ ...form, assignedStaffId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Unassigned</option>
                    {staffUsers
                      .filter((u) => u.status === 'active')
                      .map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as HomeCollection['status'] })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="en_route">En Route</option>
                    <option value="collected">Collected</option>
                    <option value="delivered_to_lab">Delivered to Lab</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Requested Tests
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {tests
                    .filter((t) => t.isActive)
                    .map((t) => {
                      const active = form.requestedTests.includes(t.code);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleReqTest(t.code)}
                          className={`px-2.5 py-1 rounded text-xs font-mono border ${
                            active
                              ? 'border-sky-700 bg-sky-50 text-sky-900 font-semibold'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {t.code}
                        </button>
                      );
                    })}
                </div>
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
                  {submitting ? 'Saving...' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
