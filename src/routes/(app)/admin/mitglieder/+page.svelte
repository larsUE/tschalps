<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const roleLabel = { user: 'Mitglied', admin: 'Admin' } as Record<string, string>;
	const dateFormat = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium' });
</script>

<svelte:head>
	<title>Mitglieder · Tschalps</title>
</svelte:head>

<section class="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
	<div>
		<h1 class="text-2xl font-bold">Mitglieder</h1>
		<p class="mt-1 text-stone-600">
			{data.members.length}
			{data.members.length === 1 ? 'Person hat' : 'Personen haben'} Zugang zur Plattform.
		</p>
	</div>

	<div class="rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
		<h2 class="mb-4 font-semibold">Mitglied einladen</h2>
		<form
			method="POST"
			action="?/invite"
			use:enhance
			class="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
		>
			<input
				name="name"
				placeholder="Vor- und Nachname"
				required
				value={form?.invite?.name ?? ''}
				class="rounded-lg border-stone-300 focus:border-emerald-600 focus:ring-emerald-600"
			/>
			<input
				name="email"
				type="email"
				placeholder="E-Mail-Adresse"
				required
				value={form?.invite?.email ?? ''}
				class="rounded-lg border-stone-300 focus:border-emerald-600 focus:ring-emerald-600"
			/>
			<select
				name="role"
				class="rounded-lg border-stone-300 focus:border-emerald-600 focus:ring-emerald-600"
			>
				<option value="user">Mitglied</option>
				<option value="admin">Admin</option>
			</select>
			<button
				class="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
			>
				Einladen
			</button>
		</form>
		{#if form?.invite?.error}
			<p class="mt-3 text-sm text-red-700">{form.invite.error}</p>
		{:else if form?.invited}
			<p class="mt-3 text-sm text-emerald-800">Einladung an {form.invited} verschickt.</p>
		{/if}
	</div>

	{#if form?.error}
		<p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{form.error}</p>
	{/if}

	<div class="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-stone-200 text-stone-500">
				<tr>
					<th class="px-4 py-3 font-medium">Name</th>
					<th class="px-4 py-3 font-medium">E-Mail</th>
					<th class="px-4 py-3 font-medium">Rolle</th>
					<th class="px-4 py-3 font-medium">Seit</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#each data.members as member (member.id)}
					{@const isSelf = member.id === data.user.id}
					<tr class={member.banned ? 'text-stone-400' : ''}>
						<td class="px-4 py-3 font-medium">
							{member.name}
							{#if member.banned}<span class="ml-2 text-xs font-normal">(deaktiviert)</span>{/if}
						</td>
						<td class="px-4 py-3">{member.email}</td>
						<td class="px-4 py-3">
							{#if isSelf}
								{roleLabel[member.role ?? 'user'] ?? member.role}
							{:else}
								<form method="POST" action="?/setRole" use:enhance>
									<input type="hidden" name="userId" value={member.id} />
									<select
										name="role"
										value={member.role ?? 'user'}
										onchange={(e) => e.currentTarget.form?.requestSubmit()}
										class="rounded-md border-stone-300 py-1 text-sm"
										aria-label="Rolle von {member.name}"
									>
										<option value="user">Mitglied</option>
										<option value="admin">Admin</option>
									</select>
								</form>
							{/if}
						</td>
						<td class="px-4 py-3 whitespace-nowrap">{dateFormat.format(member.createdAt)}</td>
						<td class="px-4 py-3 text-right">
							{#if !isSelf}
								<form
									method="POST"
									action={member.banned ? '?/reactivate' : '?/deactivate'}
									use:enhance
								>
									<input type="hidden" name="userId" value={member.id} />
									<button class="text-sm text-stone-600 underline hover:text-stone-900">
										{member.banned ? 'Reaktivieren' : 'Deaktivieren'}
									</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
