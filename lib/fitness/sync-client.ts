import { resourceSchemas, type Entity, type FitnessData, type Resource } from './model';
import { applyChange, reconcilePending, type Attempt, type PendingChange } from './sync';

export type SyncState = {
  data: FitnessData | null;
  status: 'loading' | 'saved' | 'saving' | 'offline' | 'error';
  error: string;
  online: boolean;
  localSafe: boolean;
  conflict: boolean;
};
export type SyncSnapshot = { data: FitnessData | null; pending: PendingChange[] };
export interface SyncCache {
  read(): SyncSnapshot;
  write(snapshot: SyncSnapshot): void;
  recoverNext?(accept: (snapshot: SyncSnapshot) => boolean): Promise<boolean>;
}
export class SyncHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface SyncTransport {
  read(): Promise<FitnessData>;
  save(change: Attempt): Promise<number>;
}
const conflictMessage = 'Há alterações diferentes neste aparelho e na nuvem. Escolha qual versão manter para os registros em conflito.';

/** The existing optimistic queue, separated from React so real async races can be tested. */
export class FitnessSyncClient {
  state: SyncState = { data: null, status: 'loading', error: '', online: true, localSafe: true, conflict: false };
  private pending: PendingChange[] = [];
  private conflicts = new Map<string, { stamp: number; version: number }>();
  private busy = false;
  private refresh = true;
  private closed = false;
  private blocked = false;
  private stamp = 0;
  private listeners = new Set<() => void>();
  private idle: Array<() => void> = [];

  constructor(private cache: SyncCache, private transport: SyncTransport, private isOnline = () => true) {
    // A failed read must abort initialization, not turn an unreadable queue into
    // an empty one that a later GET would overwrite.
    const saved = cache.read();
    this.pending = saved.pending;
    this.stamp = Math.max(0, ...this.pending.map(item => item.stamp));
    this.state = { ...this.state, data: saved.data ? saved.pending.reduce(applyChange, saved.data) : null, online: isOnline() };
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  hasPending = () => this.pending.length > 0;
  dispose() { this.closed = true; this.listeners.clear(); this.idle.splice(0).forEach(resolve => resolve()); }
  private finishWork() { this.busy = false; this.idle.splice(0).forEach(resolve => resolve()); }
  private publish(patch: Partial<SyncState> = {}) {
    this.state = { ...this.state, ...patch, conflict: this.conflicts.size > 0 };
    this.listeners.forEach(listener => listener());
  }
  private persist() {
    try { this.cache.write({ data: this.state.data, pending: this.pending }); this.publish({ localSafe: true }); }
    catch { this.publish({ localSafe: false, error: 'Não foi possível manter uma cópia neste aparelho. Mantenha a página aberta até salvar.' }); }
  }
  private adopt(server: FitnessData) {
    const result = reconcilePending(server, this.pending);
    this.pending = result.remaining;
    this.conflicts = new Map(result.conflicts.map(item => [item.id, { stamp: item.stamp, version: server.versions[item.id] ?? 0 }]));
    this.publish({ data: this.pending.reduce(applyChange, server) });
    this.persist();
  }
  private settle() {
    const online = this.isOnline();
    this.publish({ online, status: this.conflicts.size ? 'error' : this.pending.length ? (online ? 'saving' : 'offline') : 'saved',
      error: this.conflicts.size ? conflictMessage : this.state.localSafe ? '' : this.state.error });
  }

  mutate(resource: Resource, entity: Entity, remove = false) {
    if (!this.state.data || this.closed) return;
    const parsed = resourceSchemas[resource].safeParse(entity);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Confira os campos.');
    const existing = this.pending.find(item => item.id === entity.id);
    if (existing && existing.resource !== resource) throw new Error('Identificador já utilizado por outro registro.');
    // Millisecond + random rounded to a float can collide. This counter cannot.
    this.stamp = Math.max(Date.now(), this.stamp + 1);
    const next: PendingChange = { resource, entity: parsed.data, id: entity.id, remove,
      version: existing?.version ?? this.state.data.versions[entity.id] ?? 0, stamp: this.stamp,
      attempt: existing?.attempt };
    this.pending = existing ? this.pending.map(item => item.id === next.id ? next : item) : [...this.pending, next];
    this.publish({ data: applyChange(this.state.data, next) });
    this.persist();
    this.settle();
  }

  load = async () => { this.refresh = true; this.blocked = false; await this.flush(); };

  flush = async () => {
    if (this.closed || this.busy || this.blocked) return;
    if (!this.isOnline()) { this.publish({ online: false, status: 'offline' }); return; }
    this.busy = true;
    let refreshes = 0;
    try {
      do {
        if (this.refresh) {
          this.refresh = false;
          const server = await this.transport.read();
          if (this.closed) return;
          this.adopt(server);
        }
        const item = this.pending.find(change => !this.conflicts.has(change.id));
        if (!item) {
          if (!this.pending.length && await this.cache.recoverNext?.(saved => {
            if (this.closed || this.pending.length) return false;
            this.pending = saved.pending;
            this.stamp = Math.max(this.stamp, ...saved.pending.map(change => change.stamp));
            const base = this.state.data ?? saved.data;
            if (base) this.publish({ data: saved.pending.reduce(applyChange, base) });
            this.refresh = true;
            return true;
          })) continue;
          if (this.refresh || this.pending.some(change => !this.conflicts.has(change.id))) continue;
          break;
        }
        if (!this.isOnline()) { this.publish({ online: false, status: 'offline' }); return; }
        this.publish({ status: 'saving', online: true });
        // Freeze and persist BEFORE making the request. New edits retain this proof.
        const attempt: Attempt = item.attempt ?? { ...item, entity: structuredClone(item.entity) };
        item.attempt = attempt;
        this.persist();
        let version: number;
        try { version = await this.transport.save(attempt); }
        catch (error) {
          if (this.closed) return;
          if (error instanceof SyncHttpError && error.status === 409) {
            if (++refreshes > 3) throw new Error('Não foi possível sincronizar agora. Tente novamente.');
            this.refresh = true;
            continue;
          }
          // A failure is ambiguous: the server may have committed. Read before retry.
          this.refresh = true;
          if (error instanceof SyncHttpError && [400, 401, 403].includes(error.status)) this.blocked = true;
          throw error;
        }
        if (this.closed) return;
        refreshes = 0;
        const current = this.pending.find(change => change.id === attempt.id);
        this.pending = this.pending.flatMap(change => change !== current ? [change]
          : change.stamp === attempt.stamp ? [] : [{ ...change, version, attempt: undefined }]);
        const deletedIds = (this.state.data!.deletedIds ?? []).filter(id => id !== attempt.id);
        if (attempt.remove && version > 0) deletedIds.push(attempt.id);
        this.publish({ data: { ...this.state.data!, versions: { ...this.state.data!.versions, [attempt.id]: version }, deletedIds } });
        this.persist();
      } while (!this.closed);
      this.settle();
    } catch (error) {
      this.publish({ online: this.isOnline(), status: this.isOnline() ? 'error' : 'offline',
        error: error instanceof Error ? error.message : 'Não foi possível sincronizar. Sua fila foi preservada.' });
    } finally { this.finishWork(); }
  };

  resolveConflict = async (choice: 'local' | 'cloud' = 'local') => {
    const displayed = new Map(this.conflicts);
    if (this.busy) await new Promise<void>(resolve => this.idle.push(resolve));
    if (this.closed || this.busy) return;
    this.busy = true;
    try {
      const server = await this.transport.read();
      if (this.closed) return;
      this.pending = this.pending.flatMap(item => {
        const seen = displayed.get(item.id);
        // Do not discard a new edit or approve a cloud version the user never saw.
        if (!seen || seen.stamp !== item.stamp || seen.version !== (server.versions[item.id] ?? 0)) return [item];
        return choice === 'cloud' ? [] : [{ ...item, version: seen.version, attempt: undefined }];
      });
      this.adopt(server);
      this.settle();
    } catch (error) { this.publish({ status: 'error', error: error instanceof Error ? error.message : 'Erro ao resolver conflito.' }); }
    finally { this.finishWork(); }
    await this.flush();
  };
}
