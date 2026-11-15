import React, { useMemo, useState } from 'react';
import {
  Edit3,
  FileText,
  History,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { Patient } from '../types/lab';
import { formatCurrency } from '../utils/labCalculations';
import { generateLabReportPdf } from '../utils/pdfGenerator';

export const PatientsModule: React.FC = () => {
  const {
    patients,
    doctors,
    bookings,
    labReports,
    settings,
    effectiveRole,
    savePatient,
    deletePatient,
    pushToast,
  } = useLab();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    age: '30',
    ageUnit: 'Years' as Patient['ageUnit'],
    gender: 'Male' as Patient['gender'],
    mobile: '',
    address: '',
    bloodGroup: '',
    referringDoctorId: '',
    notes: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.patientCode.toLowerCase().includes(q) ||
        p.mobile.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: '',
      age: '30',
      ageUnit: 'Years',
      gender: 'Male',
      mobile: '',
      address: '',
      bloodGroup: '',
      referringDoctorId: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({
      name: p.name,
      age: String(p.age),
      ageUnit: p.ageUnit,
      gender: p.gender,
      mobile: p.mobile,
      address: p.address || '',
      bloodGroup: p.bloodGroup || '',
      referringDoctorId: p.referringDoctorId || '',
      notes: p.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) {
      pushToast('error', 'Patient name and mobile number are required.');
      return;
    }
    const ageNum = Number(form.age);
    if (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      pushToast('error', 'Please enter a valid age between 0 and 150.');
      return;
    }

    const docObj = doctors.find((d) => d.id === form.referringDoctorId);
    setSubmitting(true);
    try {
      await savePatient(
        {
          name: form.name.trim(),
          age: ageNum,
          ageUnit: form.ageUnit,
          gender: form.gender,
          mobile: form.mobile.trim(),
          address: form.address.trim() || undefined,
          bloodGroup: form.bloodGroup.trim() || undefined,
          referringDoctorId: docObj?.id || undefined,
          referringDoctorName: docObj?.name || undefined,
          notes: form.notes.trim() || undefined,
        },
        editing?.id
      );
      setModalOpen(false);
    } catch {
      pushToast('error', 'Could not save patient record.');
    } finally {
      setSubmitting(false);
    }
  };

  const patientBookings = useMemo(() => {
    if (!historyPatient) return [];
    return bookings.filter((b) => b.patientId === historyPatient.id);
  }, [historyPatient, bookings]);

  const patientReports = useMemo(() => {
    if (!historyPatient) return [];
    return labReports.filter((r) => r.patientId === historyPatient.id);
  }, [historyPatient, labReports]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patient Registry</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {patients.length} registered patients · Auto-generated patient IDs & clinical history
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Register Patient
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Patient ID, name, or mobile..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
        />
      </div>

      {/* Patients Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No matching patients found</p>
            <p className="text-xs text-slate-500 mt-1">
              Register a new patient to generate an automatic MCL patient ID.
            </p>
            <button
              type="button"
              onClick={openNew}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Patient
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Patient ID</th>
                  <th className="px-5 py-3">Name & Demographics</th>
                  <th className="px-5 py-3">Mobile</th>
                  <th className="px-5 py-3">Referring Doctor</th>
                  <th className="px-5 py-3">Visits</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const visitCount = bookings.filter((b) => b.patientId === p.id).length;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-sky-800 whitespace-nowrap">
                        {p.patientCode}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.age} {p.ageUnit} · {p.gender}
                          {p.bloodGroup ? ` · ${p.bloodGroup}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {p.mobile}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        {p.referringDoctorName || 'Walk-in / Self'}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-700 tabular-nums">
                        {visitCount}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryPatient(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <History className="h-3.5 w-3.5 text-sky-700" />
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                            title="Edit Patient"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {effectiveRole === 'admin' && (
                            <button
                              type="button"
                              onClick={() => deletePatient(p.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              title="Delete Patient"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
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

      {/* Register / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? `Edit Patient (${editing.patientCode})` : 'Register New Patient'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Rajesh Kumar Sharma"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Age *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={150}
                      required
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-sky-600 focus:outline-none"
                    />
                    <select
                      value={form.ageUnit}
                      onChange={(e) =>
                        setForm({ ...form, ageUnit: e.target.value as Patient['ageUnit'] })
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white focus:border-sky-600 focus:outline-none"
                    >
                      <option value="Years">Years</option>
                      <option value="Months">Months</option>
                      <option value="Days">Days</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm({ ...form, gender: e.target.value as Patient['gender'] })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-600 focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={24}
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-600 focus:outline-none"
                  >
                    <option value="">Unknown / Not Specified</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Referring Doctor
                  </label>
                  <select
                    value={form.referringDoctorId}
                    onChange={(e) => setForm({ ...form, referringDoctorId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-600 focus:outline-none"
                  >
                    <option value="">Self / Walk-in</option>
                    {doctors
                      .filter((d) => d.isActive)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.specialization ? `(${d.specialization})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    maxLength={300}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street, locality, city"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Clinical Notes / History
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editing ? 'Update Patient' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient History Drawer */}
      {historyPatient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{historyPatient.name}</h2>
                <p className="text-xs text-slate-500 font-mono">
                  {historyPatient.patientCode} · {historyPatient.age} {historyPatient.ageUnit} ·{' '}
                  {historyPatient.gender} · {historyPatient.mobile}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryPatient(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Previous Bookings ({patientBookings.length})
                </h3>
                {patientBookings.length === 0 ? (
                  <p className="text-xs text-slate-500">No bookings recorded for this patient.</p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {patientBookings.map((b) => (
                      <div key={b.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-mono font-semibold text-sky-800">
                            {b.accessionNo} · {b.bookingDate}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {b.testItems.map((t) => t.testName).join(', ')}
                          </div>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(b.netAmount)}
                          </div>
                          <div className="text-slate-500 capitalize">{b.paymentStatus}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Lab Reports ({patientReports.length})
                </h3>
                {patientReports.length === 0 ? (
                  <p className="text-xs text-slate-500">No lab reports generated yet.</p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {patientReports.map((r) => (
                      <div key={r.id} className="p-3.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-mono font-semibold text-slate-900">
                            {r.accessionNo} · {r.status.toUpperCase()}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {r.results.map((g) => g.testCode).join(', ')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => generateLabReportPdf(r, settings, 'download')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
