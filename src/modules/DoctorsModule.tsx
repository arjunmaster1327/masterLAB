import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Stethoscope, X } from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { Doctor } from '../types/lab';
import { formatCurrency } from '../utils/labCalculations';

export const DoctorsModule: React.FC = () => {
  const { doctors, bookings, saveDoctor, pushToast } = useLab();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    qualification: '',
    specialization: '',
    clinicName: '',
    mobile: '',
    email: '',
    commissionPercent: '10',
    isActive: true,
  });

  const doctorStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          (d.clinicName || '').toLowerCase().includes(q) ||
          (d.specialization || '').toLowerCase().includes(q)
      )
      .map((d) => {
        const refBookings = bookings.filter((b) => b.doctorId === d.id);
        const totalBusiness = refBookings.reduce((s, b) => s + b.netAmount, 0);
        const estCommission = totalBusiness * ((d.commissionPercent || 0) / 100);
        return {
          doctor: d,
          referrals: refBookings.length,
          totalBusiness,
          estCommission,
        };
      });
  }, [doctors, bookings, search]);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: '',
      qualification: 'MBBS, MD',
      specialization: 'General Physician',
      clinicName: '',
      mobile: '',
      email: '',
      commissionPercent: '10',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (d: Doctor) => {
    setEditing(d);
    setForm({
      name: d.name,
      qualification: d.qualification || '',
      specialization: d.specialization || '',
      clinicName: d.clinicName || '',
      mobile: d.mobile || '',
      email: d.email || '',
      commissionPercent: String(d.commissionPercent ?? 0),
      isActive: d.isActive,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      pushToast('error', 'Doctor name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await saveDoctor(
        {
          name: form.name.trim(),
          qualification: form.qualification.trim() || undefined,
          specialization: form.specialization.trim() || undefined,
          clinicName: form.clinicName.trim() || undefined,
          mobile: form.mobile.trim() || undefined,
          email: form.email.trim() || undefined,
          commissionPercent: Math.max(0, Math.min(100, Number(form.commissionPercent) || 0)),
          isActive: form.isActive,
        },
        editing?.id
      );
      setModalOpen(false);
    } catch {
      pushToast('error', 'Failed to save doctor profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Referring Doctors & Statistics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track referring physicians, clinic partners, patient referral counts, and referral revenue
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Referring Doctor
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doctor name, clinic, or specialization..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-sky-600 focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {doctorStats.length === 0 ? (
          <div className="p-10 text-center">
            <Stethoscope className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No referring doctors added yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Add doctors to link patient referrals and automatically track doctor-wise business.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Clinic / Contact</th>
                  <th className="px-5 py-3 text-right">Referrals</th>
                  <th className="px-5 py-3 text-right">Billed Volume</th>
                  <th className="px-5 py-3 text-right">Commission % / Est.</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctorStats.map(({ doctor, referrals, totalBusiness, estCommission }) => (
                  <tr key={doctor.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{doctor.name}</div>
                      <div className="text-xs text-slate-500">
                        {doctor.qualification || '-'} · {doctor.specialization || 'Physician'}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      <div>{doctor.clinicName || '-'}</div>
                      <div className="font-mono">{doctor.mobile || '-'}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {referrals}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-sky-800 tabular-nums">
                      {formatCurrency(totalBusiness)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                      <div>{doctor.commissionPercent ?? 0}%</div>
                      <div className="text-slate-500">{formatCurrency(estCommission)}</div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(doctor)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? 'Edit Doctor Profile' : 'Add Referring Doctor'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Doctor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Dr. Anil Mehta"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Qualification
                  </label>
                  <input
                    type="text"
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Clinic / Hospital
                  </label>
                  <input
                    type="text"
                    value={form.clinicName}
                    onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Referral Share (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={form.commissionPercent}
                    onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    id="doc-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="doc-active" className="text-xs font-medium text-slate-700">
                    Active Referring Partner
                  </label>
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
                  {submitting ? 'Saving...' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
