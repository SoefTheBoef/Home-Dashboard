import * as adhan from 'adhan';

// Aartselaar, Antwerp province, Belgium — town center coordinates.
const AARTSELAAR = new adhan.Coordinates(51.1447, 4.3833);

function calculationParams() {
	const params = adhan.CalculationMethod.MuslimWorldLeague();
	params.madhab = adhan.Madhab.Hanafi;
	return params;
}

export interface PrayerTimeEntry {
	name: string;
	time: string; // ISO timestamp
}

export interface PrayerTimesResult {
	today: PrayerTimeEntry[];
	/** Tomorrow's Fajr, so a "next prayer" countdown still has a target after tonight's Isha. */
	nextFajr: string;
}

/** Today's six prayer times for Aartselaar (Muslim World League method, Hanafi madhab for Asr). */
export function getTodayPrayerTimes(): PrayerTimesResult {
	const now = new Date();
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const params = calculationParams();
	const todayTimes = new adhan.PrayerTimes(AARTSELAAR, now, params);
	const tomorrowTimes = new adhan.PrayerTimes(AARTSELAAR, tomorrow, params);

	return {
		today: [
			{ name: 'Fajr', time: todayTimes.fajr.toISOString() },
			{ name: 'Shorouk', time: todayTimes.sunrise.toISOString() },
			{ name: 'Dohr', time: todayTimes.dhuhr.toISOString() },
			{ name: 'Asr', time: todayTimes.asr.toISOString() },
			{ name: 'Maghrib', time: todayTimes.maghrib.toISOString() },
			{ name: 'Isha', time: todayTimes.isha.toISOString() }
		],
		nextFajr: tomorrowTimes.fajr.toISOString()
	};
}
