<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import ThemeToggle from '$lib/ThemeToggle.svelte';
	import NotificationBell from '$lib/NotificationBell.svelte';
	import Toast from '$lib/Toast.svelte';

	let { children, data } = $props();

	const navItems = [
		{ href: '/', label: 'Home' },
		{ href: '/calendar', label: 'Calendar' },
		{ href: '/finances', label: 'Finances' },
		{ href: '/todos', label: 'To-Dos' },
		{ href: '/shopping', label: 'Shopping' },
		{ href: '/meals', label: 'Meals' },
		{ href: '/notes', label: 'Notes' },
		{ href: '/photos', label: 'Photos' },
		{ href: '/spotify', label: 'Spotify' },
		{ href: '/emergency', label: 'Emergency Info' }
	];

	let mobileOpen = $state(false);
	const isDisplayMode = $derived(page.url.pathname.startsWith('/display'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#5c3d21" />
</svelte:head>

{#if isDisplayMode}
	{@render children()}
{:else if data.user}
	<div class="min-h-screen bg-gray-50">
		<header class="sticky top-0 z-10 border-b border-gray-200 border-t-4 border-t-wood-500 bg-white">
			<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
				<a href="/" class="text-base font-semibold text-gray-900">🏡 Home Dashboard</a>

				<nav class="hidden flex-wrap items-center gap-1 lg:flex">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {page.url
								.pathname === item.href
								? 'bg-wood-600 text-white'
								: 'text-gray-600 hover:bg-gray-100'}"
						>
							{item.label}
						</a>
					{/each}
				</nav>

				<div class="flex items-center gap-1">
					<span class="mr-1 hidden items-center gap-1.5 text-sm font-medium text-gray-700 sm:flex">
						<span
							class="inline-block h-2.5 w-2.5 rounded-full"
							style="background-color: {data.user.color}"
						></span>
						{data.user.display_name}
					</span>
					<NotificationBell activity={data.recentActivity ?? []} unreadCount={data.unreadActivityCount ?? 0} />
					<ThemeToggle />
					<a href="/display" class="btn-outline">Display</a>
					<form method="POST" action="/logout">
						<button
							type="submit"
							class="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
						>
							Sign out
						</button>
					</form>
					<button
						class="rounded-md p-1.5 text-gray-600 lg:hidden"
						onclick={() => (mobileOpen = !mobileOpen)}
						aria-label="Toggle menu"
					>
						☰
					</button>
				</div>
			</div>

			{#if mobileOpen}
				<nav class="flex flex-col gap-1 border-t border-gray-200 px-4 py-2 lg:hidden">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							onclick={() => (mobileOpen = false)}
							class="rounded-md px-3 py-2 text-sm font-medium {page.url.pathname === item.href
								? 'bg-wood-600 text-white'
								: 'text-gray-600 hover:bg-gray-100'}"
						>
							{item.label}
						</a>
					{/each}
					<a
						href="/display"
						onclick={() => (mobileOpen = false)}
						class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
					>
						Living Room Display
					</a>
				</nav>
			{/if}
		</header>

		<main class="mx-auto max-w-6xl px-4 py-6">
			{@render children()}
		</main>
	</div>
{:else}
	{@render children()}
{/if}

<Toast />
