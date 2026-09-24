import type { SupabaseClient } from '@supabase/supabase-js';
import { initialData } from './seed';
import type { Entity, FitnessData, Resource } from './model';

export type FitnessRow = { id: string; resource: Resource; payload: unknown; version: number; deleted_at?: string | null };
type Database = Pick<SupabaseClient, 'from'>;

export async function readFitnessData(supabase: Database, uid: string, name: string): Promise<FitnessData> {
  const readRows = async () => {
    const { data, error } = await supabase.from('fitness_resources').select('id,resource,payload,version,deleted_at').eq('user_id', uid);
    if (error) throw error;
    return (data ?? []) as FitnessRow[];
  };
  let rows = await readRows();
  const mockIds = rows.filter(row => (row.resource === 'session' && (row.payload as { isDemo?: boolean })?.isDemo === true)
    || (row.resource === 'routine' && row.id.startsWith(`${uid}:routine-`))).map(row => row.id);
  if (mockIds.length) {
    const cleared = await supabase.from('fitness_resources').delete().eq('user_id', uid).in('id', mockIds);
    if (cleared.error) throw cleared.error;
    rows = rows.filter(row => !mockIds.includes(row.id));
  }
  if (!rows.some(row => row.resource === 'profile')) {
    const seed = initialData(uid, name);
    // ON CONFLICT DO NOTHING: a concurrent onboarding/save must never be reset.
    const created = await supabase.from('fitness_resources').upsert(
      { user_id: uid, id: uid, resource: 'profile', payload: seed.profile, version: 1 },
      { onConflict: 'user_id,id', ignoreDuplicates: true },
    );
    if (created.error) throw created.error;
    // Re-read the whole account: creation results contain neither existing
    // routines nor a concurrent profile when the INSERT was skipped.
    rows = await readRows();
  }
  const profile = rows.find(row => row.resource === 'profile');
  if (!profile) throw new Error('Perfil indisponível.');
  const list = (resource: Resource) => rows.filter(row => row.resource === resource && !row.deleted_at).map(row => row.payload);
  return {
    profile: profile.payload as FitnessData['profile'], exercises: list('exercise') as FitnessData['exercises'],
    routines: list('routine') as FitnessData['routines'], sessions: list('session') as FitnessData['sessions'],
    measurements: list('measurement') as FitnessData['measurements'], versions: Object.fromEntries(rows.map(row => [row.id, row.version])),
    deletedIds: rows.filter(row => !!row.deleted_at).map(row => row.id),
  };
}

/** null means CAS/unique conflict; only the authenticated route supplies uid. */
export async function saveFitnessResource(supabase: Database, uid: string,
  change: { id: string; resource: Resource; entity?: Entity; version: number; remove?: boolean },
): Promise<number | null> {
  const { id, resource, version, entity, remove } = change;
  if (remove) {
    // Keep only the version marker, not the deleted workout payload. Reusing the
    // ID can then never reset its version and admit a stale device's write.
    const now = new Date().toISOString();
    const result = await supabase.from('fitness_resources').update({ payload: {}, deleted_at: now, updated_at: now, version: version + 1 })
      .eq('user_id', uid).eq('id', id).eq('resource', resource).eq('version', version).select('version').maybeSingle();
    if (result.error) throw result.error;
    return result.data?.version ?? null;
  }
  if (version === 0) {
    const created = await supabase.from('fitness_resources').insert({ user_id: uid, id, resource, payload: entity, version: 1 }).select('version').maybeSingle();
    if (created.error) { if (created.error.code === '23505') return null; throw created.error; }
    if (!created.data) throw new Error('Inserção sem confirmação.');
    return created.data.version;
  }
  const updated = await supabase.from('fitness_resources').update({ payload: entity, deleted_at: null, version: version + 1, updated_at: new Date().toISOString() })
    .eq('user_id', uid).eq('id', id).eq('resource', resource).eq('version', version).select('version').maybeSingle();
  if (updated.error) throw updated.error;
  return updated.data?.version ?? null;
}
