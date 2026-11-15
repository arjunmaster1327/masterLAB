import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCheck,
  Lock,
  MessageSquare,
  Printer,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { LabReport, ReportTestGroup } from '../types/lab';
import {
  applyAutomaticCalculations,
  buildSmsUrl,
  buildWhatsAppUrl,
} from '../utils/labCalculations';
import { openExternalActionUrl } from '../utils/nativeBridge';
import { generateLabReportPdf } from '../utils/pdfGenerator';

const STATUS_TABS: { id: 'all' | LabReport['status']; label: string }[] = [
  { id: 'all', label: 'All Reports' },
  { id: 'pending', label: 'Pending Entry' },
  { id: 'entered', label: 'Entered' },
  { id: 'verified', label: 'Verified' },
  { id: 'approved', label: 'Approved' },
];

export const ReportsModule: React.FC = () => {
  const {
    labReports,
    tests,
    patients,
    settings,
    effectiveRole,
    saveLabReport,
    logNotification,
    pushToast,
  } = useLab();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LabReport['status']>('all');
  const [activeReport, setActiveReport] = useState<LabReport | null>(null);
  const [draftResults, setDraftResults] = useState<ReportTestGroup[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canEnterOrVerify =
    effectiveRole === 'admin' || effectiveRole === 'manager' || effectiveRole === 'technician';
  const canApprove = effectiveRole === 'admin' || effectiveRole === 'manager';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return labReports.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchQ =
        !q ||
        r.accessionNo.toLowerCase().includes(q) ||
        r.patientName.toLowerCase().includes(q) ||
        (r.patientCode || '').toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
  }, [labReports, search, statusFilter]);

  const openWorkbench = (report: LabReport) => {
    setActiveReport(report);
    setDraftResults(
      report.results.map((g) => ({
        ...g,
        parameters: g.parameters.map((p) => ({ ...p })),
      }))
    );
    setClinicalNotes(report.clinicalNotes || '');
  };

  const handleParamChange = (groupIdx: number, paramIdx: number, newValue: string) => {
    if (!activeReport) return;
    if (activeReport.status === 'approved' && effectiveRole !== 'admin') return;

    setDraftResults((prev) =>
      prev.map((group, gi) => {
        if (gi !== groupIdx) return group;
        const testDef = tests.find((t) => t.id === group.testId);
        const updatedParams = group.parameters.map((p, pi) =>
          pi === paramIdx ? { ...p, value: newValue } : p
        );
        const calculated = applyAutomaticCalculations(
          updatedParams,
          testDef,
          activeReport.patientGender
        );
        return { ...group, parameters: calculated };
      })
    );
  };

  const handleSaveStatus = async (nextStatus: LabReport['status']) => {
    if (!activeReport) return;
    setSaving(true);
    try {
      await saveLabReport(activeReport, {
        results: draftResults,
        status: nextStatus,
        clinicalNotes: clinicalNotes.trim() || undefined,
      });
      setActiveReport((prev) =>
        prev
          ? {
              ...prev,
              results: draftResults,
              status: nextStatus,
              clinicalNotes,
            }
          : null
      );
      if (nextStatus === 'approved') {
        setActiveReport(null);
      }
    } catch {
      pushToast('error', 'Failed to update lab report.');
    } finally {
      setSaving(false);
    }
  };

  const shareReport = async (report: LabReport, channel: 'whatsapp' | 'sms') => {
    const patient = patients.find((p) => p.id === report.patientId);
    const mobile = patient?.mobile;
    if (!mobile) {
      pushToast('error', 'Patient mobile number not found.');
      return;
    }

    const abnormalLines = report.results
      .flatMap((g) =>
        g.parameters
          .filter((p) => p.flag !== 'normal' && p.value)
          .map((p) => `${p.name}: ${p.value} ${p.unit} (${p.flag.toUpperCase()})`)
      )
      .slice(0, 5);

    const msg = `Hello ${report.patientName}, your diagnostic report (${report.accessionNo}) from ${settings.labName} is ${report.status.toUpperCase()}.${
      abnormalLines.length > 0 ? `\nKey findings:\n${abnormalLines.join('\n')}` : '\nAll tested parameters are ready for review.'
    }\nPlease collect or request your official PDF report.`;

    const url = channel === 'whatsapp' ? buildWhatsAppUrl(mobile, msg) : buildSmsUrl(mobile, msg);
    await openExternalActionUrl(url);
    await logNotification({
      patientId: report.patientId,
      patientName: report.patientName,
      mobile,
      channel,
      eventType: 'report_ready',
      message: msg,
      status: 'dispatched',
      referenceId: report.id,
    });
    pushToast('success', `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} notification logged.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Lab Reports & Result Verification
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Enter test results with auto-calculated formulas, abnormal flagging, pathologist approval, and PDF export
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accession no, patient name, or ID..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-sky-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatusFilter(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No laboratory reports in this status filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Accession</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Tests</th>
                  <th className="px-5 py-3">Abnormal Flags</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const abnormalCount = r.results
                    .flatMap((g) => g.parameters)
                    .filter((p) => p.flag !== 'normal').length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-sky-800 whitespace-nowrap">
                        {r.accessionNo}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{r.patientName}</div>
                        <div className="text-xs text-slate-500">
                          {r.patientAge || '-'} · {r.patientGender || '-'} ·{' '}
                          {r.doctorName || 'Self'}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        {r.results.map((g) => g.testCode).join(', ')}
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap">
                        {abnormalCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {abnormalCount} Flagged
                          </span>
                        ) : (
                          <span className="text-slate-500">Normal / Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold capitalize ${
                            r.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-800'
                              : r.status === 'verified'
                              ? 'bg-sky-50 text-sky-800'
                              : r.status === 'entered'
                              ? 'bg-indigo-50 text-indigo-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {r.status === 'approved' && <Lock className="h-3 w-3" />}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openWorkbench(r)}
                            className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                          >
                            {r.status === 'approved' ? 'View Report' : 'Enter Results'}
                          </button>
                          <button
                            type="button"
                            onClick={() => generateLabReportPdf(r, settings, 'download')}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            title="Download PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-sky-700" />
                            PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => generateLabReportPdf(r, settings, 'print')}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                            title="Print Report"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => shareReport(r, 'whatsapp')}
                            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-800 hover:bg-emerald-100"
                            title="Share via WhatsApp"
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

      {/* Result Entry & Verification Workbench Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-sky-800">
                    {activeReport.accessionNo}
                  </span>
                  <h2 className="text-base font-bold text-slate-900">{activeReport.patientName}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeReport.patientCode} · {activeReport.patientAge} ·{' '}
                  {activeReport.patientGender} · Ref: {activeReport.doctorName || 'Self'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReport(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeReport.status === 'approved' && effectiveRole !== 'admin' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0" />
                  This report is approved and locked by {activeReport.approvedByName || 'Pathologist'}.
                </div>
              )}

              {draftResults.map((group, gi) => (
                <div key={group.testId + gi} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-sky-50/70 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                    <div className="font-semibold text-sm text-sky-900">
                      {group.testName} ({group.testCode})
                    </div>
                    <div className="text-xs text-slate-600">{group.department}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Parameter</th>
                          <th className="px-4 py-2.5 w-48">Observed Value</th>
                          <th className="px-4 py-2.5">Unit</th>
                          <th className="px-4 py-2.5">Reference Range</th>
                          <th className="px-4 py-2.5">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.parameters.map((p, pi) => {
                          const isLocked =
                            activeReport.status === 'approved' && effectiveRole !== 'admin';
                          const isCalculated = Boolean(p.formula);
                          return (
                            <tr
                              key={p.key + pi}
                              className={
                                p.flag === 'critical'
                                  ? 'bg-rose-50/70'
                                  : p.flag === 'high' || p.flag === 'low'
                                  ? 'bg-amber-50/50'
                                  : ''
                              }
                            >
                              <td className="px-4 py-2.5 font-medium text-slate-800">
                                {p.name}
                                {isCalculated && (
                                  <span className="ml-2 text-[11px] font-normal text-sky-700">
                                    (Auto-Calculated)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  disabled={isLocked || !canEnterOrVerify}
                                  value={p.value}
                                  onChange={(e) => handleParamChange(gi, pi, e.target.value)}
                                  placeholder={isCalculated ? 'Auto' : 'Enter value'}
                                  className={`w-full rounded-lg border px-2.5 py-1.5 text-sm font-mono tabular-nums focus:outline-none ${
                                    p.flag === 'critical' || p.flag === 'high'
                                      ? 'border-rose-400 text-rose-800 font-bold bg-white'
                                      : p.flag === 'low'
                                      ? 'border-amber-400 text-amber-800 font-bold bg-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                />
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-600">{p.unit}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                                {p.refRange}
                              </td>
                              <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap">
                                {p.flag === 'critical' ? (
                                  <span className="text-rose-700">CRITICAL</span>
                                ) : p.flag === 'high' ? (
                                  <span className="text-rose-700">HIGH ↑</span>
                                ) : p.flag === 'low' ? (
                                  <span className="text-amber-700">LOW ↓</span>
                                ) : (
                                  <span className="text-emerald-700">Normal</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Clinical Interpretation / Pathologist Remarks
                </label>
                <textarea
                  rows={2}
                  disabled={activeReport.status === 'approved' && effectiveRole !== 'admin'}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Optional clinical remarks for the referring physician..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    generateLabReportPdf(
                      { ...activeReport, results: draftResults, clinicalNotes },
                      settings,
                      'download'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4 text-sky-700" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() =>
                    generateLabReportPdf(
                      { ...activeReport, results: draftResults, clinicalNotes },
                      settings,
                      'print'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4 text-slate-700" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => shareReport(activeReport, 'whatsapp')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </button>
              </div>

              {canEnterOrVerify &&
                (activeReport.status !== 'approved' || effectiveRole === 'admin') && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveStatus('entered')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <FileCheck className="h-4 w-4 text-sky-700" />
                      Save Draft
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveStatus('verified')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Verify Results
                    </button>
                    {canApprove && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveStatus('approved')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Approve & Lock
                      </button>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
