// Aartselaar, Belgium
const LATITUDE = 51.1167;
const LONGITUDE = 4.3833;

const WEATHER_API_URL =
	`https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
	`&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min` +
	`&timezone=Europe%2FBrussels&forecast_days=5`;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// WMO weather codes -> short description + icon
const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
	0: { description: 'Clear sky', icon: '☀️' },
	1: { description: 'Mostly clear', icon: '🌤️' },
	2: { description: 'Partly cloudy', icon: '⛅' },
	3: { description: 'Overcast', icon: '☁️' },
	45: { description: 'Fog', icon: '🌫️' },
	48: { description: 'Fog', icon: '🌫️' },
	51: { description: 'Light drizzle', icon: '🌦️' },
	53: { description: 'Drizzle', icon: '🌦️' },
	55: { description: 'Heavy drizzle', icon: '🌦️' },
	61: { description: 'Light rain', icon: '🌧️' },
	63: { description: 'Rain', icon: '🌧️' },
	65: { description: 'Heavy rain', icon: '🌧️' },
	66: { description: 'Freezing rain', icon: '🌧️' },
	67: { description: 'Freezing rain', icon: '🌧️' },
	71: { description: 'Light snow', icon: '🌨️' },
	73: { description: 'Snow', icon: '🌨️' },
	75: { description: 'Heavy snow', icon: '🌨️' },
	77: { description: 'Snow grains', icon: '🌨️' },
	80: { description: 'Rain showers', icon: '🌦️' },
	81: { description: 'Rain showers', icon: '🌦️' },
	82: { description: 'Violent showers', icon: '⛈️' },
	85: { description: 'Snow showers', icon: '🌨️' },
	86: { description: 'Snow showers', icon: '🌨️' },
	95: { description: 'Thunderstorm', icon: '⛈️' },
	96: { description: 'Thunderstorm', icon: '⛈️' },
	99: { description: 'Thunderstorm', icon: '⛈️' }
};

function describeCode(code: number): { description: string; icon: string } {
	return WEATHER_CODES[code] ?? { description: 'Unknown', icon: '❓' };
}

export interface WeatherData {
	current: { temp: number; description: string; icon: string };
	daily: { date: string; description: string; icon: string; tempMax: number; tempMin: number }[];
}

interface OpenMeteoResponse {
	current: { temperature_2m: number; weather_code: number };
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
	};
}

let cache: { data: WeatherData; fetchedAt: number } | null = null;

export async function getWeather(): Promise<WeatherData | null> {
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
		return cache.data;
	}

	try {
		const res = await fetch(WEATHER_API_URL, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return cache?.data ?? null;

		const json = (await res.json()) as OpenMeteoResponse;
		const currentInfo = describeCode(json.current.weather_code);

		const data: WeatherData = {
			current: {
				temp: Math.round(json.current.temperature_2m),
				description: currentInfo.description,
				icon: currentInfo.icon
			},
			daily: json.daily.time.map((date, i) => {
				const info = describeCode(json.daily.weather_code[i] as number);
				return {
					date,
					description: info.description,
					icon: info.icon,
					tempMax: Math.round(json.daily.temperature_2m_max[i] as number),
					tempMin: Math.round(json.daily.temperature_2m_min[i] as number)
				};
			})
		};

		cache = { data, fetchedAt: Date.now() };
		return data;
	} catch {
		return cache?.data ?? null;
	}
}
