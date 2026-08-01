<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Sign in — Home Dashboard</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-100 px-4">
	<div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
		<h1 class="mb-1 text-xl font-semibold text-gray-900">Home Dashboard</h1>
		<p class="mb-6 text-sm text-gray-500">Sign in to continue</p>

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="username" class="mb-1 block text-sm font-medium text-gray-700">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					value={form?.username ?? ''}
					required
					class="input"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-gray-700">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="input"
				/>
			</div>

			{#if form?.error}
				<p class="text-sm font-medium text-gray-800">{form.error}</p>
			{/if}

			<button type="submit" disabled={loading} class="btn-primary w-full py-2 text-sm">
				{loading ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>
</div>
