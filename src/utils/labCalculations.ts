import type { LabTest, ReportParameterResult, ResultFlag, TestParameter } from '../types/lab';

export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(safe);
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthPrefix(): string {
  return todayISO().slice(0, 7);
}

export function generatePatientCode(existingCount: number): string {
  const year = new Date().getFullYear();
  const seq = String(existingCount + 1).padStart(4, '0');
  return `MCL-${year}-${seq}`;
}

export function generateAccessionNo(existingCount: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(3, '0');
  return `ACC-${yy}${mm}${dd}-${seq}`;
}

export function generateReceiptNo(existingCount: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `RCPT-${yy}${mm}-${seq}`;
}

export function getTubeColorForSample(sampleType: string): string {
  const lower = sampleType.toLowerCase();
  if (lower.includes('edta')) return 'Purple (EDTA)';
  if (lower.includes('fluoride')) return 'Grey (Fluoride)';
  if (lower.includes('citrate')) return 'Blue (Citrate)';
  if (lower.includes('serum') || lower.includes('sst')) return 'Red / Yellow (SST)';
  if (lower.includes('urine')) return 'Sterile Urine Container';
  return 'Standard Bio-Container';
}

export function formatReferenceRange(param: TestParameter, gender?: string): string {
  const isFemale = gender?.toLowerCase() === 'female';
  const min = isFemale && param.refMinFemale !== undefined ? param.refMinFemale : param.refMinMale;
  const max = isFemale && param.refMaxFemale !== undefined ? param.refMaxFemale : param.refMaxMale;

  if (min !== undefined && max !== undefined) {
    return `${min} - ${max}`;
  }
  if (min !== undefined) return `>= ${min}`;
  if (max !== undefined) return `<= ${max}`;
  return param.refText || 'See Remarks';
}

export function evaluateFlag(
  valueStr: string,
  param: TestParameter | undefined,
  gender?: string
): ResultFlag {
  if (!param || param.inputType !== 'number') return 'normal';
  const num = Number(valueStr);
  if (valueStr.trim() === '' || Number.isNaN(num)) return 'normal';

  const isFemale = gender?.toLowerCase() === 'female';
  const min = isFemale && param.refMinFemale !== undefined ? param.refMinFemale : param.refMinMale;
  const max = isFemale && param.refMaxFemale !== undefined ? param.refMaxFemale : param.refMaxMale;

  if (min !== undefined && num < min) {
    if (min > 0 && num < min * 0.65) return 'critical';
    return 'low';
  }
  if (max !== undefined && num > max) {
    if (max > 0 && num > max * 1.6) return 'critical';
    return 'high';
  }
  return 'normal';
}

/**
 * Evaluates automatic validated clinical formulas across a test group's parameters.
 * Supported formula keys:
 * - INDIRECT_BILI: total_bili - direct_bili
 * - GLOBULIN: total_protein - albumin
 * - AG_RATIO: albumin / globulin
 * - BUN: urea * 0.467
 * - VLDL: triglycerides / 5
 * - LDL_FRIEDEWALD: total_chol - hdl - (triglycerides / 5)
 * - CHOL_HDL_RATIO: total_chol / hdl
 * - EAG_HBA1C: 28.7 * hba1c - 46.7
 * - MCV_CALC: (pcv * 10) / rbc
 * - MCH_CALC: (hb * 10) / rbc
 * - MCHC_CALC: (hb * 100) / pcv
 */
export function applyAutomaticCalculations(
  params: ReportParameterResult[],
  testDef: LabTest | undefined,
  gender?: string
): ReportParameterResult[] {
  const byKey: Record<string, number> = {};
  for (const p of params) {
    const n = Number(p.value);
    if (p.value.trim() !== '' && Number.isFinite(n)) {
      byKey[p.key] = n;
    }
  }

  // First pass compute derived values
  const updated = params.map((p) => {
    const def = testDef?.parameters.find((d) => d.key === p.key);
    const formula = p.formula || def?.formula;
    let nextVal = p.value;

    if (formula === 'INDIRECT_BILI' && byKey.total_bili !== undefined && byKey.direct_bili !== undefined) {
      nextVal = Math.max(0, byKey.total_bili - byKey.direct_bili).toFixed(2);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'GLOBULIN' && byKey.total_protein !== undefined && byKey.albumin !== undefined) {
      nextVal = Math.max(0, byKey.total_protein - byKey.albumin).toFixed(2);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'BUN' && byKey.urea !== undefined) {
      nextVal = (byKey.urea * 0.467).toFixed(1);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'VLDL' && byKey.triglycerides !== undefined) {
      nextVal = (byKey.triglycerides / 5).toFixed(1);
      byKey[p.key] = Number(nextVal);
    } else if (
      formula === 'LDL_FRIEDEWALD' &&
      byKey.total_chol !== undefined &&
      byKey.hdl !== undefined &&
      byKey.triglycerides !== undefined &&
      byKey.triglycerides <= 400
    ) {
      nextVal = Math.max(0, byKey.total_chol - byKey.hdl - byKey.triglycerides / 5).toFixed(1);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'CHOL_HDL_RATIO' && byKey.total_chol !== undefined && byKey.hdl && byKey.hdl > 0) {
      nextVal = (byKey.total_chol / byKey.hdl).toFixed(2);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'EAG_HBA1C' && byKey.hba1c !== undefined) {
      nextVal = (28.7 * byKey.hba1c - 46.7).toFixed(1);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'MCV_CALC' && byKey.pcv !== undefined && byKey.rbc && byKey.rbc > 0) {
      nextVal = ((byKey.pcv * 10) / byKey.rbc).toFixed(1);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'MCH_CALC' && byKey.hb !== undefined && byKey.rbc && byKey.rbc > 0) {
      nextVal = ((byKey.hb * 10) / byKey.rbc).toFixed(1);
      byKey[p.key] = Number(nextVal);
    } else if (formula === 'MCHC_CALC' && byKey.hb !== undefined && byKey.pcv && byKey.pcv > 0) {
      nextVal = ((byKey.hb * 100) / byKey.pcv).toFixed(1);
      byKey[p.key] = Number(nextVal);
    }

    return {
      ...p,
      value: nextVal,
      flag: evaluateFlag(nextVal, def, gender),
    };
  });

  // Second pass for chained ratios like AG_RATIO (depends on globulin)
  return updated.map((p) => {
    const def = testDef?.parameters.find((d) => d.key === p.key);
    const formula = p.formula || def?.formula;
    if (formula === 'AG_RATIO' && byKey.albumin !== undefined && byKey.globulin && byKey.globulin > 0) {
      const val = (byKey.albumin / byKey.globulin).toFixed(2);
      return { ...p, value: val, flag: evaluateFlag(val, def, gender) };
    }
    return p;
  });
}

export function buildWhatsAppUrl(mobile: string, message: string): string {
  const digits = mobile.replace(/\D/g, '');
  const formatted = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

export function buildSmsUrl(mobile: string, message: string): string {
  const cleaned = mobile.replace(/[^\d+]/g, '');
  return `sms:${cleaned}?body=${encodeURIComponent(message)}`;
}
