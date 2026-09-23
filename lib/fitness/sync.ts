import type { Entity, FitnessData, Resource } from './model';

export type PendingChange = { resource: Resource; id: string; entity: Entity; remove?: boolean; version: number; stamp: number };

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

/** A response may be lost after Supabase committed a write. Do not replay it as a new edit. */
export function reconcilePending(server: FitnessData, changes: PendingChange[]) {
  const remaining: PendingChange[] = [];
  const conflicts: PendingChange[] = [];
  for (const change of changes) {
    const version = server.versions[change.id] ?? 0;
    const saved = serverEntity(server, change);
    if (change.remove ? version === 0 : saved !== undefined && JSON.stringify(canonical(saved)) === JSON.stringify(canonical(change.entity))) continue;
    remaining.push(change);
    if (version !== change.version || (version > 0 && saved === undefined)) conflicts.push(change);
  }
  return { remaining, conflicts };
}
