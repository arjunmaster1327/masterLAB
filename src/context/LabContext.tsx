import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  createSafeId,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  stripUndefined,
  testFirestoreConnection,
} from '../lib/firebase';
import { DEFAULT_LAB_TESTS } from '../data/defaultTests';
import {
  type Attendance,
  type AuditLog,
  type Booking,
  type BookingTestItem,
  type CashbookEntry,
  type Doctor,
  type HomeCollection,
  type LabReport,
  type LabSettings,
  type LabTest,
  type ModuleId,
  type NotificationLog,
  type Patient,
  type Payment,
  type ReportTestGroup,
  ROLE_DEFAULT_PERMISSIONS,
  type Sample,
  type StaffInvite,
  type UserAccount,
  type UserRole,
} from '../types/lab';
import {
  formatReferenceRange,
  generateAccessionNo,
  generatePatientCode,
  generateReceiptNo,
  getTubeColorForSample,
  todayISO,
} from '../utils/labCalculations';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface CreateBookingInput {
  patient: Patient;
  doctorId?: string;
  doctorName?: string;
  testItems: BookingTestItem[];
  discount: number;
  discountReason?: string;
  initialPaidAmount: number;
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank';
  paymentReference?: string;
  collectionType: 'walk_in' | 'home_collection';
}

interface LabContextValue {
  authUser: User | null;
  authLoading: boolean;
  userProfile: UserAccount | null;
  profileLoading: boolean;
  effectiveRole: UserRole;
  effectivePermissions: ModuleId[];
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  hasPermission: (module: ModuleId) => boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;

  // Collections
  patients: Patient[];
  tests: LabTest[];
  bookings: Booking[];
  samples: Sample[];
  labReports: LabReport[];
  payments: Payment[];
  cashbook: CashbookEntry[];
  homeCollections: HomeCollection[];
  doctors: Doctor[];
  attendance: Attendance[];
  notifications: NotificationLog[];
  auditLogs: AuditLog[];
  staffUsers: UserAccount[];
  staffInvites: StaffInvite[];
  settings: LabSettings;
  dataLoading: boolean;

  // Actions
  logAudit: (action: string, module: string, summary: string, targetId?: string) => Promise<void>;
  savePatient: (data: Omit<Patient, 'id' | 'patientCode' | 'createdBy' | 'createdAt' | 'updatedAt'>, existingId?: string) => Promise<Patient>;
  deletePatient: (id: string) => Promise<void>;
  saveTest: (data: Omit<LabTest, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>, existingId?: string) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  createBooking: (input: CreateBookingInput) => Promise<Booking>;
  collectPayment: (input: {
    booking: Booking;
    amount: number;
    method: 'cash' | 'upi' | 'card' | 'bank';
    referenceNo?: string;
    notes?: string;
  }) => Promise<Payment>;
  updateSampleStatus: (
    sample: Sample,
    status: Sample['status'],
    extra?: { rejectionReason?: string; notes?: string }
  ) => Promise<void>;
  saveLabReport: (
    report: LabReport,
    updates: {
      results: ReportTestGroup[];
      status: LabReport['status'];
      clinicalNotes?: string;
    }
  ) => Promise<void>;
  addCashbookEntry: (entry: Omit<CashbookEntry, 'id' | 'recordedBy' | 'recordedByName' | 'createdAt'>) => Promise<void>;
  deleteCashbookEntry: (id: string) => Promise<void>;
  saveHomeCollection: (
    data: Omit<HomeCollection, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  saveDoctor: (
    data: Omit<Doctor, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  recordAttendance: (
    data: Omit<Attendance, 'id' | 'createdBy' | 'updatedAt'>
  ) => Promise<void>;
  inviteStaff: (input: {
    email: string;
    displayName: string;
    role: UserRole;
    department?: string;
    permissions: ModuleId[];
  }) => Promise<void>;
  updateStaffAccount: (
    uid: string,
    updates: Partial<Pick<UserAccount, 'role' | 'status' | 'permissions' | 'department' | 'displayName'>>
  ) => Promise<void>;
  revokeStaffInvite: (inviteId: string) => Promise<void>;
  logNotification: (
    input: Omit<NotificationLog, 'id' | 'sentBy' | 'createdAt'>
  ) => Promise<void>;
  saveSettings: (updates: Partial<LabSettings>) => Promise<void>;
  restoreFromBackupJson: (jsonText: string) => Promise<void>;
}

const DEFAULT_SETTINGS: LabSettings = {
  labName: 'MASTER COMPUTERIZED LABORATORY',
  tagline: 'Precision Clinical Diagnostics & Pathology Centre',
  address: 'Medical Square, Main Hospital Road',
  phone: '+91 98000 00000',
  email: 'info@masterlab.diagnostic',
  regNumber: 'MCL-ISO-9001-2026',
  authorizedSignatoryName: 'Dr. Evelyn Reed, MD',
  authorizedSignatoryTitle: 'Chief Clinical Pathologist',
  reportHeaderColor: '#0f4c81',
  reportFooterNote: 'End of Report · Abnormal values are flagged. Please correlate clinically.',
  showBarcodeOnReport: true,
  showQrOnReport: false,
  updatedBy: 'system',
  updatedAt: '',
};

const LabContext = createContext<LabContextValue | null>(null);

export const LabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cashbook, setCashbook] = useState<CashbookEntry[]>([]);
  const [homeCollections, setHomeCollections] = useState<HomeCollection[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserAccount[]>([]);
  const [staffInvites, setStaffInvites] = useState<StaffInvite[]>([]);
  const [settings, setSettings] = useState<LabSettings>(DEFAULT_SETTINGS);
  const [dataLoading, setDataLoading] = useState(false);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = createSafeId('toast');
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Auth & User Profile Bootstrap
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserProfile(null);
        setPreviewRole(null);
        return;
      }

      setProfileLoading(true);
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          setUserProfile({ id: snap.id, ...snap.data() } as UserAccount);
        } else {
          const isBootstrap = user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
          let assignedRole: UserRole = isBootstrap ? 'admin' : 'staff';
          let assignedStatus: 'active' | 'inactive' = isBootstrap ? 'active' : 'inactive';
          let assignedPerms: ModuleId[] = isBootstrap ? ROLE_DEFAULT_PERMISSIONS.admin : ROLE_DEFAULT_PERMISSIONS.staff;
          let assignedDept = isBootstrap ? 'Administration' : 'General';
          let inviteId: string | undefined;

          if (!isBootstrap && user.email) {
            const inviteQ = query(
              collection(db, 'staffInvites'),
              where('email', '==', user.email.toLowerCase())
            );
            const inviteSnap = await getDocs(inviteQ);
            if (!inviteSnap.empty) {
              const invDoc = inviteSnap.docs[0];
              const invData = invDoc.data() as StaffInvite;
              assignedRole = invData.role;
              assignedStatus = 'active';
              assignedPerms = invData.permissions;
              assignedDept = invData.department || 'Laboratory';
              inviteId = invDoc.id;
            }
          }

          const newAccountPayload = stripUndefined({
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Lab Staff',
            role: assignedRole,
            department: assignedDept,
            status: assignedStatus,
            permissions: assignedPerms,
            inviteId,
            avatarUrl: user.photoURL || undefined,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await setDoc(userRef, newAccountPayload);
          await setDoc(doc(db, 'users', user.uid, 'private', 'contact'), {
            uid: user.uid,
            email: (user.email || '').toLowerCase(),
            updatedAt: serverTimestamp(),
          });

          const createdSnap = await getDoc(userRef);
          if (createdSnap.exists()) {
            setUserProfile({ id: createdSnap.id, ...createdSnap.data() } as UserAccount);
          }
        }
      } catch (error) {
        console.error('Profile initialization error:', error);
        pushToast('error', 'Failed to load staff profile permissions.');
      } finally {
        setProfileLoading(false);
      }
    });
    return () => unsub();
  }, [pushToast]);

  const isUserActive =
    !!authUser &&
    (userProfile?.status === 'active' ||
      authUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase());

  const actualRole: UserRole = userProfile?.role || (authUser?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? 'admin' : 'staff');
  const effectiveRole: UserRole = actualRole === 'admin' && previewRole ? previewRole : actualRole;

  const effectivePermissions: ModuleId[] = useMemo(() => {
    if (actualRole === 'admin' && previewRole) {
      return ROLE_DEFAULT_PERMISSIONS[previewRole];
    }
    if (userProfile?.permissions && userProfile.permissions.length > 0) {
      return userProfile.permissions;
    }
    return ROLE_DEFAULT_PERMISSIONS[effectiveRole];
  }, [actualRole, previewRole, userProfile, effectiveRole]);

  const hasPermission = useCallback(
    (module: ModuleId) => {
      if (effectiveRole === 'admin') return true;
      return effectivePermissions.includes(module);
    },
    [effectiveRole, effectivePermissions]
  );

  // Seed default test catalog & settings on first admin login
  useEffect(() => {
    if (!authUser || !isUserActive || actualRole !== 'admin') return;
    let cancelled = false;

    const seedDefaultsIfNeeded = async () => {
      try {
        const testsSnap = await getDocs(collection(db, 'tests'));
        if (testsSnap.empty && !cancelled) {
          const batch = writeBatch(db);
          for (const t of DEFAULT_LAB_TESTS) {
            const id = `test_${t.code.toLowerCase()}`;
            batch.set(doc(db, 'tests', id), {
              ...t,
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }

        const settingsRef = doc(db, 'settings', 'labProfile');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists() && !cancelled) {
          await setDoc(settingsRef, {
            ...DEFAULT_SETTINGS,
            updatedBy: authUser.uid,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Auto-seed skipped or failed:', err);
      }
    };

    seedDefaultsIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [authUser, isUserActive, actualRole]);

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!authUser || !isUserActive) {
      setPatients([]);
      setTests([]);
      setBookings([]);
      setSamples([]);
      setLabReports([]);
      setPayments([]);
      setCashbook([]);
      setHomeCollections([]);
      setDoctors([]);
      setAttendance([]);
      setNotifications([]);
      setAuditLogs([]);
      setStaffUsers([]);
      setStaffInvites([]);
      return;
    }

    setDataLoading(true);
    const unsubs: (() => void)[] = [];

    const listen = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      orderField?: string
    ) => {
      const q = orderField
        ? query(collection(db, colName), orderBy(orderField, 'desc'))
        : collection(db, colName);
      const u = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
          setter(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, colName)
      );
      unsubs.push(u);
    };

    listen<Patient>('patients', setPatients, 'createdAt');
    listen<LabTest>('tests', setTests, 'name');
    listen<Booking>('bookings', setBookings, 'createdAt');
    listen<Sample>('samples', setSamples, 'createdAt');
    listen<LabReport>('labReports', setLabReports, 'createdAt');
    listen<Payment>('payments', setPayments, 'createdAt');
    listen<CashbookEntry>('cashbook', setCashbook, 'createdAt');
    listen<HomeCollection>('homeCollections', setHomeCollections, 'createdAt');
    listen<Doctor>('doctors', setDoctors, 'name');
    listen<Attendance>('attendance', setAttendance, 'date');
    listen<NotificationLog>('notifications', setNotifications, 'createdAt');
    listen<UserAccount>('users', setStaffUsers, 'displayName');

    if (actualRole === 'admin' || actualRole === 'manager') {
      listen<AuditLog>('auditLogs', setAuditLogs, 'createdAt');
      listen<StaffInvite>('staffInvites', setStaffInvites, 'createdAt');
    }

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'labProfile'),
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as LabSettings) });
        }
        setDataLoading(false);
      },
      (err) => {
        setDataLoading(false);
        handleFirestoreError(err, OperationType.GET, 'settings/labProfile');
      }
    );
    unsubs.push(unsubSettings);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authUser, isUserActive, actualRole]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      pushToast('success', 'Signed in successfully.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sign-in cancelled or failed.';
      pushToast('error', msg);
    }
  }, [pushToast]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setPreviewRole(null);
    pushToast('info', 'Signed out of laboratory session.');
  }, [pushToast]);

  const logAudit = useCallback(
    async (action: string, module: string, summary: string, targetId?: string) => {
      if (!authUser) return;
      const logId = createSafeId('audit');
      try {
        await setDoc(
          doc(db, 'auditLogs', logId),
          stripUndefined({
            actorUid: authUser.uid,
            actorName: userProfile?.displayName || authUser.displayName || authUser.email || 'Staff',
            actorRole: actualRole,
            action,
            module,
            targetId,
            summary: summary.slice(0, 390),
            createdAt: serverTimestamp(),
          })
        );
      } catch (err) {
        console.error('Audit log write failed:', err);
      }
    },
    [authUser, userProfile, actualRole]
  );

  const savePatient = useCallback(
    async (
      data: Omit<Patient, 'id' | 'patientCode' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ): Promise<Patient> => {
      if (!authUser) throw new Error('Not authenticated');
      const id = existingId || createSafeId('pat');
      const path = `patients/${id}`;
      try {
        if (existingId) {
          await updateDoc(
            doc(db, 'patients', existingId),
            stripUndefined({
              ...data,
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('UPDATE_PATIENT', 'Patients', `Updated patient ${data.name}`, existingId);
          pushToast('success', `Patient ${data.name} updated.`);
          const existing = patients.find((p) => p.id === existingId)!;
          return { ...existing, ...data };
        } else {
          const patientCode = generatePatientCode(patients.length);
          const payload = stripUndefined({
            ...data,
            patientCode,
            createdBy: authUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'patients', id), payload);
          await logAudit('CREATE_PATIENT', 'Patients', `Registered patient ${data.name} (${patientCode})`, id);
          pushToast('success', `Patient registered (${patientCode}).`);
          return { id, ...(payload as Omit<Patient, 'id'>) };
        }
      } catch (err) {
        handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
      }
    },
    [authUser, patients, logAudit, pushToast]
  );

  const deletePatient = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'patients', id));
        await logAudit('DELETE_PATIENT', 'Patients', `Deleted patient record ${id}`, id);
        pushToast('info', 'Patient record removed.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `patients/${id}`);
      }
    },
    [logAudit, pushToast]
  );

  const saveTest = useCallback(
    async (
      data: Omit<LabTest, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      if (!authUser) throw new Error('Not authenticated');
      const id = existingId || createSafeId('test');
      try {
        if (existingId) {
          await updateDoc(
            doc(db, 'tests', existingId),
            stripUndefined({
              ...data,
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('UPDATE_TEST', 'Tests', `Updated test ${data.code} - ${data.name}`, existingId);
          pushToast('success', `Test ${data.name} updated.`);
        } else {
          await setDoc(
            doc(db, 'tests', id),
            stripUndefined({
              ...data,
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('CREATE_TEST', 'Tests', `Added new test ${data.code} - ${data.name}`, id);
          pushToast('success', `Test ${data.name} added to catalog.`);
        }
      } catch (err) {
        handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `tests/${id}`);
      }
    },
    [authUser, logAudit, pushToast]
  );

  const deleteTest = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'tests', id));
        await logAudit('DELETE_TEST', 'Tests', `Deleted test ${id}`, id);
        pushToast('info', 'Test deleted from catalog.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tests/${id}`);
      }
    },
    [logAudit, pushToast]
  );

  const createBooking = useCallback(
    async (input: CreateBookingInput): Promise<Booking> => {
      if (!authUser) throw new Error('Not authenticated');
      const bookingId = createSafeId('bkg');
      const accessionNo = generateAccessionNo(bookings.length);
      const barcodeValue = accessionNo;
      const bookingDate = todayISO();

      const subtotal = input.testItems.reduce((sum, t) => sum + t.price, 0);
      const discount = Math.max(0, Math.min(subtotal, input.discount || 0));
      const netAmount = Math.max(0, subtotal - discount);
      const paidAmount = Math.max(0, Math.min(netAmount, input.initialPaidAmount || 0));
      const dueAmount = Math.max(0, netAmount - paidAmount);
      const paymentStatus: Booking['paymentStatus'] =
        dueAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

      const bookingPayload = stripUndefined({
        accessionNo,
        barcodeValue,
        patientId: input.patient.id,
        patientCode: input.patient.patientCode,
        patientName: input.patient.name,
        patientAge: `${input.patient.age} ${input.patient.ageUnit}`,
        patientGender: input.patient.gender,
        patientMobile: input.patient.mobile,
        doctorId: input.doctorId,
        doctorName: input.doctorName,
        testItems: input.testItems,
        subtotal,
        discount,
        discountReason: input.discountReason,
        netAmount,
        paidAmount,
        dueAmount,
        paymentStatus,
        sampleStatus: 'pending_collection' as const,
        reportStatus: 'pending' as const,
        collectionType: input.collectionType,
        bookingDate,
        createdBy: authUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        // Step 1: Create Booking so exists() passes for dependent samples/reports/payments
        await setDoc(doc(db, 'bookings', bookingId), bookingPayload);

        // Step 2: Atomically create Samples (grouped by unique sampleType), LabReport shell, and initial Payment + Cashbook
        const batch = writeBatch(db);
        const uniqueSampleTypes = Array.from(new Set(input.testItems.map((t) => t.sampleType)));

        uniqueSampleTypes.forEach((sampleType, idx) => {
          const sampleId = createSafeId(`smp${idx}`);
          const sampleBarcode = uniqueSampleTypes.length > 1 ? `${barcodeValue}-${idx + 1}` : barcodeValue;
          batch.set(
            doc(db, 'samples', sampleId),
            stripUndefined({
              bookingId,
              accessionNo,
              barcodeValue: sampleBarcode,
              patientId: input.patient.id,
              patientName: input.patient.name,
              sampleType,
              tubeColor: getTubeColorForSample(sampleType),
              status: 'pending_collection',
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        });

        const reportResults: ReportTestGroup[] = input.testItems.map((item) => {
          const testDef = tests.find((t) => t.id === item.testId);
          return {
            testId: item.testId,
            testCode: item.testCode,
            testName: item.testName,
            department: item.department,
            parameters: (testDef?.parameters || []).map((p) => ({
              key: p.key,
              name: p.name,
              value: '',
              unit: p.unit,
              refRange: formatReferenceRange(p, input.patient.gender),
              flag: 'normal',
              formula: p.formula,
            })),
          };
        });

        const reportId = createSafeId('rep');
        batch.set(
          doc(db, 'labReports', reportId),
          stripUndefined({
            bookingId,
            accessionNo,
            patientId: input.patient.id,
            patientCode: input.patient.patientCode,
            patientName: input.patient.name,
            patientAge: `${input.patient.age} ${input.patient.ageUnit}`,
            patientGender: input.patient.gender,
            doctorName: input.doctorName,
            results: reportResults,
            status: 'pending',
            createdBy: authUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        if (paidAmount > 0) {
          const payId = createSafeId('pay');
          const receiptNo = generateReceiptNo(payments.length);
          const staffName = userProfile?.displayName || authUser.displayName || 'Staff';
          batch.set(
            doc(db, 'payments', payId),
            stripUndefined({
              receiptNo,
              bookingId,
              accessionNo,
              patientId: input.patient.id,
              patientName: input.patient.name,
              amount: paidAmount,
              method: input.paymentMethod,
              referenceNo: input.paymentReference,
              paymentDate: bookingDate,
              receivedBy: authUser.uid,
              receivedByName: staffName,
              createdAt: serverTimestamp(),
            })
          );

          const cbId = createSafeId('cb');
          batch.set(
            doc(db, 'cashbook', cbId),
            stripUndefined({
              entryDate: bookingDate,
              type: 'income',
              category: 'Lab Billing',
              description: `Booking ${accessionNo} - ${input.patient.name} (${receiptNo})`,
              amount: paidAmount,
              paymentMethod: input.paymentMethod,
              referenceId: payId,
              recordedBy: authUser.uid,
              recordedByName: staffName,
              createdAt: serverTimestamp(),
            })
          );
        }

        await batch.commit();
        await logAudit(
          'CREATE_BOOKING',
          'Bookings',
          `Booked ${input.testItems.length} tests for ${input.patient.name} (${accessionNo})`,
          bookingId
        );
        pushToast('success', `Booking created: ${accessionNo}`);
        return { id: bookingId, ...(bookingPayload as Omit<Booking, 'id'>) };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `bookings/${bookingId}`);
      }
    },
    [authUser, bookings.length, payments.length, tests, userProfile, logAudit, pushToast]
  );

  const collectPayment = useCallback(
    async (input: {
      booking: Booking;
      amount: number;
      method: 'cash' | 'upi' | 'card' | 'bank';
      referenceNo?: string;
      notes?: string;
    }): Promise<Payment> => {
      if (!authUser) throw new Error('Not authenticated');
      const payId = createSafeId('pay');
      const receiptNo = generateReceiptNo(payments.length);
      const paymentDate = todayISO();
      const staffName = userProfile?.displayName || authUser.displayName || 'Staff';

      const newPaid = Math.min(input.booking.netAmount, input.booking.paidAmount + input.amount);
      const newDue = Math.max(0, input.booking.netAmount - newPaid);
      const paymentStatus: Booking['paymentStatus'] =
        newDue === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

      const paymentPayload = stripUndefined({
        receiptNo,
        bookingId: input.booking.id,
        accessionNo: input.booking.accessionNo,
        patientId: input.booking.patientId,
        patientName: input.booking.patientName,
        amount: input.amount,
        method: input.method,
        referenceNo: input.referenceNo,
        notes: input.notes,
        paymentDate,
        receivedBy: authUser.uid,
        receivedByName: staffName,
        createdAt: serverTimestamp(),
      });

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'payments', payId), paymentPayload);
        batch.update(doc(db, 'bookings', input.booking.id), {
          paidAmount: newPaid,
          dueAmount: newDue,
          paymentStatus,
          updatedAt: serverTimestamp(),
        });
        batch.set(
          doc(db, 'cashbook', createSafeId('cb')),
          stripUndefined({
            entryDate: paymentDate,
            type: 'income',
            category: 'Lab Billing',
            description: `Due Payment ${input.booking.accessionNo} - ${input.booking.patientName} (${receiptNo})`,
            amount: input.amount,
            paymentMethod: input.method,
            referenceId: payId,
            recordedBy: authUser.uid,
            recordedByName: staffName,
            createdAt: serverTimestamp(),
          })
        );
        await batch.commit();
        await logAudit(
          'COLLECT_PAYMENT',
          'Billing',
          `Collected ${input.amount} (${input.method}) for ${input.booking.accessionNo}`,
          payId
        );
        pushToast('success', `Payment received (${receiptNo}).`);
        return { id: payId, ...(paymentPayload as Omit<Payment, 'id'>) };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `payments/${payId}`);
      }
    },
    [authUser, payments.length, userProfile, logAudit, pushToast]
  );

  const updateSampleStatus = useCallback(
    async (
      sample: Sample,
      status: Sample['status'],
      extra?: { rejectionReason?: string; notes?: string }
    ) => {
      if (!authUser) throw new Error('Not authenticated');
      const staffName = userProfile?.displayName || authUser.displayName || 'Staff';
      const nowStr = new Date().toISOString();

      try {
        const batch = writeBatch(db);
        const sampleUpdates = stripUndefined({
          status,
          collectedBy: status === 'collected' ? staffName : sample.collectedBy,
          collectedAt: status === 'collected' ? nowStr : sample.collectedAt,
          receivedBy: status === 'received' ? staffName : sample.receivedBy,
          receivedAt: status === 'received' ? nowStr : sample.receivedAt,
          rejectionReason: extra?.rejectionReason,
          notes: extra?.notes,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'samples', sample.id), sampleUpdates);

        if (status !== 'rejected') {
          batch.update(doc(db, 'bookings', sample.bookingId), {
            sampleStatus: status,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        await logAudit(
          'UPDATE_SAMPLE',
          'Samples',
          `Sample ${sample.barcodeValue} marked as ${status}`,
          sample.id
        );
        pushToast('success', `Sample ${sample.barcodeValue} updated to ${status.replace('_', ' ')}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `samples/${sample.id}`);
      }
    },
    [authUser, userProfile, logAudit, pushToast]
  );

  const saveLabReport = useCallback(
    async (
      report: LabReport,
      updates: {
        results: ReportTestGroup[];
        status: LabReport['status'];
        clinicalNotes?: string;
      }
    ) => {
      if (!authUser) throw new Error('Not authenticated');
      const staffName = userProfile?.displayName || authUser.displayName || 'Staff';

      try {
        const batch = writeBatch(db);
        const reportPatch: Record<string, unknown> = {
          results: updates.results,
          status: updates.status,
          clinicalNotes: updates.clinicalNotes || '',
          updatedAt: serverTimestamp(),
        };

        if (updates.status === 'entered') {
          reportPatch.enteredBy = authUser.uid;
          reportPatch.enteredByName = staffName;
        } else if (updates.status === 'verified') {
          reportPatch.verifiedBy = authUser.uid;
          reportPatch.verifiedByName = staffName;
        } else if (updates.status === 'approved') {
          reportPatch.approvedBy = authUser.uid;
          reportPatch.approvedByName = staffName;
          reportPatch.approvedAt = new Date().toISOString();
        }

        batch.update(doc(db, 'labReports', report.id), stripUndefined(reportPatch));
        batch.update(doc(db, 'bookings', report.bookingId), {
          reportStatus: updates.status,
          ...(updates.status === 'approved' ? { sampleStatus: 'completed' } : {}),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        await logAudit(
          `REPORT_${updates.status.toUpperCase()}`,
          'LabReports',
          `Lab report ${report.accessionNo} (${report.patientName}) -> ${updates.status}`,
          report.id
        );
        pushToast('success', `Lab report ${report.accessionNo} saved (${updates.status}).`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `labReports/${report.id}`);
      }
    },
    [authUser, userProfile, logAudit, pushToast]
  );

  const addCashbookEntry = useCallback(
    async (entry: Omit<CashbookEntry, 'id' | 'recordedBy' | 'recordedByName' | 'createdAt'>) => {
      if (!authUser) throw new Error('Not authenticated');
      const id = createSafeId('cb');
      const staffName = userProfile?.displayName || authUser.displayName || 'Staff';
      try {
        await setDoc(
          doc(db, 'cashbook', id),
          stripUndefined({
            ...entry,
            recordedBy: authUser.uid,
            recordedByName: staffName,
            createdAt: serverTimestamp(),
          })
        );
        await logAudit(
          'ADD_CASHBOOK',
          'Accounts',
          `Recorded ${entry.type}: ${entry.category} (${entry.amount})`,
          id
        );
        pushToast('success', `${entry.type === 'income' ? 'Income' : 'Expense'} recorded.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `cashbook/${id}`);
      }
    },
    [authUser, userProfile, logAudit, pushToast]
  );

  const deleteCashbookEntry = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(doc(db, 'cashbook', id));
        await logAudit('DELETE_CASHBOOK', 'Accounts', `Deleted cashbook entry ${id}`, id);
        pushToast('info', 'Cashbook entry deleted.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `cashbook/${id}`);
      }
    },
    [logAudit, pushToast]
  );

  const saveHomeCollection = useCallback(
    async (
      data: Omit<HomeCollection, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      if (!authUser) throw new Error('Not authenticated');
      const id = existingId || createSafeId('hc');
      try {
        if (existingId) {
          await updateDoc(
            doc(db, 'homeCollections', existingId),
            stripUndefined({
              ...data,
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('UPDATE_HOME_COLLECTION', 'HomeCollection', `Updated home visit for ${data.patientName}`, existingId);
          pushToast('success', `Home collection updated (${data.status}).`);
        } else {
          await setDoc(
            doc(db, 'homeCollections', id),
            stripUndefined({
              ...data,
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('CREATE_HOME_COLLECTION', 'HomeCollection', `Scheduled home visit for ${data.patientName}`, id);
          pushToast('success', 'Home collection appointment scheduled.');
        }
      } catch (err) {
        handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `homeCollections/${id}`);
      }
    },
    [authUser, logAudit, pushToast]
  );

  const saveDoctor = useCallback(
    async (
      data: Omit<Doctor, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      if (!authUser) throw new Error('Not authenticated');
      const id = existingId || createSafeId('doc');
      try {
        if (existingId) {
          await updateDoc(
            doc(db, 'doctors', existingId),
            stripUndefined({
              ...data,
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('UPDATE_DOCTOR', 'Doctors', `Updated doctor ${data.name}`, existingId);
          pushToast('success', `Doctor ${data.name} updated.`);
        } else {
          await setDoc(
            doc(db, 'doctors', id),
            stripUndefined({
              ...data,
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          await logAudit('CREATE_DOCTOR', 'Doctors', `Added referring doctor ${data.name}`, id);
          pushToast('success', `Dr. ${data.name} added.`);
        }
      } catch (err) {
        handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `doctors/${id}`);
      }
    },
    [authUser, logAudit, pushToast]
  );

  const recordAttendance = useCallback(
    async (data: Omit<Attendance, 'id' | 'createdBy' | 'updatedAt'>) => {
      if (!authUser) throw new Error('Not authenticated');
      const docId = `${data.staffId}_${data.date}`;
      try {
        await setDoc(
          doc(db, 'attendance', docId),
          stripUndefined({
            ...data,
            createdBy: authUser.uid,
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        );
        await logAudit('MARK_ATTENDANCE', 'Staff', `Attendance for ${data.staffName} (${data.date}): ${data.status}`, docId);
        pushToast('success', `Attendance saved for ${data.staffName}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
      }
    },
    [authUser, logAudit, pushToast]
  );

  const inviteStaff = useCallback(
    async (input: {
      email: string;
      displayName: string;
      role: UserRole;
      department?: string;
      permissions: ModuleId[];
    }) => {
      if (!authUser) throw new Error('Not authenticated');
      const id = createSafeId('inv');
      try {
        await setDoc(
          doc(db, 'staffInvites', id),
          stripUndefined({
            email: input.email.trim().toLowerCase(),
            displayName: input.displayName.trim(),
            role: input.role,
            department: input.department,
            permissions: input.permissions,
            createdBy: authUser.uid,
            createdAt: serverTimestamp(),
          })
        );
        await logAudit('INVITE_STAFF', 'Staff', `Invited ${input.email} as ${input.role}`, id);
        pushToast('success', `Invitation created for ${input.email}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `staffInvites/${id}`);
      }
    },
    [authUser, logAudit, pushToast]
  );

  const updateStaffAccount = useCallback(
    async (
      uid: string,
      updates: Partial<Pick<UserAccount, 'role' | 'status' | 'permissions' | 'department' | 'displayName'>>
    ) => {
      try {
        await updateDoc(
          doc(db, 'users', uid),
          stripUndefined({
            ...updates,
            updatedAt: serverTimestamp(),
          })
        );
        await logAudit('UPDATE_STAFF', 'Staff', `Updated staff permissions/role for ${uid}`, uid);
        pushToast('success', 'Staff account updated.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    },
    [logAudit, pushToast]
  );

  const revokeStaffInvite = useCallback(
    async (inviteId: string) => {
      try {
        await deleteDoc(doc(db, 'staffInvites', inviteId));
        await logAudit('REVOKE_INVITE', 'Staff', `Revoked invite ${inviteId}`, inviteId);
        pushToast('info', 'Staff invitation revoked.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `staffInvites/${inviteId}`);
      }
    },
    [logAudit, pushToast]
  );

  const logNotification = useCallback(
    async (input: Omit<NotificationLog, 'id' | 'sentBy' | 'createdAt'>) => {
      if (!authUser) throw new Error('Not authenticated');
      const id = createSafeId('ntf');
      try {
        await setDoc(
          doc(db, 'notifications', id),
          stripUndefined({
            ...input,
            sentBy: authUser.uid,
            createdAt: serverTimestamp(),
          })
        );
        await logAudit('SEND_NOTIFICATION', 'Notifications', `Sent ${input.channel} (${input.eventType}) to ${input.patientName}`, id);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `notifications/${id}`);
      }
    },
    [authUser, logAudit]
  );

  const saveSettings = useCallback(
    async (updates: Partial<LabSettings>) => {
      if (!authUser) throw new Error('Not authenticated');
      try {
        await setDoc(
          doc(db, 'settings', 'labProfile'),
          stripUndefined({
            ...settings,
            ...updates,
            updatedBy: authUser.uid,
            updatedAt: serverTimestamp(),
          })
        );
        await logAudit('UPDATE_SETTINGS', 'Settings', 'Updated laboratory configuration / template', 'labProfile');
        pushToast('success', 'Laboratory settings saved.');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'settings/labProfile');
      }
    },
    [authUser, settings, logAudit, pushToast]
  );

  const restoreFromBackupJson = useCallback(
    async (jsonText: string) => {
      if (!authUser) throw new Error('Not authenticated');
      const parsed = JSON.parse(jsonText) as {
        tests?: LabTest[];
        doctors?: Doctor[];
        settings?: LabSettings;
      };

      const batch = writeBatch(db);
      let count = 0;

      if (Array.isArray(parsed.tests)) {
        for (const t of parsed.tests.slice(0, 100)) {
          if (!t.id || !t.code || !t.name) continue;
          batch.set(
            doc(db, 'tests', t.id),
            stripUndefined({
              code: t.code,
              name: t.name,
              department: t.department || 'General',
              sampleType: t.sampleType || 'Serum',
              price: Number(t.price) || 0,
              turnaroundHours: t.turnaroundHours ?? 6,
              parameters: Array.isArray(t.parameters) ? t.parameters : [],
              isActive: t.isActive !== false,
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          count++;
        }
      }

      if (Array.isArray(parsed.doctors)) {
        for (const d of parsed.doctors.slice(0, 100)) {
          if (!d.id || !d.name) continue;
          batch.set(
            doc(db, 'doctors', d.id),
            stripUndefined({
              name: d.name,
              qualification: d.qualification,
              specialization: d.specialization,
              clinicName: d.clinicName,
              mobile: d.mobile,
              email: d.email,
              commissionPercent: d.commissionPercent,
              isActive: d.isActive !== false,
              createdBy: authUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
          count++;
        }
      }

      if (parsed.settings && parsed.settings.labName) {
        batch.set(
          doc(db, 'settings', 'labProfile'),
          stripUndefined({
            ...parsed.settings,
            updatedBy: authUser.uid,
            updatedAt: serverTimestamp(),
          })
        );
        count++;
      }

      await batch.commit();
      await logAudit('RESTORE_BACKUP', 'Settings', `Restored ${count} configuration records from JSON backup`, 'labProfile');
      pushToast('success', `Restored ${count} records from backup.`);
    },
    [authUser, logAudit, pushToast]
  );

  const value: LabContextValue = {
    authUser,
    authLoading,
    userProfile,
    profileLoading,
    effectiveRole,
    effectivePermissions,
    previewRole,
    setPreviewRole,
    hasPermission,
    signInWithGoogle,
    logout,
    toasts,
    pushToast,
    dismissToast,
    patients,
    tests,
    bookings,
    samples,
    labReports,
    payments,
    cashbook,
    homeCollections,
    doctors,
    attendance,
    notifications,
    auditLogs,
    staffUsers,
    staffInvites,
    settings,
    dataLoading,
    logAudit,
    savePatient,
    deletePatient,
    saveTest,
    deleteTest,
    createBooking,
    collectPayment,
    updateSampleStatus,
    saveLabReport,
    addCashbookEntry,
    deleteCashbookEntry,
    saveHomeCollection,
    saveDoctor,
    recordAttendance,
    inviteStaff,
    updateStaffAccount,
    revokeStaffInvite,
    logNotification,
    saveSettings,
    restoreFromBackupJson,
  };

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
};

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used inside LabProvider');
  return ctx;
}
