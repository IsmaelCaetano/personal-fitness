'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fitnessDataSchema, resourceSchemas, type Entity, type FitnessData, type Resource } from '@/lib/fitness/model';
import { reconcilePending, type PendingChange } from '@/lib/fitness/sync';
import { toast } from 'sonner';

type SaveState = 'loading' | 'saved' | 'saving' | 'offline' | 'error';
const keyMap = { exercise: 'exercises', routine: 'routines', session: 'sessions', measurement: 'measurements' } as const;
const conflictMessage = 'Há alterações diferentes neste aparelho e na nuvem. Escolha qual versão manter para os registros em conflito.';

function apply(data: FitnessData, change: PendingChange): FitnessData {
  if (change.resource === 'profile') return { ...data, profile: change.entity as FitnessData['profile'] };
  const key = keyMap[change.resource];
  const list = data[key].filter((entity) => entity.id !== change.id);
  return { ...data, [key]: change.remove ? list : [...list, change.entity] };
}

async function readServer(): Promise<FitnessData> {
  const response = await fetch('/api/fitness', { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Entre novamente para abrir seus treinos.' : 'Não foi possível carregar. Tente novamente.');
  return response.json() as Promise<FitnessData>;
}

export function useFitness(uid: string) {
  const [data, setData] = useState<FitnessData | null>(null);
  const [status, setStatus] = useState<SaveState>('loading');
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  const [conflict, setConflict] = useState(false);
  const [localSafe, setLocalSafe] = useState(true);
  const dataRef = useRef<FitnessData | null>(null);
  const pending = useRef<PendingChange[]>([]);
  const busy = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `personal-fitness-pending:${uid}`;
  const snapshotKey = `personal-fitness-data:${uid}`;

  const storeSnapshot = useCallback((next: FitnessData) => {
    try { localStorage.setItem(snapshotKey, JSON.stringify(next)); setLocalSafe(true); return true; }
    catch { setLocalSafe(false); return false; }
  }, [snapshotKey]);
  const storePending = useCallback(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(pending.current)); setLocalSafe(true); return true; }
    catch { setLocalSafe(false); setError('Não foi possível manter uma cópia neste aparelho. Mantenha a página aberta até salvar.'); return false; }
  }, [storageKey]);

  // Refresh the server version without dropping edits made while a request was in flight.
  const adoptServer = useCallback((server: FitnessData, choice: 'ask' | 'local' | 'cloud' = 'ask') => {
    const { remaining, conflicts } = reconcilePending(server, pending.current);
    const conflicting = new Set(conflicts.map((change) => change.id));
    pending.current = choice === 'cloud' ? remaining.filter((change) => !conflicting.has(change.id))
      : choice === 'local' ? remaining.map((change) => conflicting.has(change.id) ? { ...change, version: server.versions[change.id] ?? 0 } : change)
        : remaining;
    let merged = server;
    for (const change of pending.current) merged = apply(merged, change);
    dataRef.current = merged;
    setData(merged);
    storePending();
    storeSnapshot(merged);
    const unresolved = choice === 'ask' && conflicts.length > 0;
    blocked.current = unresolved;
    setConflict(unresolved);
    if (unresolved) { setStatus('error'); setError(conflictMessage); }
    else { setStatus(pending.current.length ? 'saving' : 'saved'); setError(''); }
    return unresolved;
  }, [storePending, storeSnapshot]);

  const flush = useCallback(async () => {
    if (busy.current || blocked.current || !dataRef.current) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    busy.current = true;
    let refreshes = 0;
    try {
      while (pending.current.length) {
        setStatus('saving');
        const item = { ...pending.current[0] };
        const response = await fetch('/api/fitness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
        const result = await response.json() as { version?: number; error?: string };
        if (response.status === 409) {
          if (++refreshes > 2) throw new Error('Não foi possível sincronizar. Tente novamente.');
          const unresolved = adoptServer(await readServer());
          if (unresolved) return;
          continue;
        }
        if (!response.ok) {
          if (response.status === 400 || response.status === 401) blocked.current = true;
          throw new Error(result.error ?? 'Erro ao salvar.');
        }
        refreshes = 0;
        const version = result.version ?? 0;
        dataRef.current = { ...dataRef.current!, versions: { ...dataRef.current!.versions, [item.id]: version } };
        const current = pending.current.find((change) => change.id === item.id);
        if (current?.stamp === item.stamp) pending.current = pending.current.filter((change) => change.id !== item.id);
        else if (current) current.version = version;
        storePending();
        storeSnapshot(dataRef.current);
        setData({ ...dataRef.current });
      }
      setStatus('saved'); setError('');
    } catch (caught) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(caught instanceof Error ? caught.message : 'Erro ao salvar.');
    } finally { busy.current = false; }
  }, [adoptServer, storePending, storeSnapshot]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const server = await readServer();
      let local: PendingChange[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown;
        if (Array.isArray(saved)) local = saved as PendingChange[];
      } catch { /* A cached snapshot is still available for recovery. */ }
      pending.current = local;
      const unresolved = adoptServer(server);
      setOnline(true);
      if (!unresolved && pending.current.length) void flush();
    } catch (caught) {
      try {
        const cached = fitnessDataSchema.safeParse(JSON.parse(localStorage.getItem(snapshotKey) ?? 'null'));
        if (cached.success) {
          dataRef.current = cached.data; setData(cached.data); setOnline(false); setStatus('offline');
          setError('Sem conexão. Seus dados salvos neste aparelho continuam disponíveis e serão sincronizados depois.');
          return;
        }
      } catch { /* No readable cached data. */ }
      setStatus('error'); setError(caught instanceof Error ? caught.message : 'Falha ao carregar.');
    }
  }, [storageKey, snapshotKey, adoptServer, flush]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const onOnline = () => { setOnline(true); void flush(); };
    const onOffline = () => { setOnline(false); if (pending.current.length) setStatus('offline'); };
    const before = (event: BeforeUnloadEvent) => { if (pending.current.length) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeunload', before);
    const retry = setInterval(() => { if (pending.current.length) void flush(); }, 10000);
    return () => {
      window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', before); clearInterval(retry);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load, flush]);

  const mutate = useCallback((resource: Resource, entity: Entity, remove = false) => {
    if (!dataRef.current) return;
    const parsed = resourceSchemas[resource].safeParse(entity);
    if (!remove && !parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Confira os campos.'); return; }
    const existing = pending.current.find((change) => change.id === entity.id);
    const change: PendingChange = { resource, entity, id: entity.id, remove, version: existing?.version ?? dataRef.current.versions[entity.id] ?? 0, stamp: Date.now() + Math.random() };
    pending.current = existing ? pending.current.map((item) => item.id === entity.id ? change : item) : [...pending.current, change];
    dataRef.current = apply(dataRef.current, change);
    setData(dataRef.current);
    storePending(); storeSnapshot(dataRef.current);
    setStatus(navigator.onLine ? 'saving' : 'offline');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 450);
  }, [flush, storePending, storeSnapshot]);

  const resolveConflict = useCallback(async (choice: 'local' | 'cloud' = 'local') => {
    try {
      adoptServer(await readServer(), choice);
      if (pending.current.length) void flush();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Erro ao resolver conflito.'); }
  }, [adoptServer, flush]);

  return { data, status, error, online, localSafe, conflict, resolveConflict, mutate, retry: flush, reload: load };
}
export type FitnessStore = ReturnType<typeof useFitness>;
