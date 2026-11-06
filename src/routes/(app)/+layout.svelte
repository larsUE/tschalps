<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived([
		{ href: resolve('/(app)'), label: 'Karte' },
		{ href: resolve('/(app)/tschalps'), label: 'Tschalps' },
		{ href: resolve('/(app)/orte'), label: 'Orte' },
		...(data.user.isAdmin
			? [{ href: resolve('/(app)/admin/mitglieder'), label: 'Mitglieder' }]
			: [])
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<div class="flex min-h-dvh flex-col bg-stone-50 text-stone-900">
	<header class="border-b border-stone-200 bg-white">
		<div
			class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:flex-nowrap sm:py-3"
		>
			<a href={resolve('/(app)')} class="text-lg font-bold tracking-tight">Tschalps</a>
			<!-- Phones: own scrollable row below logo and logout. Larger screens: inline. -->
			<nav
				class="order-last -mx-3 flex basis-full gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:flex-1 sm:basis-auto"
			>
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class="rounded-md px-3 py-1.5 whitespace-nowrap text-stone-600 hover:bg-stone-100 hover:text-stone-900 aria-[current=page]:bg-emerald-50 aria-[current=page]:text-emerald-800"
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm">
				<span class="hidden text-stone-500 sm:inline">{data.user.name || data.user.email}</span>
				<form method="POST" action="/logout">
					<button
						class="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
					>
						Abmelden
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
</div>
