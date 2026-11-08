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

<section class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-10 pb-20 sm:px-6 sm:pt-12">
	<div class="flex flex-col gap-3">
		<span class="eyebrow text-trail-dark">Admin</span>
		<h1 class="text-[64px] font-display sm:text-[96px]">Mitglieder</h1>
		<p class="text-lg text-ink-soft">
			{data.members.length}
			{data.members.length === 1 ? 'Person hat' : 'Personen haben'} Zugang zur Plattform.
		</p>
	</div>

	<div class="card p-5 sm:p-6">
		<h2 class="mb-4 text-[28px] font-display leading-none">Mitglied einladen</h2>
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
				class="field"
			/>
			<input
				name="email"
				type="email"
				placeholder="E-Mail-Adresse"
				required
				value={form?.invite?.email ?? ''}
				class="field"
			/>
			<select name="role" class="field">
				<option value="user">Mitglied</option>
				<option value="admin">Admin</option>
			</select>
			<button class="btn btn-primary">Einladen</button>
		</form>
		{#if form?.invite?.error}
			<p class="notice notice-error mt-4" role="alert">{form.invite.error}</p>
		{:else if form?.invited}
			<p class="notice notice-ok mt-4">Einladung an {form.invited} verschickt.</p>
		{/if}
	</div>

	{#if form?.error}
		<p class="notice notice-error" role="alert">{form.error}</p>
	{/if}

	<div class="card overflow-x-auto">
		<table class="w-full text-left text-[15px]">
			<thead class="border-b-2 border-ink eyebrow">
				<tr>
					<th class="px-4 py-3 font-medium">Name</th>
					<th class="px-4 py-3 font-medium">E-Mail</th>
					<th class="px-4 py-3 font-medium">Rolle</th>
					<th class="px-4 py-3 font-medium">Seit</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-line">
				{#each data.members as member (member.id)}
					{@const isSelf = member.id === data.user.id}
					<tr class={member.banned ? 'text-muted' : ''}>
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
										class="field min-h-9 w-auto py-1 text-sm"
										aria-label="Rolle von {member.name}"
									>
										<option value="user">Mitglied</option>
										<option value="admin">Admin</option>
									</select>
								</form>
							{/if}
						</td>
						<td class="px-4 py-3 nums text-sm whitespace-nowrap"
							>{dateFormat.format(member.createdAt)}</td
						>
						<td class="px-4 py-3 text-right">
							{#if !isSelf}
								<form
									method="POST"
									action={member.banned ? '?/reactivate' : '?/deactivate'}
									use:enhance
								>
									<input type="hidden" name="userId" value={member.id} />
									<button class="cursor-pointer text-sm underline hover:text-trail">
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
