import type {NextRequest} from 'next/server';
import {updateSession} from '@/lib/supabase/proxy';

export function proxy(request:NextRequest){return updateSession(request);}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js|exercise-media).*)']};
