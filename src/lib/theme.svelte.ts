const STORAGE_KEY = 'theme-preference';

export type ThemePreference = 'light' | 'dark' | 'auto';

function isNight(atMs: number): boolean {
	const hour = new Date(atMs).getHours();
	return hour >= 19 || hour < 7;
}

function applyClass(dark: boolean) {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark', dark);
	document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function readStoredPreference(): ThemePreference {
	if (typeof localStorage === 'undefined') return 'auto';
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
}

class ThemeStore {
	preference = $state<ThemePreference>(readStoredPreference());
	private now = $state(Date.now());
	isDark = $derived(this.preference === 'dark' || (this.preference === 'auto' && isNight(this.now)));

	constructor() {
		if (typeof window !== 'undefined') {
			setInterval(() => (this.now = Date.now()), 60_000);
			$effect.root(() => {
				$effect(() => {
					applyClass(this.isDark);
				});
			});
		}
	}

	set(pref: ThemePreference) {
		this.preference = pref;
		if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, pref);
	}

	cycle() {
		const order: ThemePreference[] = ['light', 'dark', 'auto'];
		this.set(order[(order.indexOf(this.preference) + 1) % order.length] as ThemePreference);
	}
}

export const theme = new ThemeStore();
