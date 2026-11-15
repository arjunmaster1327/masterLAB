// Device-only Firestore-compatible store. No network or account required.
type Ref = { path: string; filters?: Array<{ field: string; op: string; value: unknown }>; sort?: { field: string; direction: string } };
type Snap = { id: string; data: () => any; exists: () => boolean };
const KEY = 'masterlab.localdb.v1';
const listeners = new Set<() => void>();
const read = (): Record<string, any> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const write = (data: Record<string, any>) => { localStorage.setItem(KEY, JSON.stringify(data)); listeners.forEach(fn => fn()); };
export const db = { local: true } as any;
export const doc = (_db: any, path: string, id?: string): Ref => ({ path: id ? path + '/' + id : path });
export const collection = (_db: any, path: string): Ref => ({ path });
export const where = (field: string, op: string, value: unknown) => ({ field, op, value });
export const orderBy = (field: string, direction = 'asc') => ({ field, direction });
export const query = (ref: Ref, ...constraints: any[]): Ref => ({ ...ref, filters: constraints.filter(x => x.field && x.op), sort: constraints.find(x => x.direction) });
export const serverTimestamp = () => new Date().toISOString();
const snap = (id: string, value: any): Snap => ({ id, data: () => value, exists: () => value !== undefined });
export async function getDoc(ref: Ref) { const value = read()[ref.path]; return snap(ref.path.split('/').pop() || '', value); }
export async function getDocs(ref: Ref) {
  const all = read(); const prefix = ref.path.replace(/\/$/, '') + '/';
  let rows = Object.entries(all).filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'));
  rows = rows.filter(([, value]) => (ref.filters || []).every(f => f.op === '==' ? value?.[f.field] === f.value : f.op === '!=' ? value?.[f.field] !== f.value : true));
  if (ref.sort) rows.sort((a,b) => String(a[1]?.[ref.sort!.field] ?? '').localeCompare(String(b[1]?.[ref.sort!.field] ?? '')) * (ref.sort.direction === 'desc' ? -1 : 1));
  const docs = rows.map(([path,value]) => snap(path.split('/').pop() || '', value));
  return { docs, empty: docs.length === 0, size: docs.length };
}
export async function setDoc(ref: Ref, value: any) { const all = read(); all[ref.path] = value; write(all); }
export async function updateDoc(ref: Ref, value: any) { const all = read(); if (!all[ref.path]) throw new Error('Record not found'); all[ref.path] = { ...all[ref.path], ...value }; write(all); }
export async function deleteDoc(ref: Ref) { const all = read(); delete all[ref.path]; write(all); }
export function onSnapshot(ref: Ref, next: (snap: any) => void, error?: (e: any) => void) {
  let active = true;
  const emit = async () => { try { if (!active) return; if (ref.path.includes('/')) { const s = await getDoc(ref); next(s); } else next(await getDocs(ref)); } catch (e) { error?.(e); } };
  const listener = () => { void emit(); }; listeners.add(listener); void emit();
  return () => { active = false; listeners.delete(listener); };
}
export function writeBatch(_db: any) {
  const ops: Array<{ kind: string; ref: Ref; value?: any }> = [];
  return {
    set: (ref: Ref, value: any) => { ops.push({ kind: 'set', ref, value }); },
    update: (ref: Ref, value: any) => { ops.push({ kind: 'update', ref, value }); },
    delete: (ref: Ref) => { ops.push({ kind: 'delete', ref }); },
    commit: async () => { const all = read(); for (const op of ops) { if (op.kind === 'delete') delete all[op.ref.path]; else if (op.kind === 'update') { if (!all[op.ref.path]) throw new Error('Record not found'); all[op.ref.path] = { ...all[op.ref.path], ...op.value }; } else all[op.ref.path] = op.value; } write(all); }
  };
}
