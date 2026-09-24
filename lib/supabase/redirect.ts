export function safeReturnPath(requested: string | null) {
  const next = requested ?? '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  try { const target = new URL(next, 'https://local.invalid'); if (target.origin !== 'https://local.invalid') return '/'; }
  catch { return '/'; }
  return next;
}
