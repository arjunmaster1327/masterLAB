import React, { useEffect, useState } from 'react';
import { Download, Save, ShieldAlert, Upload } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { todayISO } from '../utils/labCalculations';
import { saveOrShareBlob } from '../utils/nativeBridge';

function compressImageFile(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const SettingsModule: React.FC = () => {
  const {
    settings,
    patients,
    tests,
    bookings,
    labReports,
    cashbook,
    doctors,
    auditLogs,
    saveSettings,
    restoreFromBackupJson,
    pushToast,
  } = useLab();

  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoDataUrl' | 'signatureDataUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, field === 'logoDataUrl' ? 240 : 320);
      if (dataUrl.length > 140000) {
        pushToast('error', 'Image is too large even after compression. Choose a simpler graphic.');
        return;
      }
      setForm((prev) => ({ ...prev, [field]: dataUrl }));
    } catch {
      pushToast('error', 'Could not process selected image.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings({
        labName: form.labName,
        tagline: form.tagline,
        address: form.address,
        phone: form.phone,
        email: form.email,
        regNumber: form.regNumber,
        gstNumber: form.gstNumber,
        authorizedSignatoryName: form.authorizedSignatoryName,
        authorizedSignatoryTitle: form.authorizedSignatoryTitle,
        reportHeaderColor: form.reportHeaderColor,
        reportFooterNote: form.reportFooterNote,
        showBarcodeOnReport: form.showBarcodeOnReport,
        logoDataUrl: form.logoDataUrl,
        signatureDataUrl: form.signatureDataUrl,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      app: 'MASTER COMPUTERIZED LABORATORY',
      settings,
      tests,
      doctors,
      patients,
      bookings,
      labReports,
      cashbook,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    await saveOrShareBlob({
      fileName: `MCL_Backup_${todayISO()}.json`,
      blob,
      title: `MasterLab Backup (${todayISO()})`,
      text: 'Full laboratory database backup (JSON)',
    });
    await saveSettings({ lastBackupAt: new Date().toISOString() });
    pushToast('success', 'Full encrypted cloud JSON backup exported.');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await restoreFromBackupJson(text);
    } catch {
      pushToast('error', 'Backup restore failed. Ensure valid MCL JSON backup file.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings, Report Templates & Security
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure laboratory identity, logo, authorized signature, database backups, and security audit logs
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-sm font-semibold text-slate-900">Laboratory Profile & PDF Template</h2>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Laboratory Name</label>
            <input
              type="text"
              required
              value={form.labName}
              onChange={(e) => setForm({ ...form, labName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tagline / Subtitle</label>
            <input
              type="text"
              value={form.tagline || ''}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Registration / License No</label>
            <input
              type="text"
              value={form.regNumber || ''}
              onChange={(e) => setForm({ ...form, regNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Report Header Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.reportHeaderColor || '#0f4c81'}
                onChange={(e) => setForm({ ...form, reportHeaderColor: e.target.value })}
                className="h-9 w-14 rounded border border-slate-300"
              />
              <span className="font-mono text-xs text-slate-600">
                {form.reportHeaderColor || '#0f4c81'}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Authorized Signatory Name
            </label>
            <input
              type="text"
              value={form.authorizedSignatoryName || ''}
              onChange={(e) => setForm({ ...form, authorizedSignatoryName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Signatory Designation
            </label>
            <input
              type="text"
              value={form.authorizedSignatoryTitle || ''}
              onChange={(e) => setForm({ ...form, authorizedSignatoryTitle: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Report Footer Disclaimer
            </label>
            <input
              type="text"
              value={form.reportFooterNote || ''}
              onChange={(e) => setForm({ ...form, reportFooterNote: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Upload Laboratory Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'logoDataUrl')}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-800"
            />
            {form.logoDataUrl && (
              <img
                src={form.logoDataUrl}
                alt="Lab Logo Preview"
                className="mt-2 h-12 w-12 rounded border border-slate-200 object-contain"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Upload Authorized Signature
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'signatureDataUrl')}
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-800"
            />
            {form.signatureDataUrl && (
              <img
                src={form.signatureDataUrl}
                alt="Signature Preview"
                className="mt-2 h-12 rounded border border-slate-200 object-contain bg-white px-2"
              />
            )}
          </div>
        </div>
      </form>

      {/* Backup & Restore */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Database Backup & Restore
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cloud Firestore syncs automatically in real time with offline IndexedDB caching.
            {settings.lastBackupAt
              ? ` Last manual backup: ${new Date(settings.lastBackupAt).toLocaleString()}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download Full Backup (JSON)
          </button>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            Restore Config Backup
            <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
          </label>
        </div>
      </div>

      {/* Security Audit Logs */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-sky-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Immutable Security Audit Logs ({auditLogs.length})
          </h2>
        </div>
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No audit entries yet.</div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2.5">Actor</th>
                  <th className="px-5 py-2.5">Module</th>
                  <th className="px-5 py-2.5">Action</th>
                  <th className="px-5 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.slice(0, 50).map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-2.5 font-medium text-slate-900">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="px-5 py-2.5 text-slate-600">{log.module}</td>
                    <td className="px-5 py-2.5 font-mono text-sky-800">{log.action}</td>
                    <td className="px-5 py-2.5 text-slate-600">{log.summary}</td>
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
