'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entity, Resource } from '@/lib/fitness/model';
import { FitnessSyncClient, SyncHttpError, type SyncState, type SyncTransport } from '@/lib/fitness/sync-client';
import { openFitnessCache, parseFitnessData, type ClaimCache, type FitnessCache } from '@/lib/fitness/sync-cache';
import { toast } from 'sonner';

const transport: SyncTransport = {
  async read() {
    const response = await fetch('/api/fitness', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new SyncHttpError(response.status, response.status === 401 ? 'Entre novamente para abrir seus treinos.' : 'Não foi possível carregar. Tente novamente.');
    return parseFitnessData(await response.json());
  },
  async save(change) {
    const response = await fetch('/api/fitness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change), signal: AbortSignal.timeout(20000) });
    const result = await response.json() as { version?: number; error?: string };
    if (!response.ok) throw new SyncHttpError(response.status, result.error ?? 'Não foi possível salvar agora.');
    if (!Number.isSafeInteger(result.version) || result.version! < 0) throw new Error('Confirmação de salvamento inválida. Sua alteração foi preservada.');
    return result.version!;
  },
};

const claimCache: ClaimCache = key => new Promise((resolve, reject) => {
  if (!navigator.locks) { reject(new Error('Este navegador não oferece proteção de dados entre abas. Atualize o navegador para continuar; seus dados locais foram preservados.')); return; }
  void navigator.locks.request(key, { ifAvailable: true }, lock => {
    if (!lock) { resolve(undefined); return; }
    return new Promise<void>(release => { resolve(release); });
  }).catch(reject);
});

const initialState: SyncState = { data: null, status: 'loading', error: '', online: true, localSafe: true, conflict: false };

export function useFitness(uid: string) {
  const [state, setState] = useState<SyncState>(initialState);
  const client = useRef<FitnessSyncClient | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restart, setRestart] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cache: FitnessCache | undefined;
    let current: FitnessSyncClient | undefined;
    let unsubscribe: (() => void) | undefined;
    const initialize = async () => {
      setState(initialState);
      try {
        cache = await openFitnessCache(uid, localStorage, claimCache);
        if (cancelled) { cache.close(); return; }
        current = new FitnessSyncClient(cache, transport, () => navigator.onLine);
        client.current = current;
        unsubscribe = current.subscribe(() => setState(current!.getSnapshot()));
        setState(current.getSnapshot());
        await current.load();
      } catch (error) {
        if (!cancelled) setState({ ...initialState, status: 'error', localSafe: false, error: error instanceof Error ? error.message : 'Não foi possível abrir os dados locais.' });
      }
    };
    void initialize();
    const onOnline = () => { void current?.load(); };
    const onOffline = () => { void current?.flush(); };
    const before = (event: BeforeUnloadEvent) => { if (current?.hasPending()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeunload', before);
    const retry = setInterval(() => { if (current?.hasPending()) void current.flush(); }, 10000);
    return () => {
      cancelled = true; unsubscribe?.(); current?.dispose(); cache?.close();
      if (client.current === current) client.current = null;
      window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeunload', before); clearInterval(retry);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [uid, restart]);

  const mutate = useCallback((resource: Resource, entity: Entity, remove = false) => {
    try { client.current?.mutate(resource, entity, remove); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Confira os campos.'); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void client.current?.flush(), 450);
  }, []);
  const retry = useCallback(() => { if (client.current) return client.current.load(); setRestart(value => value + 1); }, []);
  const resolveConflict = useCallback((choice: 'local' | 'cloud' = 'local') => client.current?.resolveConflict(choice), []);
  return { ...state, mutate, resolveConflict, retry, reload: retry };
}
export type FitnessStore = ReturnType<typeof useFitness>;
