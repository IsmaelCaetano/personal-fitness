import { z } from 'zod';
import { fitnessDataSchema, profileSchema, resourceSchemas, type FitnessData } from './model';
import type { SyncCache, SyncSnapshot } from './sync-client';
import type { PendingChange } from './sync';

// An uncompleted onboarding legitimately has no goals yet. Persisted completed
// profiles still use the original strict contract.
const cachedDataSchema = fitnessDataSchema.extend({ profile: z.union([
  profileSchema, profileSchema.extend({ onboarded: z.literal(false), goals: z.array(z.string().max(100)).max(5) }),
]) });
const attemptSchema = z.object({ resource: z.enum(['profile', 'exercise', 'routine', 'session', 'measurement']),
  id: z.string().min(1).max(200), entity: z.unknown(), remove: z.boolean().optional(),
  version: z.number().int().nonnegative(), stamp: z.number().finite() });
const pendingSchema = attemptSchema.extend({ attempt: attemptSchema.optional() });

export function parseFitnessData(raw: unknown): FitnessData { return cachedDataSchema.parse(raw); }
export function parsePending(raw: unknown): PendingChange[] {
  const items = z.array(pendingSchema).parse(raw);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Há versões locais duplicadas. A cópia foi preservada.');
  return items.map(item => {
    const entity = resourceSchemas[item.resource].parse(item.entity);
    if (entity.id !== item.id) throw new Error('Identificador inválido no cache.');
    const attempt = item.attempt ? { ...item.attempt, entity: resourceSchemas[item.attempt.resource].parse(item.attempt.entity) } : undefined;
    if (attempt && (attempt.id !== item.id || attempt.entity.id !== item.id || attempt.resource !== item.resource)) throw new Error('Tentativa inválida no cache.');
    return { ...item, entity, attempt };
  });
}

export interface CacheStorage { length: number; key(index: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type ClaimCache = (key: string) => Promise<(() => void) | undefined>;
export interface FitnessCache extends SyncCache { close(): void }

/** One durable journal per active tab, guarded by a browser lock for its lifetime.
 * Orphan journals are claimed after refresh/crash. No tab rewrites another's queue.
 * Shared snapshots are only a read fallback, never the source of pending writes.
 */
export async function openFitnessCache(uid: string, storage: CacheStorage, claim: ClaimCache): Promise<FitnessCache> {
  const prefix = `personal-fitness-journal:${uid}:`;
  const legacy = `personal-fitness-pending:${uid}`;
  const snapshotKey = `personal-fitness-data:${uid}`;
  const keys = () => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => !!key && key.startsWith(prefix)).sort();
  function read(key: string): SyncSnapshot {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { data: unknown; pending: unknown };
      return { data: parsed.data ? parseFitnessData(parsed.data) : null, pending: parsePending(parsed.pending) };
    }
    const snapshot = storage.getItem(snapshotKey);
    return { data: snapshot ? parseFitnessData(JSON.parse(snapshot)) : null, pending: [] };
  }
  let active = '';
  let release: (() => void) | undefined;
  for (const key of keys()) {
    const acquired = await claim(key);
    if (!acquired) continue;
    try {
      const saved = read(key);
      if (saved.pending.length) { release?.(); active = key; release = acquired; break; }
      if (!release) { active = key; release = acquired; }
      else acquired();
    }
    catch { acquired(); release?.(); throw new Error('Há uma cópia local que não pôde ser lida. Ela foi preservada; não limpe os dados do navegador.'); }
  }
  if (!release) {
    active = prefix + crypto.randomUUID();
    release = await claim(active);
    if (!release) throw new Error('Não foi possível abrir a cópia local. Tente novamente.');
  }
  const close = () => { release?.(); release = undefined; };
  try {
    // Migration of the previous shared queue is claimed once, and only removed
    // AFTER a complete durable write. Old browser data never gets discarded.
    const legacyRelease = await claim(legacy);
    if (legacyRelease) {
      try {
        const old = storage.getItem(legacy);
        if (old && parsePending(JSON.parse(old)).length && !read(active).pending.length) {
          storage.setItem(active, JSON.stringify({ ...read(active), pending: parsePending(JSON.parse(old)) }));
          storage.removeItem(legacy);
        }
      } finally { legacyRelease(); }
    }
    // Reserve even an empty journal while this tab is alive.
    storage.setItem(active, JSON.stringify(read(active)));
  } catch (error) { close(); throw error; }
  return {
    read: () => read(active),
    write: snapshot => {
      storage.setItem(active, JSON.stringify(snapshot));
      // Failure of the optional shared snapshot must not mask failure of journal writes.
      if (!snapshot.pending.length && snapshot.data) {
        try { storage.setItem(snapshotKey, JSON.stringify(snapshot.data)); } catch { /* Journal is durable. */ }
      }
    },
    recoverNext: async accept => {
      for (const key of keys()) {
        if (key === active) continue;
        const acquired = await claim(key);
        if (!acquired) continue;
        try {
          const saved = read(key);
          if (!saved.pending.length) { storage.removeItem(key); acquired(); continue; }
          if (!accept(saved)) { acquired(); return false; }
          storage.removeItem(active);
          release?.(); active = key; release = acquired;
          return true;
        } catch (error) { acquired(); throw error; }
      }
      return false;
    },
    close,
  };
}
