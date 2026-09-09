export type WeatherWarningLevel = "yellow" | "amber" | "red" | "unknown";

export type WeatherCurrent = {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKph: number;
  precipMm: number;
  weatherCode: number;
  summary: string;
  time: string;
};

export type WeatherDay = {
  date: string;
  summary: string;
  weatherCode: number;
  maxC: number;
  minC: number;
  rainChance: number;
};

export type WeatherWarning = {
  id: string;
  title: string;
  summary: string;
  link: string;
  level: WeatherWarningLevel;
  /** True when the warning names the selected city or its UK region. */
  local: boolean;
  region: string;
};

export type WeatherPayload = {
  location: string;
  lat: number;
  lng: number;
  timezone: string;
  country: string;
  current: WeatherCurrent | null;
  forecast: WeatherDay[];
  warnings: WeatherWarning[];
  fetchedAt: string;
};

export type WeatherCityHit = {
  id: number;
  name: string;
  label: string;
  lat: number;
  lng: number;
  timezone: string;
  country: string;
  countryCode: string;
};
