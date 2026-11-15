import * as XLSX from 'xlsx';
import type { Booking, CashbookEntry, Patient } from '../types/lab';
import { isNativePlatform, saveOrShareBlob } from './nativeBridge';

export function exportBusinessReportExcel(
  periodLabel: string,
  bookings: Booking[],
  entries: CashbookEntry[],
  patients: Patient[]
): void {
  const wb = XLSX.utils.book_new();

  const bookingsRows = bookings.map((b) => ({
    AccessionNo: b.accessionNo,
    Date: b.bookingDate,
    Patient: b.patientName,
    PatientCode: b.patientCode || '',
    Mobile: b.patientMobile || '',
    Doctor: b.doctorName || 'Walk-in',
    Tests: b.testItems.map((t) => t.testCode).join(', '),
    Subtotal: b.subtotal,
    Discount: b.discount,
    NetAmount: b.netAmount,
    PaidAmount: b.paidAmount,
    DueAmount: b.dueAmount,
    PaymentStatus: b.paymentStatus,
    SampleStatus: b.sampleStatus,
    ReportStatus: b.reportStatus,
  }));

  const cashbookRows = entries.map((e) => ({
    Date: e.entryDate,
    Type: e.type,
    Category: e.category,
    Description: e.description,
    Method: e.paymentMethod,
    Amount: e.amount,
    RecordedBy: e.recordedByName || '',
  }));

  const patientRows = patients.map((p) => ({
    PatientID: p.patientCode,
    Name: p.name,
    Age: `${p.age} ${p.ageUnit}`,
    Gender: p.gender,
    Mobile: p.mobile,
    Doctor: p.referringDoctorName || '',
    Address: p.address || '',
  }));

  const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  const summaryRows = [
    { Metric: 'Report Period', Value: periodLabel },
    { Metric: 'Total Bookings', Value: bookings.length },
    { Metric: 'Total Net Billed (INR)', Value: bookings.reduce((s, b) => s + b.netAmount, 0) },
    { Metric: 'Total Collected (INR)', Value: bookings.reduce((s, b) => s + b.paidAmount, 0) },
    { Metric: 'Total Outstanding Due (INR)', Value: bookings.reduce((s, b) => s + b.dueAmount, 0) },
    { Metric: 'Cashbook Income (INR)', Value: totalIncome },
    { Metric: 'Cashbook Expenses (INR)', Value: totalExpense },
    { Metric: 'Net Profit / Loss (INR)', Value: totalIncome - totalExpense },
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bookingsRows), 'Bookings');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cashbookRows), 'Cashbook');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patientRows), 'Patients');

  const fileName = `MCL_Report_${periodLabel.replace(/\s+/g, '_')}.xlsx`;
  if (isNativePlatform()) {
    const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    void saveOrShareBlob({
      fileName,
      blob,
      title: `MasterLab Excel Report (${periodLabel})`,
      text: `Master Computerized Laboratory Spreadsheet (${periodLabel})`,
    });
  } else {
    XLSX.writeFile(wb, fileName);
  }
}
