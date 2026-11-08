<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Logo from '#lib/components/Logo.svelte';
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

	const initials = $derived(
		(data.user.name || data.user.email)
			.split(/[\s@.]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]!.toUpperCase())
			.join('')
	);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<!-- App shell: fixed viewport height, content scrolls inside <main> (map pages fill it). -->
<div class="flex h-dvh flex-col bg-paper text-ink">
	<header class="bg-ink text-paper">
		<div class="flex flex-wrap items-center gap-x-8 px-4 sm:flex-nowrap sm:px-6">
			<a
				href={resolve('/(app)')}
				class="flex min-h-14 items-center text-paper"
				aria-label="Tschalps"
			>
				<Logo />
			</a>
			<!-- Phones: own scrollable row below logo and logout. Larger screens: inline. -->
			<nav
				aria-label="Hauptnavigation"
				class="order-last -mx-3 flex basis-full overflow-x-auto sm:order-none sm:mx-0 sm:flex-1 sm:basis-auto"
			>
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class="border-b-[3px] border-transparent px-3 pt-3 pb-2.5 whitespace-nowrap text-header-muted hover:text-white aria-[current=page]:border-trail aria-[current=page]:font-semibold aria-[current=page]:text-white sm:pt-4 sm:pb-3.5"
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-3 text-sm">
				<span
					class="grid size-8 place-items-center rounded-full bg-ink-raised text-[13px] font-semibold"
					title={data.user.name || data.user.email}
					aria-hidden="true"
				>
					{initials}
				</span>
				<span class="sr-only">Angemeldet als {data.user.name || data.user.email}</span>
				<form method="POST" action="/logout">
					<button class="min-h-11 px-1 text-header-muted hover:text-white">Abmelden</button>
				</form>
			</div>
		</div>
	</header>

	<main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
		{@render children()}
	</main>
</div>
