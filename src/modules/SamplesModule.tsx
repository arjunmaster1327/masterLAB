import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FlaskConical,
  Search,
  TestTube,
} from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { Sample } from '../types/lab';
import { BarcodeCanvas, PrintStickerButton } from '../components/BarcodeCanvas';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

const SAMPLE_FILTERS: { id: 'all' | Sample['status']; label: string }[] = [
  { id: 'all', label: 'All Samples' },
  { id: 'pending_collection', label: 'Pending Collection' },
  { id: 'collected', label: 'Collected' },
  { id: 'received', label: 'Received' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

export const SamplesModule: React.FC = () => {
  const { samples, updateSampleStatus, pushToast } = useLab();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Sample['status']>('all');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [rejectingSample, setRejectingSample] = useState<Sample | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return samples.filter((s) => {
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      const matchQ =
        !q ||
        s.accessionNo.toLowerCase().includes(q) ||
        s.barcodeValue.toLowerCase().includes(q) ||
        s.patientName.toLowerCase().includes(q) ||
        s.sampleType.toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
  }, [samples, search, statusFilter]);

  const handleBarcodeDetected = (code: string) => {
    const normalized = code.trim().toLowerCase();
    setSearch(code.trim());
    const found = samples.find(
      (s) =>
        s.barcodeValue.toLowerCase() === normalized ||
        s.accessionNo.toLowerCase() === normalized
    );
    if (!found) {
      pushToast('error', `No specimen found matching barcode ${code}.`);
      return;
    }
    pushToast('info', `Matched specimen ${found.barcodeValue} (${found.patientName}).`);
  };

  const getNextAction = (
    status: Sample['status']
  ): { label: string; next: Sample['status'] } | null => {
    if (status === 'pending_collection') return { label: 'Mark Collected', next: 'collected' };
    if (status === 'collected') return { label: 'Receive in Lab', next: 'received' };
    if (status === 'received') return { label: 'Start Processing', next: 'processing' };
    if (status === 'processing') return { label: 'Mark Completed', next: 'completed' };
    return null;
  };

  const confirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSample || !rejectReason.trim()) return;
    await updateSampleStatus(rejectingSample, 'rejected', {
      rejectionReason: rejectReason.trim(),
    });
    setRejectingSample(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sample Collection & Barcode Tracking
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate specimen barcodes, scan tubes via camera/USB, and track chain of custody
          </p>
        </div>
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Camera className="h-4 w-4" />
          Scan Barcode
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search barcode, accession, patient, or tube..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-sky-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 rounded-xl">
          {SAMPLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === f.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <TestTube className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">No specimen records in this view</p>
          <p className="text-xs text-slate-500 mt-1">
            Specimens are created automatically when a patient test booking is confirmed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const action = getNextAction(s.status);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs font-semibold text-sky-800">
                        {s.barcodeValue}
                      </div>
                      <div className="text-base font-semibold text-slate-900 mt-0.5">
                        {s.patientName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {s.sampleType} · {s.tubeColor || 'Standard Tube'}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold capitalize whitespace-nowrap ${
                        s.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800'
                          : s.status === 'rejected'
                          ? 'bg-rose-50 text-rose-800'
                          : s.status === 'processing'
                          ? 'bg-sky-50 text-sky-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {s.status === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : s.status === 'rejected' ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <FlaskConical className="h-3.5 w-3.5" />
                      )}
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 flex justify-center">
                    <BarcodeCanvas value={s.barcodeValue} height={34} width={1.4} />
                  </div>

                  <div className="text-xs text-slate-500 space-y-0.5">
                    {s.collectedBy && (
                      <div>
                        Collected by {s.collectedBy}{' '}
                        {s.collectedAt ? `· ${new Date(s.collectedAt).toLocaleTimeString()}` : ''}
                      </div>
                    )}
                    {s.receivedBy && (
                      <div>
                        Received by {s.receivedBy}{' '}
                        {s.receivedAt ? `· ${new Date(s.receivedAt).toLocaleTimeString()}` : ''}
                      </div>
                    )}
                    {s.rejectionReason && (
                      <div className="text-rose-700 font-medium">
                        Rejected: {s.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  {action && (
                    <button
                      type="button"
                      onClick={() => updateSampleStatus(s, action.next)}
                      className="flex-1 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap"
                    >
                      {action.label}
                    </button>
                  )}
                  <PrintStickerButton
                    accessionNo={s.barcodeValue}
                    patientName={s.patientName}
                    sampleType={s.sampleType}
                    tubeColor={s.tubeColor}
                  />
                  {s.status !== 'completed' && s.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => setRejectingSample(s)}
                      className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      {rejectingSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={confirmReject}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Reject Specimen ({rejectingSample.barcodeValue})
            </h3>
            <p className="text-xs text-slate-500">
              Specify reason for rejection (e.g., hemolyzed sample, insufficient quantity, clotted EDTA).
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for sample rejection..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingSample(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
