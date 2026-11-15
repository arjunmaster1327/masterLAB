import React, { useMemo, useState } from 'react';
import { Edit3, FlaskConical, Plus, Search, Trash2, X } from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { LabTest, TestParameter } from '../types/lab';
import { formatCurrency } from '../utils/labCalculations';

const DEPARTMENTS = [
  'All',
  'Hematology',
  'Biochemistry',
  'Endocrinology',
  'Clinical Pathology',
  'Immunology',
  'Serology',
  'Microbiology',
  'Custom',
];

const FORMULA_OPTIONS = [
  { value: '', label: 'Manual Entry' },
  { value: 'INDIRECT_BILI', label: 'Indirect Bilirubin (Total - Direct)' },
  { value: 'GLOBULIN', label: 'Globulin (Total Protein - Albumin)' },
  { value: 'AG_RATIO', label: 'A/G Ratio (Albumin / Globulin)' },
  { value: 'BUN', label: 'BUN (Urea × 0.467)' },
  { value: 'VLDL', label: 'VLDL (Triglycerides / 5)' },
  { value: 'LDL_FRIEDEWALD', label: 'LDL (Friedewald Formula)' },
  { value: 'CHOL_HDL_RATIO', label: 'Total / HDL Cholesterol Ratio' },
  { value: 'EAG_HBA1C', label: 'eAG from HbA1c' },
  { value: 'MCV_CALC', label: 'MCV ((PCV × 10) / RBC)' },
  { value: 'MCH_CALC', label: 'MCH ((Hb × 10) / RBC)' },
  { value: 'MCHC_CALC', label: 'MCHC ((Hb × 100) / PCV)' },
];

export const TestsModule: React.FC = () => {
  const { tests, effectiveRole, saveTest, deleteTest, pushToast } = useLab();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManage = effectiveRole === 'admin' || effectiveRole === 'manager';

  const [form, setForm] = useState({
    code: '',
    name: '',
    department: 'Biochemistry',
    sampleType: 'Serum (SST)',
    price: '300',
    turnaroundHours: '6',
    isActive: true,
  });

  const [parameters, setParameters] = useState<TestParameter[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tests.filter((t) => {
      const matchDept = deptFilter === 'All' || t.department === deptFilter;
      const matchQ =
        !q ||
        t.code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q);
      return matchDept && matchQ;
    });
  }, [tests, search, deptFilter]);

  const openNew = () => {
    setEditing(null);
    setForm({
      code: '',
      name: '',
      department: 'Custom',
      sampleType: 'Serum (SST)',
      price: '300',
      turnaroundHours: '6',
      isActive: true,
    });
    setParameters([
      {
        key: 'param_1',
        name: 'Primary Value',
        unit: 'mg/dL',
        refMinMale: 0,
        refMaxMale: 100,
        refMinFemale: 0,
        refMaxFemale: 100,
        inputType: 'number',
      },
    ]);
    setModalOpen(true);
  };

  const openEdit = (t: LabTest) => {
    setEditing(t);
    setForm({
      code: t.code,
      name: t.name,
      department: t.department,
      sampleType: t.sampleType,
      price: String(t.price),
      turnaroundHours: String(t.turnaroundHours ?? 6),
      isActive: t.isActive,
    });
    setParameters(t.parameters.map((p) => ({ ...p })));
    setModalOpen(true);
  };

  const addParameterRow = () => {
    setParameters((prev) => [
      ...prev,
      {
        key: `param_${prev.length + 1}_${Date.now().toString(36).slice(-3)}`,
        name: '',
        unit: '',
        inputType: 'number',
      },
    ]);
  };

  const updateParam = (index: number, patch: Partial<TestParameter>) => {
    setParameters((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeParam = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      pushToast('error', 'Test code and test name are required.');
      return;
    }
    const cleanParams = parameters
      .filter((p) => p.name.trim())
      .map((p, idx) => ({
        ...p,
        key: p.key.trim() || `p_${idx + 1}`,
        name: p.name.trim(),
        unit: p.unit.trim() || '-',
      }));

    setSubmitting(true);
    try {
      await saveTest(
        {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          department: form.department,
          sampleType: form.sampleType.trim(),
          price: Math.max(0, Number(form.price) || 0),
          turnaroundHours: Math.max(0, Number(form.turnaroundHours) || 0),
          parameters: cleanParams,
          isActive: form.isActive,
        },
        editing?.id
      );
      setModalOpen(false);
    } catch {
      pushToast('error', 'Failed to save test definition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Test Catalog & Pricing</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tests.length} diagnostic panels & unlimited custom tests with configurable reference ranges
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Custom Test
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test code or investigation name..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-sky-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
          {DEPARTMENTS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDeptFilter(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                deptFilter === d
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FlaskConical className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No tests match your filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Investigation</th>
                  <th className="px-5 py-3">Department / Sample</th>
                  <th className="px-5 py-3">Parameters</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3">Status</th>
                  {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-sky-800 whitespace-nowrap">
                      {t.code}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {t.department} · {t.sampleType}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 tabular-nums">
                      {t.parameters.length} params
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(t.price)}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium whitespace-nowrap">
                      <span className={t.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                        {t.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                            title="Configure Test"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          {effectiveRole === 'admin' && (
                            <button
                              type="button"
                              onClick={() => deleteTest(t.id)}
                              className="rounded-lg border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              title="Delete Test"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Test Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? `Configure Test: ${editing.name}` : 'Create Custom Laboratory Test'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Test Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. CRP"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Test Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. C-Reactive Protein (Quantitative)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-600 focus:outline-none"
                  >
                    {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sample Type</label>
                  <input
                    type="text"
                    required
                    value={form.sampleType}
                    onChange={(e) => setForm({ ...form, sampleType: e.target.value })}
                    placeholder="Serum (SST) / EDTA / Urine"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Price (INR)</label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      required
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">TAT (hrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.turnaroundHours}
                      onChange={(e) => setForm({ ...form, turnaroundHours: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="test-active-check"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-700"
                />
                <label htmlFor="test-active-check" className="text-xs font-medium text-slate-700">
                  Available for patient booking
                </label>
              </div>

              {/* Parameters Config */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Parameters & Reference Ranges ({parameters.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addParameterRow}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Parameter
                  </button>
                </div>

                <div className="space-y-2.5">
                  {parameters.map((p, idx) => (
                    <div
                      key={p.key + idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border border-slate-200 rounded-xl p-3 bg-slate-50/50"
                    >
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          placeholder="Parameter Name"
                          value={p.name}
                          onChange={(e) => updateParam(idx, { name: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <input
                          type="text"
                          placeholder="Unit"
                          value={p.unit}
                          onChange={(e) => updateParam(idx, { unit: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <select
                          value={p.inputType}
                          onChange={(e) =>
                            updateParam(idx, { inputType: e.target.value as 'number' | 'text' })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-xs"
                        >
                          <option value="number">Num</option>
                          <option value="text">Text</option>
                        </select>
                      </div>
                      {p.inputType === 'number' ? (
                        <>
                          <div className="md:col-span-2 flex gap-1">
                            <input
                              type="number"
                              step="any"
                              placeholder="M Min"
                              value={p.refMinMale ?? ''}
                              onChange={(e) =>
                                updateParam(idx, {
                                  refMinMale: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                            />
                            <input
                              type="number"
                              step="any"
                              placeholder="M Max"
                              value={p.refMaxMale ?? ''}
                              onChange={(e) =>
                                updateParam(idx, {
                                  refMaxMale: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                            />
                          </div>
                          <div className="md:col-span-2 flex gap-1">
                            <input
                              type="number"
                              step="any"
                              placeholder="F Min"
                              value={p.refMinFemale ?? ''}
                              onChange={(e) =>
                                updateParam(idx, {
                                  refMinFemale:
                                    e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                            />
                            <input
                              type="number"
                              step="any"
                              placeholder="F Max"
                              value={p.refMaxFemale ?? ''}
                              onChange={(e) =>
                                updateParam(idx, {
                                  refMaxFemale:
                                    e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                              className="w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="md:col-span-4">
                          <input
                            type="text"
                            placeholder="Expected Normal Text (e.g. Absent / Clear)"
                            value={p.refText || ''}
                            onChange={(e) => updateParam(idx, { refText: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <select
                          value={p.formula || ''}
                          onChange={(e) =>
                            updateParam(idx, { formula: e.target.value || undefined })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        >
                          {FORMULA_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeParam(idx)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                          title="Remove parameter"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
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
                  {submitting ? 'Saving...' : 'Save Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
