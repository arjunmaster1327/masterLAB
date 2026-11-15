import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import type { Booking, CashbookEntry, LabReport, LabSettings, Payment } from '../types/lab';
import { formatCurrency } from './labCalculations';
import { isNativePlatform, saveOrShareBlob } from './nativeBridge';
import defaultLogoUrl from '../assets/images/lab_logo_crest_1794746419559.jpg';

function loadImageDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function generateBarcodeDataUrl(value: string): string | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: 1.8,
      height: 36,
      displayValue: true,
      fontSize: 11,
      margin: 2,
      background: '#ffffff',
      lineColor: '#0f172a',
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function generateLabReportPdf(
  report: LabReport,
  settings: LabSettings,
  mode: 'download' | 'print' = 'download'
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerColor = settings.reportHeaderColor || '#0f4c81';

  // Top Header Band
  doc.setFillColor(headerColor);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Logo
  const logoSrc = settings.logoDataUrl || defaultLogoUrl;
  const logoData = await loadImageDataUrl(logoSrc);
  if (logoData) {
    doc.setFillColor('#ffffff');
    doc.roundedRect(12, 5, 20, 20, 2, 2, 'F');
    doc.addImage(logoData, 'PNG', 13, 6, 18, 18);
  }

  // Lab Name & Contact
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(settings.labName || 'MASTER COMPUTERIZED LABORATORY', 36, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(settings.tagline || 'ISO Certified Clinical Diagnostic & Pathology Centre', 36, 17);
  doc.text(
    `${settings.address || ''} · Ph: ${settings.phone || ''} · ${settings.email || ''}`.replace(/^ · /, ''),
    36,
    22
  );
  if (settings.regNumber) {
    doc.text(`Reg. No: ${settings.regNumber}`, 36, 26.5);
  }

  // Patient & Report Metadata Box
  doc.setDrawColor('#cbd5e1');
  doc.setFillColor('#f8fafc');
  doc.roundedRect(12, 34, pageWidth - 24, 28, 2, 2, 'FD');

  doc.setTextColor('#0f172a');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Name:', 16, 41);
  doc.text('Patient ID:', 16, 47);
  doc.text('Age / Gender:', 16, 53);
  doc.text('Referred By:', 16, 59);

  doc.setFont('helvetica', 'normal');
  doc.text(report.patientName, 44, 41);
  doc.text(report.patientCode || report.patientId, 44, 47);
  doc.text(`${report.patientAge || '-'} / ${report.patientGender || '-'}`, 44, 53);
  doc.text(report.doctorName || 'Self / Walk-in', 44, 59);

  doc.setFont('helvetica', 'bold');
  doc.text('Accession No:', 108, 41);
  doc.text('Report Status:', 108, 47);
  doc.text('Verified By:', 108, 53);
  doc.text('Approved At:', 108, 59);

  doc.setFont('helvetica', 'normal');
  doc.text(report.accessionNo, 134, 41);
  doc.text(report.status.toUpperCase(), 134, 47);
  doc.text(report.verifiedByName || '-', 134, 53);
  doc.text(report.approvedAt ? new Date(report.approvedAt).toLocaleString() : 'Pending Approval', 134, 59);

  // Barcode on top-right
  if (settings.showBarcodeOnReport !== false) {
    const barcodeUrl = generateBarcodeDataUrl(report.accessionNo);
    if (barcodeUrl) {
      doc.addImage(barcodeUrl, 'PNG', pageWidth - 52, 35.5, 38, 12);
    }
  }

  let cursorY = 68;

  for (const group of report.results) {
    if (cursorY > 245) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFillColor('#e0f2fe');
    doc.rect(12, cursorY, pageWidth - 24, 7, 'F');
    doc.setTextColor('#0f4c81');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`${group.testName}  (${group.department})`, 15, cursorY + 4.8);
    cursorY += 8;

    const rows = group.parameters.map((p) => {
      const flagLabel =
        p.flag === 'critical'
          ? 'CRITICAL'
          : p.flag === 'high'
          ? 'HIGH'
          : p.flag === 'low'
          ? 'LOW'
          : 'Normal';
      return [p.name, p.value || '-', p.unit || '-', p.refRange || '-', flagLabel];
    });

    autoTable(doc, {
      startY: cursorY,
      margin: { left: 12, right: 12 },
      head: [['Investigation / Parameter', 'Observed Value', 'Unit', 'Reference Range', 'Flag']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        textColor: [15, 23, 42],
      },
      didParseCell: (data) => {
        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 4)) {
          const rowRaw = data.row.raw as string[];
          const flagText = rowRaw[4];
          if (flagText === 'HIGH' || flagText === 'CRITICAL') {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          } else if (flagText === 'LOW') {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursorY + 20;
    cursorY = finalY + 6;
  }

  if (report.clinicalNotes) {
    if (cursorY > 250) {
      doc.addPage();
      cursorY = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor('#0f172a');
    doc.text('Clinical Interpretation / Notes:', 12, cursorY);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(report.clinicalNotes, pageWidth - 24);
    doc.text(wrapped, 12, cursorY + 4.5);
    cursorY += 6 + wrapped.length * 4;
  }

  // Signature & Footer
  const sigY = Math.max(cursorY + 8, 252);
  if (sigY > 270) {
    doc.addPage();
  }
  const finalSigY = sigY > 270 ? 245 : sigY;

  if (settings.signatureDataUrl) {
    const sigImg = await loadImageDataUrl(settings.signatureDataUrl);
    if (sigImg) {
      doc.addImage(sigImg, 'PNG', pageWidth - 60, finalSigY - 14, 42, 12);
    }
  }

  doc.setDrawColor('#94a3b8');
  doc.line(pageWidth - 65, finalSigY, pageWidth - 12, finalSigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#0f172a');
  doc.text(settings.authorizedSignatoryName || 'Dr. Pathologist / Lab Director', pageWidth - 65, finalSigY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(settings.authorizedSignatoryTitle || 'Consultant Pathologist (MD)', pageWidth - 65, finalSigY + 8.5);

  doc.setFontSize(7.5);
  doc.setTextColor('#64748b');
  doc.text(
    settings.reportFooterNote ||
      'End of Report · Values outside reference range are flagged. Correlate clinically.',
    12,
    287
  );

  const fileName = `${report.accessionNo}_${report.patientName.replace(/\s+/g, '_')}_Report.pdf`;
  if (isNativePlatform()) {
    const pdfBlob = doc.output('blob');
    await saveOrShareBlob({
      fileName,
      blob: pdfBlob,
      title: `Lab Report ${report.accessionNo}`,
      text: `Diagnostic Report for ${report.patientName} (${report.accessionNo})`,
    });
  } else if (mode === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  } else {
    doc.save(fileName);
  }
}

export async function generateInvoicePdf(
  booking: Booking,
  payments: Payment[],
  settings: LabSettings,
  mode: 'download' | 'print' = 'download'
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(settings.reportHeaderColor || '#0f4c81');
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(settings.labName || 'MASTER COMPUTERIZED LABORATORY', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${settings.address || ''} · Ph: ${settings.phone || ''}`.replace(/^ · /, ''), 14, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TAX INVOICE / RECEIPT', pageWidth - 64, 15);

  doc.setTextColor('#0f172a');
  doc.setFontSize(9.5);
  doc.text(`Patient: ${booking.patientName} (${booking.patientCode || booking.patientId})`, 14, 35);
  doc.text(`Mobile: ${booking.patientMobile || '-'}`, 14, 41);
  doc.text(`Referred By: ${booking.doctorName || 'Self / Walk-in'}`, 14, 47);

  doc.text(`Accession No: ${booking.accessionNo}`, 120, 35);
  doc.text(`Booking Date: ${booking.bookingDate}`, 120, 41);
  doc.text(`Payment Status: ${booking.paymentStatus.toUpperCase()}`, 120, 47);

  autoTable(doc, {
    startY: 54,
    margin: { left: 14, right: 14 },
    head: [['#', 'Test Code', 'Investigation Name', 'Department', 'Amount (INR)']],
    body: booking.testItems.map((item, idx) => [
      String(idx + 1),
      item.testCode,
      item.testName,
      item.department,
      formatCurrency(item.price),
    ]),
    headStyles: { fillColor: [15, 76, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
  });

  const afterTestsY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 90) + 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Subtotal: ${formatCurrency(booking.subtotal)}`, 130, afterTestsY);
  doc.text(`Discount: - ${formatCurrency(booking.discount)}`, 130, afterTestsY + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`Net Payable: ${formatCurrency(booking.netAmount)}`, 130, afterTestsY + 13);
  doc.setTextColor('#15803d');
  doc.text(`Amount Paid: ${formatCurrency(booking.paidAmount)}`, 130, afterTestsY + 19);
  doc.setTextColor(booking.dueAmount > 0 ? '#b91c1c' : '#0f172a');
  doc.text(`Balance Due: ${formatCurrency(booking.dueAmount)}`, 130, afterTestsY + 25);

  if (payments.length > 0) {
    autoTable(doc, {
      startY: afterTestsY + 34,
      margin: { left: 14, right: 14 },
      head: [['Receipt No', 'Date', 'Method', 'Reference', 'Amount']],
      body: payments.map((p) => [
        p.receiptNo,
        p.paymentDate,
        p.method.toUpperCase(),
        p.referenceNo || '-',
        formatCurrency(p.amount),
      ]),
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      styles: { fontSize: 8.5 },
    });
  }

  const fileName = `${booking.accessionNo}_Invoice.pdf`;
  if (isNativePlatform()) {
    const pdfBlob = doc.output('blob');
    await saveOrShareBlob({
      fileName,
      blob: pdfBlob,
      title: `Invoice ${booking.accessionNo}`,
      text: `Tax Invoice for ${booking.patientName} (${booking.accessionNo})`,
    });
  } else if (mode === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  } else {
    doc.save(fileName);
  }
}

export function generateFinancialReportPdf(
  title: string,
  periodLabel: string,
  entries: CashbookEntry[],
  bookings: Booking[],
  settings: LabSettings
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalIncome = entries.filter((e) => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const totalBilled = bookings.reduce((sum, b) => sum + b.netAmount, 0);
  const totalDue = bookings.reduce((sum, b) => sum + b.dueAmount, 0);

  doc.setFillColor(settings.reportHeaderColor || '#0f4c81');
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(settings.labName || 'MASTER COMPUTERIZED LABORATORY', 14, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${title} (${periodLabel})`, 14, 18);

  doc.setTextColor('#0f172a');
  doc.setFontSize(9.5);
  doc.text(`Total Bookings: ${bookings.length}`, 14, 33);
  doc.text(`Total Billed: ${formatCurrency(totalBilled)}`, 70, 33);
  doc.text(`Outstanding Due: ${formatCurrency(totalDue)}`, 135, 33);

  doc.text(`Cashbook Income: ${formatCurrency(totalIncome)}`, 14, 40);
  doc.text(`Cashbook Expenses: ${formatCurrency(totalExpense)}`, 70, 40);
  doc.setFont('helvetica', 'bold');
  doc.text(`Net Profit / Loss: ${formatCurrency(netProfit)}`, 135, 40);

  autoTable(doc, {
    startY: 48,
    margin: { left: 14, right: 14 },
    head: [['Date', 'Type', 'Category', 'Description', 'Method', 'Amount']],
    body: entries.map((e) => [
      e.entryDate,
      e.type.toUpperCase(),
      e.category,
      e.description,
      e.paymentMethod.toUpperCase(),
      formatCurrency(e.amount),
    ]),
    headStyles: { fillColor: [15, 76, 129], textColor: [255, 255, 255] },
    styles: { fontSize: 8.5 },
  });

  const fileName = `MCL_Business_Report_${periodLabel.replace(/\s+/g, '_')}.pdf`;
  if (isNativePlatform()) {
    const pdfBlob = doc.output('blob');
    void saveOrShareBlob({
      fileName,
      blob: pdfBlob,
      title: `${title} (${periodLabel})`,
      text: `Business & Financial Report - ${periodLabel}`,
    });
  } else {
    doc.save(fileName);
  }
}
