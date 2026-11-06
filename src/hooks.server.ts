import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

/** Apply pending SQL migrations from ./drizzle on startup. */
export const init: ServerInit = () => {
	if (!building) migrate(db, { migrationsFolder: 'drizzle' });
};

/** Paths reachable without a session. Everything else is members only. */
const PUBLIC_PATHS = ['/login', '/api/auth'];
const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const path = event.url.pathname;

	if (!session && !isPublic(path)) {
		if (path.startsWith('/api/')) return new Response('Unauthorized', { status: 401 });
		const target = path + event.url.search;
		redirect(303, target === '/' ? '/login' : `/login?redirectTo=${encodeURIComponent(target)}`);
	}

	if ((path === '/admin' || path.startsWith('/admin/')) && session?.user.role !== 'admin') {
		redirect(303, '/');
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
