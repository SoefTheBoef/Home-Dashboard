<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import PersonBadge from '$lib/PersonBadge.svelte';
	import { createUndoDelete } from '$lib/undoDelete.svelte';
	import { formatCurrency, formatDate } from '$lib/format';
	import { addDays, todayYmd } from '$lib/calendar-date';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const TABS = [
		{ id: 'transactions', label: 'Income & Expenses' },
		{ id: 'bills', label: 'Bills' },
		{ id: 'subscriptions', label: 'Subscriptions' }
	] as const;

	// --- Transactions ---
	let showAddForm = $state(false);
	const undoDeleteTx = createUndoDelete('?/deleteTransaction');
	const visibleTransactions = $derived(data.transactions.filter((t) => !undoDeleteTx.isPending(t.id)));
	const netThisMonth = $derived(data.monthIncome - data.monthExpenses);

	const exportHref = $derived.by(() => {
		const params = new URLSearchParams();
		if (data.filters.dateFrom) params.set('from', data.filters.dateFrom);
		if (data.filters.dateTo) params.set('to', data.filters.dateTo);
		if (data.filters.category) params.set('category', data.filters.category);
		if (data.filters.type) params.set('type', data.filters.type);
		const qs = params.toString();
		return `/finances/export${qs ? `?${qs}` : ''}`;
	});

	// --- Bills ---
	let showBillForm = $state(false);
	let showTemplateForm = $state(false);
	let editingTemplateId = $state<number | null>(null);
	const undoDeleteBill = createUndoDelete('?/deleteBill');
	const undoDeleteTemplate = createUndoDelete('?/deleteBillTemplate');
	const visibleBills = $derived(data.bills.filter((b) => !undoDeleteBill.isPending(b.id)));
	const visibleTemplates = $derived(data.templates.filter((t) => !undoDeleteTemplate.isPending(t.id)));
	const unpaidTotal = $derived(visibleBills.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0));

	function billStatus(b: (typeof data.bills)[number]): 'paid' | 'overdue' | 'soon' | 'upcoming' {
		if (b.paid) return 'paid';
		const today = todayYmd();
		const soonStr = addDays(today, 7);
		if (b.due_date < today) return 'overdue';
		if (b.due_date <= soonStr) return 'soon';
		return 'upcoming';
	}

	const billStatusStyles: Record<string, string> = {
		paid: 'border-gray-200 opacity-60',
		overdue: 'border-wood-500 bg-wood-50 dark:bg-wood-900/20',
		soon: 'border-gray-400 bg-gray-50 dark:bg-gray-800',
		upcoming: 'border-gray-200'
	};

	function ordinal(n: number): string {
		if (n >= 11 && n <= 13) return `${n}th`;
		switch (n % 10) {
			case 1:
				return `${n}st`;
			case 2:
				return `${n}nd`;
			case 3:
				return `${n}rd`;
			default:
				return `${n}th`;
		}
	}

	async function togglePaidBill(id: number) {
		const fd = new FormData();
		fd.set('id', String(id));
		await fetch('?/togglePaidBill', { method: 'POST', body: fd });
		await invalidateAll();
	}

	// --- Subscriptions ---
	let showSubForm = $state(false);
	let editingSubId = $state<number | null>(null);
	const undoDeleteSub = createUndoDelete('?/deleteSubscription');
	const visibleSubscriptions = $derived(data.subscriptions.filter((s) => !undoDeleteSub.isPending(s.id)));

	function isRenewingSoon(dateStr: string): boolean {
		return dateStr <= addDays(todayYmd(), 7);
	}

	const cycleLabels: Record<string, string> = {
		weekly: '/week',
		monthly: '/month',
		quarterly: '/quarter',
		yearly: '/year'
	};

	const monthlyEquivalent = (n: number, cycle: string) => {
		if (cycle === 'weekly') return (n * 52) / 12;
		if (cycle === 'quarterly') return n / 3;
		if (cycle === 'yearly') return n / 12;
		return n;
	};

	const activeSubs = $derived(visibleSubscriptions.filter((s) => s.active));
	const cancelledSubs = $derived(visibleSubscriptions.filter((s) => !s.active));
	const estimatedMonthlyTotal = $derived(
		activeSubs.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billing_cycle), 0)
	);
</script>

<svelte:head>
	<title>Finances — Home Dashboard</title>
</svelte:head>

<h1 class="mb-4 text-xl font-semibold text-gray-900">Finances</h1>

<nav class="mb-6 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-800">
	{#each TABS as t (t.id)}
		<a
			href="?tab={t.id}"
			class="rounded-t-md px-3 py-2 text-sm font-medium {data.tab === t.id
				? 'border-b-2 border-wood-600 text-wood-700 dark:text-wood-300'
				: 'text-gray-500 hover:text-gray-800'}"
		>
			{t.label}
		</a>
	{/each}
</nav>

{#if data.tab === 'bills'}
	<div class="mb-6">
		<div class="mb-3 flex items-center justify-between">
			<div>
				<h2 class="text-sm font-semibold text-gray-900">Fixed monthly bills</h2>
				<p class="text-xs text-gray-500">Auto-generates a new unpaid entry each month.</p>
			</div>
			<button type="button" onclick={() => (showTemplateForm = !showTemplateForm)} class="btn-outline">
				{showTemplateForm ? 'Cancel' : '+ Add fixed bill'}
			</button>
		</div>

		{#if showTemplateForm}
			<form
				method="POST"
				action="?/createBillTemplate"
				use:enhance={() => async ({ update }) => {
					await update();
					showTemplateForm = false;
				}}
				class="mb-3 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
			>
				<input name="name" placeholder="Bill name (e.g. Rent)" required class="input" />
				<input type="number" step="0.01" min="0.01" name="amount" placeholder="Amount" required class="input" />
				<input type="number" min="1" max="31" name="due_day" placeholder="Due day of month (1-31)" required class="input" />
				<input name="category" placeholder="Category (optional)" class="input" />
				<button type="submit" class="btn-primary col-span-1 py-2 text-sm sm:col-span-2"> Save </button>
			</form>
		{/if}

		{#if visibleTemplates.length === 0}
			<p class="empty-state">No fixed monthly bills set up yet.</p>
		{:else}
			<ul class="space-y-2">
				{#each visibleTemplates as t (t.id)}
					<li class="rounded-lg border border-gray-200 p-3 {t.active ? '' : 'opacity-60'}">
						{#if editingTemplateId === t.id}
							<form
								method="POST"
								action="?/updateBillTemplate"
								use:enhance={() => async ({ update }) => {
									await update();
									editingTemplateId = null;
								}}
								class="grid grid-cols-1 gap-2 sm:grid-cols-2"
							>
								<input type="hidden" name="id" value={t.id} />
								<input name="name" value={t.name} required class="input" />
								<input type="number" step="0.01" min="0.01" name="amount" value={t.amount} required class="input" />
								<input type="number" min="1" max="31" name="due_day" value={t.due_day} required class="input" />
								<input name="category" value={t.category ?? ''} class="input" />
								<div class="col-span-1 flex gap-2 sm:col-span-2">
									<button type="submit" class="btn-primary">Save</button>
									<button type="button" onclick={() => (editingTemplateId = null)} class="btn-outline"
										>Cancel</button
									>
								</div>
							</form>
						{:else}
							<div class="flex items-center justify-between gap-2">
								<div>
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium text-gray-900">{t.name}</span>
										{#if t.category}<span class="badge-neutral">{t.category}</span>{/if}
										{#if !t.active}<span class="badge-neutral">Paused</span>{/if}
									</div>
									<p class="text-xs text-gray-500">Due the {ordinal(t.due_day)} of each month</p>
								</div>
								<div class="flex items-center gap-3">
									<span class="text-sm font-semibold text-gray-900">{formatCurrency(t.amount)}</span>
									<button type="button" onclick={() => (editingTemplateId = t.id)} class="btn-outline"
										>Edit</button
									>
									<form method="POST" action="?/toggleBillTemplateActive" use:enhance>
										<input type="hidden" name="id" value={t.id} />
										<button type="submit" class="btn-outline">{t.active ? 'Pause' : 'Resume'}</button>
									</form>
									<button
										type="button"
										onclick={() => undoDeleteTemplate.requestDelete(t.id, 'Fixed bill')}
										class="btn-danger"
									>
										Delete
									</button>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="mb-4 flex items-center justify-between">
		<div>
			<h2 class="text-sm font-semibold text-gray-900">Bills</h2>
			<p class="text-xs text-gray-500">{formatCurrency(unpaidTotal)} unpaid</p>
		</div>
		<button type="button" onclick={() => (showBillForm = !showBillForm)} class="btn-primary">
			{showBillForm ? 'Cancel' : '+ Add one-off bill'}
		</button>
	</div>

	{#if showBillForm}
		<form
			method="POST"
			action="?/createBill"
			use:enhance={() => async ({ update }) => {
				await update();
				showBillForm = false;
			}}
			class="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
		>
			<input name="name" placeholder="Bill name" required class="input" />
			<input type="number" step="0.01" min="0.01" name="amount" placeholder="Amount" required class="input" />
			<input type="date" name="due_date" value={todayYmd()} required class="input" />
			<input name="category" placeholder="Category (optional)" class="input" />
			<button type="submit" class="btn-primary col-span-1 py-2 text-sm sm:col-span-2"> Save </button>
		</form>
	{/if}

	{#if visibleBills.length === 0}
		<p class="empty-state">No bills yet — add your first one above.</p>
	{:else}
		<ul class="space-y-2">
			{#each visibleBills as b (b.id)}
				<li class="flex items-center justify-between gap-2 rounded-lg border p-3 {billStatusStyles[billStatus(b)]}">
					<div class="flex items-center gap-3">
						<input
							type="checkbox"
							checked={!!b.paid}
							onchange={() => togglePaidBill(b.id)}
							class="checkbox-touch"
							aria-label="Mark {b.name} as {b.paid ? 'unpaid' : 'paid'}"
						/>
						<div>
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-900">{b.name}</span>
								{#if b.category}<span class="badge-neutral">{b.category}</span>{/if}
								{#if b.template_id}<span class="badge-neutral">Fixed monthly</span>{/if}
								{#if billStatus(b) === 'overdue'}<span class="badge-strong">Overdue</span>{/if}
								{#if billStatus(b) === 'soon'}<span class="badge-neutral font-semibold">Due soon</span>{/if}
							</div>
							<p class="text-xs text-gray-500">
								{b.paid ? `Paid ${formatDate(b.paid_date ?? '')} · logged as an expense` : `Due ${formatDate(b.due_date)}`}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-sm font-semibold text-gray-900">{formatCurrency(b.amount)}</span>
						<button type="button" onclick={() => undoDeleteBill.requestDelete(b.id, 'Bill')} class="btn-danger">
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{:else if data.tab === 'subscriptions'}
	<div class="mb-4 flex items-center justify-between">
		<div>
			<p class="text-xs text-gray-500">~{formatCurrency(estimatedMonthlyTotal)}/month across active subscriptions</p>
		</div>
		<button type="button" onclick={() => (showSubForm = !showSubForm)} class="btn-primary">
			{showSubForm ? 'Cancel' : '+ Add subscription'}
		</button>
	</div>

	{#if showSubForm}
		<form
			method="POST"
			action="?/createSubscription"
			use:enhance={() => async ({ update }) => {
				await update();
				showSubForm = false;
			}}
			class="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
		>
			<input name="name" placeholder="Name (e.g. Netflix)" required class="input" />
			<input type="number" step="0.01" min="0.01" name="amount" placeholder="Amount" required class="input" />
			<select name="billing_cycle" class="input">
				<option value="monthly">Monthly</option>
				<option value="weekly">Weekly</option>
				<option value="quarterly">Quarterly</option>
				<option value="yearly">Yearly</option>
			</select>
			<input type="date" name="next_charge_date" value={todayYmd()} required class="input" />
			<input name="category" placeholder="Category (optional)" class="input col-span-2" />
			<button type="submit" class="btn-primary col-span-2 py-2 text-sm">Save</button>
		</form>
	{/if}

	{#if activeSubs.length === 0}
		<p class="empty-state">No subscriptions tracked yet — add one above.</p>
	{:else}
		<ul class="space-y-2">
			{#each activeSubs as s (s.id)}
				<li class="rounded-lg border p-3 {isRenewingSoon(s.next_charge_date) ? 'border-gray-400 bg-gray-50 dark:bg-gray-800' : 'border-gray-200'}">
					{#if editingSubId === s.id}
						<form
							method="POST"
							action="?/updateSubscription"
							use:enhance={() => async ({ update }) => {
								await update();
								editingSubId = null;
							}}
							class="grid grid-cols-1 gap-2 sm:grid-cols-2"
						>
							<input type="hidden" name="id" value={s.id} />
							<input name="name" value={s.name} required class="input" />
							<input type="number" step="0.01" min="0.01" name="amount" value={s.amount} required class="input" />
							<select name="billing_cycle" class="input" value={s.billing_cycle}>
								<option value="monthly">Monthly</option>
								<option value="weekly">Weekly</option>
								<option value="quarterly">Quarterly</option>
								<option value="yearly">Yearly</option>
							</select>
							<input type="date" name="next_charge_date" value={s.next_charge_date} required class="input" />
							<input name="category" value={s.category ?? ''} class="input col-span-2" />
							<div class="col-span-2 flex gap-2">
								<button type="submit" class="btn-primary">Save</button>
								<button type="button" onclick={() => (editingSubId = null)} class="btn-outline">Cancel</button>
							</div>
						</form>
					{:else}
						<div class="flex items-center justify-between gap-2">
							<div>
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-gray-900">{s.name}</span>
									{#if s.category}<span class="badge-neutral">{s.category}</span>{/if}
									{#if isRenewingSoon(s.next_charge_date)}<span class="badge-strong">Renewing soon</span>{/if}
								</div>
								<p class="text-xs text-gray-500">Next charge {formatDate(s.next_charge_date)}</p>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-sm font-semibold text-gray-900">{formatCurrency(s.amount)}{cycleLabels[s.billing_cycle]}</span>
								<form method="POST" action="?/renewSubscription" use:enhance>
									<input type="hidden" name="id" value={s.id} />
									<button type="submit" class="btn-outline">Renewed</button>
								</form>
								<button type="button" onclick={() => (editingSubId = s.id)} class="btn-outline">Edit</button>
								<form method="POST" action="?/toggleSubscriptionActive" use:enhance>
									<input type="hidden" name="id" value={s.id} />
									<button type="submit" class="btn-outline">Cancel sub</button>
								</form>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if cancelledSubs.length > 0}
		<h2 class="mb-2 mt-6 text-xs font-semibold uppercase text-gray-400">Cancelled</h2>
		<ul class="space-y-2">
			{#each cancelledSubs as s (s.id)}
				<li class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 opacity-60">
					<span class="text-sm text-gray-500">{s.name}</span>
					<div class="flex items-center gap-2">
						<span class="text-xs text-gray-400">{formatCurrency(s.amount)}{cycleLabels[s.billing_cycle]}</span>
						<form method="POST" action="?/toggleSubscriptionActive" use:enhance>
							<input type="hidden" name="id" value={s.id} />
							<button type="submit" class="btn-outline">Reactivate</button>
						</form>
						<button type="button" onclick={() => undoDeleteSub.requestDelete(s.id, 'Subscription')} class="btn-danger">
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="card p-3">
			<p class="text-xs text-gray-500">Balance</p>
			<p class="text-lg font-semibold text-gray-900">{formatCurrency(data.balance)}</p>
		</div>
		<div class="card p-3">
			<p class="text-xs text-gray-500">This month income</p>
			<p class="text-lg font-semibold text-gray-900">{formatCurrency(data.monthIncome)}</p>
		</div>
		<div class="card p-3">
			<p class="text-xs text-gray-500">This month expenses</p>
			<p class="text-lg font-semibold text-gray-900">{formatCurrency(data.monthExpenses)}</p>
		</div>
		<div class="card p-3">
			<p class="text-xs text-gray-500">This month net</p>
			<p class="text-lg font-semibold text-gray-900">{formatCurrency(netThisMonth)}</p>
		</div>
	</div>

	{#if data.categoryBreakdown.length > 0}
		<div class="mb-6 card">
			<h2 class="mb-2 text-sm font-semibold text-gray-900">This month's spending by category</h2>
			<div class="space-y-1.5">
				{#each data.categoryBreakdown as c (c.category)}
					{@const pct = data.monthExpenses > 0 ? (c.total / data.monthExpenses) * 100 : 0}
					<div>
						<div class="flex justify-between text-xs text-gray-600">
							<span>{c.category}</span>
							<span>{formatCurrency(c.total)}</span>
						</div>
						<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
							<div class="h-full rounded-full bg-wood-500" style="width:{pct}%"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-sm font-semibold text-gray-900">Transactions</h2>
		<div class="flex gap-2">
			<a href={exportHref} class="btn-outline" download>Export CSV</a>
			<button type="button" onclick={() => (showAddForm = !showAddForm)} class="btn-primary">
				{showAddForm ? 'Cancel' : '+ Add transaction'}
			</button>
		</div>
	</div>

	{#if showAddForm}
		<form
			method="POST"
			action="?/createTransaction"
			use:enhance={() => async ({ update, formElement }) => {
				await update();
				formElement.reset();
				showAddForm = false;
			}}
			class="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2"
		>
			<select name="type" class="input">
				<option value="expense">Expense</option>
				<option value="income">Income</option>
			</select>
			<input type="number" step="0.01" min="0.01" name="amount" placeholder="Amount" required class="input" />
			<input name="category" placeholder="Category" required list="category-suggestions" class="input" />
			<datalist id="category-suggestions">
				{#each data.categories as c (c)}<option value={c}></option>{/each}
			</datalist>
			<input type="date" name="date" value={todayYmd()} required class="input" />
			<input name="description" placeholder="Description (optional)" class="input col-span-2" />
			<button type="submit" class="btn-primary col-span-2 py-2 text-sm"> Save </button>
		</form>
	{/if}

	<form class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5" data-sveltekit-keepfocus>
		<input type="hidden" name="tab" value="transactions" />
		<input type="date" name="from" value={data.filters.dateFrom} class="input" placeholder="From" />
		<input type="date" name="to" value={data.filters.dateTo} class="input" placeholder="To" />
		<select name="category" class="input">
			<option value="">All categories</option>
			{#each data.categories as c (c)}
				<option value={c} selected={data.filters.category === c}>{c}</option>
			{/each}
		</select>
		<select name="type" class="input">
			<option value="">All types</option>
			<option value="income" selected={data.filters.type === 'income'}>Income</option>
			<option value="expense" selected={data.filters.type === 'expense'}>Expense</option>
		</select>
		<button type="submit" class="btn-outline">Filter</button>
	</form>

	{#if visibleTransactions.length === 0}
		<p class="empty-state">No transactions match these filters.</p>
	{:else}
		<ul class="space-y-2">
			{#each visibleTransactions as t (t.id)}
				<li class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3">
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-gray-900">{t.category}</span>
							<PersonBadge name={t.logger_name} color={t.logger_color} />
						</div>
						<p class="text-xs text-gray-500">{formatDate(t.date)}{t.description ? ` · ${t.description}` : ''}</p>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-sm font-semibold text-gray-900">
							{t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
						</span>
						<button type="button" onclick={() => undoDeleteTx.requestDelete(t.id, 'Transaction')} class="btn-danger">
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
