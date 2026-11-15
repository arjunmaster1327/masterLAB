import React, { useMemo, useState } from 'react';
import { CalendarCheck, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useLab } from '../context/LabContext';
import {
  ALL_MODULES,
  type Attendance,
  type ModuleId,
  ROLE_DEFAULT_PERMISSIONS,
  type UserAccount,
  type UserRole,
} from '../types/lab';
import { todayISO } from '../utils/labCalculations';

export const StaffModule: React.FC = () => {
  const {
    staffUsers,
    staffInvites,
    attendance,
    auditLogs,
    effectiveRole,
    inviteStaff,
    updateStaffAccount,
    revokeStaffInvite,
    recordAttendance,
    pushToast,
  } = useLab();

  const [tab, setTab] = useState<'directory' | 'attendance' | 'activity'>('directory');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(todayISO());

  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    role: 'technician' as UserRole,
    department: 'Pathology',
    permissions: ROLE_DEFAULT_PERMISSIONS.technician,
  });

  const [editForm, setEditForm] = useState({
    role: 'staff' as UserRole,
    status: 'active' as 'active' | 'inactive',
    department: '',
    permissions: [] as ModuleId[],
  });

  const canManage = effectiveRole === 'admin' || effectiveRole === 'manager';

  const handleInviteRoleChange = (role: UserRole) => {
    setInviteForm((f) => ({
      ...f,
      role,
      permissions: ROLE_DEFAULT_PERMISSIONS[role],
    }));
  };

  const toggleInvitePerm = (mod: ModuleId) => {
    setInviteForm((f) => ({
      ...f,
      permissions: f.permissions.includes(mod)
        ? f.permissions.filter((m) => m !== mod)
        : [...f.permissions, mod],
    }));
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim() || !inviteForm.displayName.trim()) {
      pushToast('error', 'Email and display name are required.');
      return;
    }
    await inviteStaff(inviteForm);
    setInviteOpen(false);
    setInviteForm({
      email: '',
      displayName: '',
      role: 'technician',
      department: 'Pathology',
      permissions: ROLE_DEFAULT_PERMISSIONS.technician,
    });
  };

  const openEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setEditForm({
      role: u.role,
      status: u.status,
      department: u.department || '',
      permissions: u.permissions || ROLE_DEFAULT_PERMISSIONS[u.role],
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await updateStaffAccount(editingUser.uid, {
      role: editForm.role,
      status: editForm.status,
      department: editForm.department.trim() || undefined,
      permissions: editForm.permissions,
    });
    setEditingUser(null);
  };

  const attendanceMap = useMemo(() => {
    const map: Record<string, Attendance> = {};
    attendance
      .filter((a) => a.date === attendanceDate)
      .forEach((a) => {
        map[a.staffId] = a;
      });
    return map;
  }, [attendance, attendanceDate]);

  const markStatus = async (u: UserAccount, status: Attendance['status']) => {
    const existing = attendanceMap[u.uid];
    const nowTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    await recordAttendance({
      staffId: u.uid,
      staffName: u.displayName,
      role: u.role,
      date: attendanceDate,
      status,
      checkInTime: existing?.checkInTime || (status === 'present' || status === 'half_day' ? nowTime : undefined),
      checkOutTime: existing?.checkOutTime,
    });
  };

  const markCheckOut = async (u: UserAccount) => {
    const existing = attendanceMap[u.uid];
    const nowTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    await recordAttendance({
      staffId: u.uid,
      staffName: u.displayName,
      role: u.role,
      date: attendanceDate,
      status: existing?.status || 'present',
      checkInTime: existing?.checkInTime || nowTime,
      checkOutTime: nowTime,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Staff, Roles & Attendance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Role-based permissions (Admin, Manager, Receptionist, Technician, Staff), attendance & activity logs
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            Invite Staff Member
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(
          [
            { id: 'directory', label: 'Staff & Permissions' },
            { id: 'attendance', label: 'Daily Attendance' },
            { id: 'activity', label: 'Staff Activity' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'directory' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Registered Staff Accounts ({staffUsers.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Staff Member</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Permissions</th>
                    <th className="px-5 py-3">Status</th>
                    {effectiveRole === 'admin' && <th className="px-5 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-medium text-slate-900">{u.displayName}</td>
                      <td className="px-5 py-3 text-xs font-semibold uppercase text-sky-800">
                        {u.role}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">{u.department || '-'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 font-mono">
                        {u.permissions?.length || 0} modules
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold capitalize">
                        <span
                          className={u.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}
                        >
                          {u.status}
                        </span>
                      </td>
                      {effectiveRole === 'admin' && (
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Shield className="h-3.5 w-3.5 text-sky-700" />
                            Edit Role
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {canManage && staffInvites.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">
                  Pending Staff Invitations ({staffInvites.length})
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {staffInvites.map((inv) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{inv.displayName}</div>
                      <div className="text-xs text-slate-500 font-mono">
                        {inv.email} · Role: {inv.role.toUpperCase()} · {inv.department || 'Lab'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeStaffInvite(inv.id)}
                      className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                      title="Revoke Invite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-4 w-4 text-sky-700" />
            <label className="text-xs font-semibold text-slate-700">Attendance Date:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Staff</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Check-In</th>
                    <th className="px-5 py-3">Check-Out</th>
                    <th className="px-5 py-3 text-right">Mark Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffUsers.map((u) => {
                    const rec = attendanceMap[u.uid];
                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="font-medium text-slate-900">{u.displayName}</div>
                          <div className="text-xs text-slate-500 uppercase">{u.role}</div>
                        </td>
                        <td className="px-5 py-3 text-xs font-semibold capitalize">
                          {rec ? rec.status.replace('_', ' ') : 'Not Marked'}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                          {rec?.checkInTime || '-'}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                          {rec?.checkOutTime || '-'}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {(['present', 'half_day', 'absent', 'on_leave'] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => markStatus(u, st)}
                                className={`px-2.5 py-1 rounded text-xs font-medium capitalize border ${
                                  rec?.status === st
                                    ? 'border-sky-700 bg-sky-50 text-sky-900 font-semibold'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {st.replace('_', ' ')}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => markCheckOut(u)}
                              className="px-2.5 py-1 rounded text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            >
                              Check Out
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No staff activity logged yet (or requires Admin/Manager role).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Staff</th>
                    <th className="px-5 py-3">Module</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.slice(0, 60).map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-3 text-xs">
                        <div className="font-semibold text-slate-900">{log.actorName}</div>
                        <div className="text-slate-500 uppercase">{log.actorRole}</div>
                      </td>
                      <td className="px-5 py-3 text-xs font-medium text-slate-700">{log.module}</td>
                      <td className="px-5 py-3 font-mono text-xs text-sky-800">{log.action}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Invite Staff Member</h2>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleInviteSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Google Account Email *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="technician@gmail.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.displayName}
                    onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => handleInviteRoleChange(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="manager">Manager</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="technician">Technician</option>
                    <option value="staff">Staff</option>
                    {effectiveRole === 'admin' && <option value="admin">Admin</option>}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Module Permissions
                </label>
                <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                  {ALL_MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={inviteForm.permissions.includes(m.id)}
                        onChange={() => toggleInvitePerm(m.id)}
                        className="rounded border-slate-300 text-sky-700"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-700 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                >
                  Create Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Edit Permissions: {editingUser.displayName}
              </h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setEditForm({
                        ...editForm,
                        role: nextRole,
                        permissions: ROLE_DEFAULT_PERMISSIONS[nextRole],
                      });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="technician">Technician</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as 'active' | 'inactive',
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Allowed Modules
                </label>
                <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                  {ALL_MODULES.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={editForm.permissions.includes(m.id)}
                        onChange={() =>
                          setEditForm((f) => ({
                            ...f,
                            permissions: f.permissions.includes(m.id)
                              ? f.permissions.filter((x) => x !== m.id)
                              : [...f.permissions, m.id],
                          }))
                        }
                        className="rounded border-slate-300 text-sky-700"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-700 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
