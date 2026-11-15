import React, { useState } from 'react';
import { MessageSquare, Send, Smartphone } from 'lucide-react';
import { useLab } from '../context/LabContext';
import type { NotificationLog } from '../types/lab';
import { buildSmsUrl, buildWhatsAppUrl, formatCurrency } from '../utils/labCalculations';

export const NotificationsModule: React.FC = () => {
  const { bookings, notifications, settings, logNotification, pushToast } = useLab();

  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [eventType, setEventType] = useState<NotificationLog['eventType']>('report_ready');
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [mobile, setMobile] = useState('');
  const [patientName, setPatientName] = useState('');
  const [message, setMessage] = useState('');

  const applyTemplate = (bookingId: string, ev: NotificationLog['eventType']) => {
    const b = bookings.find((x) => x.id === bookingId);
    if (!b) return;
    setSelectedBookingId(b.id);
    setPatientName(b.patientName);
    setMobile(b.patientMobile || '');
    setEventType(ev);

    if (ev === 'booking') {
      setMessage(
        `Hello ${b.patientName}, your lab booking (${b.accessionNo}) at ${settings.labName} is confirmed for ${b.testItems.map((t) => t.testCode).join(', ')}. Net Bill: ${formatCurrency(b.netAmount)}.`
      );
    } else if (ev === 'payment') {
      setMessage(
        `Payment Update - ${settings.labName}\nPatient: ${b.patientName} (${b.accessionNo})\nPaid: ${formatCurrency(b.paidAmount)} | Balance Due: ${formatCurrency(b.dueAmount)}.`
      );
    } else if (ev === 'report_ready') {
      setMessage(
        `Hello ${b.patientName}, your diagnostic lab report (${b.accessionNo}) from ${settings.labName} is ready (${b.reportStatus.toUpperCase()}). Please collect or request your PDF report.`
      );
    } else {
      setMessage(
        `Hello ${b.patientName}, our phlebotomist from ${settings.labName} is scheduled for your home sample collection.`
      );
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !message.trim() || !patientName.trim()) {
      pushToast('error', 'Patient name, mobile number, and message are required.');
      return;
    }

    const url =
      channel === 'whatsapp'
        ? buildWhatsAppUrl(mobile.trim(), message.trim())
        : buildSmsUrl(mobile.trim(), message.trim());
    window.open(url, '_blank', 'noopener,noreferrer');

    await logNotification({
      patientName: patientName.trim(),
      mobile: mobile.trim(),
      channel,
      eventType,
      message: message.trim(),
      status: 'dispatched',
      referenceId: selectedBookingId || undefined,
    });
    pushToast('success', `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} notification dispatched & logged.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          WhatsApp & SMS Notifications
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Send instant booking, payment receipt, and report completion alerts to patients
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleDispatch}
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Compose Patient Alert</h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Load from Recent Booking
            </label>
            <select
              value={selectedBookingId}
              onChange={(e) => applyTemplate(e.target.value, eventType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Select booking to auto-fill...</option>
              {bookings.slice(0, 40).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.accessionNo} · {b.patientName} ({b.patientMobile || 'No Mobile'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Channel</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border ${
                    channel === 'whatsapp'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('sms')}
                  className={`inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border ${
                    channel === 'sms'
                      ? 'border-sky-700 bg-sky-50 text-sky-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  SMS
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Template</label>
              <select
                value={eventType}
                onChange={(e) => {
                  const ev = e.target.value as NotificationLog['eventType'];
                  setEventType(ev);
                  if (selectedBookingId) applyTemplate(selectedBookingId, ev);
                }}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs bg-white"
              >
                <option value="booking">Booking Confirmation</option>
                <option value="payment">Payment Receipt</option>
                <option value="report_ready">Report Ready</option>
                <option value="home_collection">Home Collection</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Patient Name *
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
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
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Message *</label>
            <textarea
              rows={4}
              required
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write notification message..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
          >
            <Send className="h-4 w-4" />
            Dispatch {channel === 'whatsapp' ? 'via WhatsApp' : 'via SMS'}
          </button>
        </form>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Notification Dispatch History ({notifications.length})
            </h2>
          </div>
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No notifications dispatched yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      {n.patientName} · <span className="font-mono">{n.mobile}</span>
                    </span>
                    <span className="font-mono uppercase text-sky-800 font-semibold">
                      {n.channel} · {n.eventType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-line">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
