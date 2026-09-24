import type { Entity, FitnessData, Resource } from './model';

export type Attempt = { resource: Resource; id: string; entity: Entity; remove?: boolean; version: number; stamp: number };
export type PendingChange = Attempt & { attempt?: Attempt };

const collections = { exercise: 'exercises', routine: 'routines', session: 'sessions', measurement: 'measurements' } as const;

function serverEntity(data: FitnessData, change: PendingChange): Entity | undefined {
  if (change.resource === 'profile') return data.profile.id === change.id ? data.profile : undefined;
  return data[collections[change.resource]].find((entity) => entity.id === change.id);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}

export function sameEntity(a: unknown, b: unknown) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function applyChange(data: FitnessData, change: Attempt): FitnessData {
  if (change.resource === 'profile') return { ...data, profile: change.entity as FitnessData['profile'] };
  const key = collections[change.resource];
  const list = data[key].filter((entity) => entity.id !== change.id);
  return { ...data, [key]: change.remove ? list : [...list, change.entity] };
}

/** A response may be lost after Supabase committed a write. Do not replay it as a new edit. */
export function reconcilePending(server: FitnessData, changes: PendingChange[]) {
  const remaining: PendingChange[] = [];
  const conflicts: PendingChange[] = [];
  for (const change of changes) {
    const version = server.versions[change.id] ?? 0;
    const saved = serverEntity(server, change);
    const deleted = server.deletedIds?.includes(change.id) ?? false;
    // First acknowledge the frozen request, not the newer UI value. Only the next
    // version proves that request; equal content at a later version is not proof.
    const attempt = change.attempt;
    const acknowledged = attempt && (attempt.remove ? version === 0 || (deleted && version === attempt.version + 1)
      : version === attempt.version + 1 && saved !== undefined && sameEntity(saved, attempt.entity));
    const next = acknowledged ? { ...change, version, attempt: undefined } : change;
    // An unacknowledged request may still be committing after a timeout. Even if
    // the latest UI value equals this GET, establish the old request's outcome first.
    if (!next.attempt && (next.remove ? version === 0 || deleted : saved !== undefined && sameEntity(saved, next.entity))) continue;
    remaining.push(next);
    if (version !== next.version || (version > 0 && saved === undefined && !deleted)) conflicts.push(next);
  }
  return { remaining, conflicts };
}
