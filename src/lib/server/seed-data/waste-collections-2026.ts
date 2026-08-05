/**
 * IGEAN 2026 collection calendar for Aartselaar, reconstructed from the household's PDF
 * (IGEAN-afvalkalender-2026-Aartselaar_.pdf) by cross-referencing its extracted per-day type
 * list against actual 2026 weekday/holiday dates (hv/gft alternate weekly on Wednesdays, pmd
 * runs biweekly on Thursdays, holidays shift nothing since they land on Mon/Fri/Sat/Sun) —
 * verified internally consistent end-to-end (unbroken weekly Wed alternation and unbroken
 * 14-day pmd rhythm, Jan–Dec) but NOT pixel-verified against the original grid. Two dates in
 * particular are worth a manual spot-check against the physical calendar:
 *  - 2026-01-07: PDF marks this "gewijzigde ophaling" (changed collection) — hv+pmd combined
 *    here because New Year's (Jan 1, a Thursday) likely pushed that week's pmd to the 7th.
 *  - 2026-11-11: falls on Wapenstilstand/Armistice Day, which the calendar separately marks
 *    "RP gesloten" (recyclagepark closed) — kept as a normal hv day since curbside collection
 *    and the recyclagepark's opening hours are independent, but double check it collects.
 * "RP gesloten" (park-closed) notices themselves aren't included below since they aren't
 * curbside pickup days — see PRAYER/README notes in the Recycling tab for how to correct/re-import.
 */
export interface WasteCollectionSeed {
	date: string;
	types: string[];
}

export const WASTE_COLLECTIONS_2026: WasteCollectionSeed[] = [
	{ date: '2026-01-07', types: ['hv', 'pmd'] },
	{ date: '2026-01-13', types: ['kerstboom'] },
	{ date: '2026-01-14', types: ['gft', 'pk'] },
	{ date: '2026-01-15', types: ['pmd'] },
	{ date: '2026-01-21', types: ['hv'] },
	{ date: '2026-01-23', types: ['sh'] },
	{ date: '2026-01-28', types: ['gft'] },
	{ date: '2026-01-29', types: ['pmd'] },
	{ date: '2026-02-04', types: ['hv'] },
	{ date: '2026-02-11', types: ['gft', 'pk'] },
	{ date: '2026-02-12', types: ['pmd', 'tex'] },
	{ date: '2026-02-18', types: ['hv'] },
	{ date: '2026-02-25', types: ['gft'] },
	{ date: '2026-02-26', types: ['pmd'] },
	{ date: '2026-03-04', types: ['hv'] },
	{ date: '2026-03-11', types: ['gft', 'pk'] },
	{ date: '2026-03-12', types: ['pmd'] },
	{ date: '2026-03-18', types: ['hv'] },
	{ date: '2026-03-25', types: ['gft'] },
	{ date: '2026-03-26', types: ['pmd', 'sh'] },
	{ date: '2026-04-01', types: ['hv'] },
	{ date: '2026-04-08', types: ['gft', 'pk'] },
	{ date: '2026-04-09', types: ['pmd'] },
	{ date: '2026-04-15', types: ['hv'] },
	{ date: '2026-04-22', types: ['gft'] },
	{ date: '2026-04-23', types: ['gv', 'pmd', 'sh'] },
	{ date: '2026-04-29', types: ['hv'] },
	{ date: '2026-05-06', types: ['gft', 'pk'] },
	{ date: '2026-05-07', types: ['pmd'] },
	{ date: '2026-05-13', types: ['hv'] },
	{ date: '2026-05-20', types: ['gft'] },
	{ date: '2026-05-21', types: ['pmd', 'tex'] },
	{ date: '2026-05-27', types: ['hv'] },
	{ date: '2026-06-03', types: ['gft', 'pk'] },
	{ date: '2026-06-04', types: ['pmd'] },
	{ date: '2026-06-10', types: ['hv'] },
	{ date: '2026-06-17', types: ['gft'] },
	{ date: '2026-06-18', types: ['pmd'] },
	{ date: '2026-06-24', types: ['hv'] },
	{ date: '2026-07-01', types: ['gft', 'pk'] },
	{ date: '2026-07-02', types: ['pmd'] },
	{ date: '2026-07-08', types: ['hv'] },
	{ date: '2026-07-15', types: ['gft'] },
	{ date: '2026-07-16', types: ['pmd'] },
	{ date: '2026-07-22', types: ['hv'] },
	{ date: '2026-07-29', types: ['gft', 'pk'] },
	{ date: '2026-07-30', types: ['pmd'] },
	{ date: '2026-08-05', types: ['hv'] },
	{ date: '2026-08-12', types: ['gft'] },
	{ date: '2026-08-13', types: ['pmd'] },
	{ date: '2026-08-19', types: ['hv'] },
	{ date: '2026-08-26', types: ['gft', 'pk'] },
	{ date: '2026-08-27', types: ['pmd'] },
	{ date: '2026-09-02', types: ['hv'] },
	{ date: '2026-09-09', types: ['gft'] },
	{ date: '2026-09-10', types: ['pmd'] },
	{ date: '2026-09-16', types: ['hv'] },
	{ date: '2026-09-23', types: ['gft', 'pk'] },
	{ date: '2026-09-24', types: ['gv', 'pmd', 'tex'] },
	{ date: '2026-09-30', types: ['hv'] },
	{ date: '2026-10-07', types: ['gft'] },
	{ date: '2026-10-08', types: ['pmd'] },
	{ date: '2026-10-14', types: ['hv'] },
	{ date: '2026-10-21', types: ['gft', 'pk'] },
	{ date: '2026-10-22', types: ['pmd', 'sh'] },
	{ date: '2026-10-28', types: ['hv'] },
	{ date: '2026-11-04', types: ['gft'] },
	{ date: '2026-11-05', types: ['pmd'] },
	{ date: '2026-11-11', types: ['hv'] },
	{ date: '2026-11-18', types: ['gft', 'pk'] },
	{ date: '2026-11-19', types: ['pmd'] },
	{ date: '2026-11-25', types: ['hv'] },
	{ date: '2026-12-02', types: ['gft', 'pk'] },
	{ date: '2026-12-03', types: ['pmd'] },
	{ date: '2026-12-09', types: ['hv'] },
	{ date: '2026-12-16', types: ['gft'] },
	{ date: '2026-12-17', types: ['pmd'] },
	{ date: '2026-12-23', types: ['hv'] },
	{ date: '2026-12-30', types: ['gft'] },
	{ date: '2026-12-31', types: ['pmd'] }
];
