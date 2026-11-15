export type UserRole = 'admin' | 'manager' | 'receptionist' | 'technician' | 'staff';

export type ModuleId =
  | 'dashboard'
  | 'patients'
  | 'bookings'
  | 'samples'
  | 'reports'
  | 'tests'
  | 'billing'
  | 'accounts'
  | 'home_collection'
  | 'doctors'
  | 'staff'
  | 'notifications'
  | 'analytics'
  | 'settings';

export const ALL_MODULES: { id: ModuleId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'patients', label: 'Patients' },
  { id: 'bookings', label: 'Test Booking' },
  { id: 'samples', label: 'Sample Tracking' },
  { id: 'reports', label: 'Lab Reports' },
  { id: 'tests', label: 'Test Catalog' },
  { id: 'billing', label: 'Billing & Receipts' },
  { id: 'accounts', label: 'Accounts & Cashbook' },
  { id: 'home_collection', label: 'Home Collection' },
  { id: 'doctors', label: 'Referring Doctors' },
  { id: 'staff', label: 'Staff & Attendance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'analytics', label: 'Reports & Analytics' },
  { id: 'settings', label: 'Settings & Security' },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, ModuleId[]> = {
  admin: ALL_MODULES.map((m) => m.id),
  manager: [
    'dashboard',
    'patients',
    'bookings',
    'samples',
    'reports',
    'tests',
    'billing',
    'accounts',
    'home_collection',
    'doctors',
    'staff',
    'notifications',
    'analytics',
  ],
  receptionist: [
    'dashboard',
    'patients',
    'bookings',
    'samples',
    'reports',
    'billing',
    'home_collection',
    'doctors',
    'notifications',
  ],
  technician: [
    'dashboard',
    'patients',
    'samples',
    'reports',
    'tests',
    'home_collection',
    'notifications',
  ],
  staff: [
    'dashboard',
    'patients',
    'samples',
    'home_collection',
    'notifications',
  ],
};

export interface UserAccount {
  id: string;
  uid: string;
  displayName: string;
  role: UserRole;
  department?: string;
  status: 'active' | 'inactive';
  permissions: ModuleId[];
  inviteId?: string;
  avatarUrl?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateContact {
  uid: string;
  email: string;
  phone?: string;
  address?: string;
  updatedAt: unknown;
}

export interface StaffInvite {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  permissions: ModuleId[];
  createdBy: string;
  createdAt: unknown;
}

export interface Patient {
  id: string;
  patientCode: string;
  name: string;
  age: number;
  ageUnit: 'Years' | 'Months' | 'Days';
  gender: 'Male' | 'Female' | 'Other';
  mobile: string;
  address?: string;
  bloodGroup?: string;
  referringDoctorId?: string;
  referringDoctorName?: string;
  notes?: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TestParameter {
  key: string;
  name: string;
  unit: string;
  refMinMale?: number;
  refMaxMale?: number;
  refMinFemale?: number;
  refMaxFemale?: number;
  refText?: string;
  inputType: 'number' | 'text';
  formula?: string;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  department: string;
  sampleType: string;
  price: number;
  turnaroundHours?: number;
  parameters: TestParameter[];
  isActive: boolean;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BookingTestItem {
  testId: string;
  testCode: string;
  testName: string;
  price: number;
  department: string;
  sampleType: string;
}

export interface Booking {
  id: string;
  accessionNo: string;
  barcodeValue: string;
  patientId: string;
  patientCode?: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  patientMobile?: string;
  doctorId?: string;
  doctorName?: string;
  testItems: BookingTestItem[];
  subtotal: number;
  discount: number;
  discountReason?: string;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  sampleStatus: 'pending_collection' | 'collected' | 'received' | 'processing' | 'completed';
  reportStatus: 'pending' | 'entered' | 'verified' | 'approved';
  collectionType: 'walk_in' | 'home_collection';
  bookingDate: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Sample {
  id: string;
  bookingId: string;
  accessionNo: string;
  barcodeValue: string;
  patientId: string;
  patientName: string;
  sampleType: string;
  tubeColor?: string;
  status: 'pending_collection' | 'collected' | 'received' | 'processing' | 'completed' | 'rejected';
  collectedBy?: string;
  collectedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export type ResultFlag = 'normal' | 'low' | 'high' | 'critical';

export interface ReportParameterResult {
  key: string;
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag: ResultFlag;
  formula?: string;
}

export interface ReportTestGroup {
  testId: string;
  testCode: string;
  testName: string;
  department: string;
  parameters: ReportParameterResult[];
}

export interface LabReport {
  id: string;
  bookingId: string;
  accessionNo: string;
  patientId: string;
  patientCode?: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  doctorName?: string;
  results: ReportTestGroup[];
  status: 'pending' | 'entered' | 'verified' | 'approved';
  clinicalNotes?: string;
  enteredBy?: string;
  enteredByName?: string;
  verifiedBy?: string;
  verifiedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Payment {
  id: string;
  receiptNo: string;
  bookingId: string;
  accessionNo: string;
  patientId: string;
  patientName: string;
  amount: number;
  method: 'cash' | 'upi' | 'card' | 'bank';
  referenceNo?: string;
  notes?: string;
  paymentDate: string;
  receivedBy: string;
  receivedByName?: string;
  createdAt: unknown;
}

export interface CashbookEntry {
  id: string;
  entryDate: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank';
  referenceId?: string;
  recordedBy: string;
  recordedByName?: string;
  createdAt: unknown;
}

export interface HomeCollection {
  id: string;
  patientId?: string;
  patientName: string;
  patientMobile: string;
  address: string;
  landmark?: string;
  scheduledDate: string;
  scheduledSlot: string;
  requestedTests?: string[];
  assignedStaffId?: string;
  assignedStaffName?: string;
  status: 'scheduled' | 'en_route' | 'collected' | 'delivered_to_lab' | 'cancelled';
  bookingId?: string;
  notes?: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Doctor {
  id: string;
  name: string;
  qualification?: string;
  specialization?: string;
  clinicName?: string;
  mobile?: string;
  email?: string;
  commissionPercent?: number;
  isActive: boolean;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Attendance {
  id: string;
  staffId: string;
  staffName: string;
  role?: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'present' | 'half_day' | 'absent' | 'on_leave';
  notes?: string;
  createdBy: string;
  updatedAt: unknown;
}

export interface NotificationLog {
  id: string;
  patientId?: string;
  patientName: string;
  mobile: string;
  channel: 'whatsapp' | 'sms';
  eventType: 'booking' | 'payment' | 'report_ready' | 'home_collection';
  message: string;
  status: 'queued' | 'dispatched';
  referenceId?: string;
  sentBy: string;
  createdAt: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  module: string;
  targetId?: string;
  summary: string;
  createdAt: unknown;
}

export interface LabSettings {
  labName: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  regNumber?: string;
  gstNumber?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryTitle?: string;
  reportHeaderColor?: string;
  reportFooterNote?: string;
  showBarcodeOnReport?: boolean;
  showQrOnReport?: boolean;
  logoDataUrl?: string;
  signatureDataUrl?: string;
  lastBackupAt?: string;
  updatedBy: string;
  updatedAt: unknown;
}

export const FIELD_LIMITS = {
  NAME_MAX: 120,
  MOBILE_MAX: 24,
  ADDRESS_MAX: 300,
  NOTES_MAX: 500,
  CLINICAL_NOTES_MAX: 1000,
  ID_PATTERN: /^[a-zA-Z0-9_-]{1,128}$/,
} as const;
