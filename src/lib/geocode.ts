export type Place = {
  label: string;
  lat: number;
  lng: number;
  aliases: string[];
};

/** Heuristic gazetteer for globe pins without an LLM. */
export const GAZETTEER: Place[] = [
  { label: "London", lat: 51.5074, lng: -0.1278, aliases: ["london", "uk", "united kingdom", "britain", "england", "westminster", "whitehall"] },
  { label: "Scotland", lat: 55.9533, lng: -3.1883, aliases: ["scotland", "edinburgh", "glasgow"] },
  { label: "North Sea", lat: 56.5, lng: 2.0, aliases: ["north sea", "brent", "forties"] },
  { label: "Washington D.C.", lat: 38.9072, lng: -77.0369, aliases: ["washington", "washington dc", "washington d.c.", "white house", "pentagon", "capitol hill"] },
  { label: "Moscow", lat: 55.7558, lng: 37.6173, aliases: ["moscow", "russia", "kremlin", "russian"] },
  { label: "Arctic", lat: 78.0, lng: 15.0, aliases: ["arctic", "svalbard", "barents", "northern fleet"] },
  { label: "Norway", lat: 59.9139, lng: 10.7522, aliases: ["norway", "oslo", "nordic"] },
  { label: "NATO HQ", lat: 50.8776, lng: 4.4222, aliases: ["nato", "brussels"] },
  { label: "Strait of Hormuz", lat: 26.5667, lng: 56.25, aliases: ["hormuz", "strait of hormuz", "persian gulf", "gulf"] },
  { label: "Iran", lat: 32.4279, lng: 53.688, aliases: ["iran", "tehran", "iranian", "larak"] },
  { label: "Jordan", lat: 31.9539, lng: 35.9106, aliases: ["jordan", "amman"] },
  { label: "UAE", lat: 24.4539, lng: 54.3773, aliases: ["uae", "abu dhabi", "dubai", "emirates"] },
  { label: "Grand Canyon", lat: 36.1069, lng: -112.1129, aliases: ["grand canyon", "bright angel"] },
  { label: "New York", lat: 40.7128, lng: -74.006, aliases: ["new york", "nyc", "manhattan", "brooklyn"] },
  { label: "Los Angeles", lat: 34.0522, lng: -118.2437, aliases: ["los angeles", "l.a."] },
  { label: "San Francisco", lat: 37.7749, lng: -122.4194, aliases: ["san francisco", "bay area", "silicon valley"] },
  { label: "Seattle", lat: 47.6062, lng: -122.3321, aliases: ["seattle"] },
  { label: "Chicago", lat: 41.8781, lng: -87.6298, aliases: ["chicago"] },
  { label: "Houston", lat: 29.7604, lng: -95.3698, aliases: ["houston"] },
  { label: "Dallas", lat: 32.7767, lng: -96.797, aliases: ["dallas", "fort worth"] },
  { label: "Austin", lat: 30.2672, lng: -97.7431, aliases: ["austin"] },
  { label: "Denver", lat: 39.7392, lng: -104.9903, aliases: ["denver"] },
  { label: "Phoenix", lat: 33.4484, lng: -112.074, aliases: ["phoenix"] },
  { label: "Atlanta", lat: 33.749, lng: -84.388, aliases: ["atlanta"] },
  { label: "Miami", lat: 25.7617, lng: -80.1918, aliases: ["miami"] },
  { label: "Boston", lat: 42.3601, lng: -71.0589, aliases: ["boston"] },
  { label: "Detroit", lat: 42.3314, lng: -83.0458, aliases: ["detroit"] },
  { label: "Minneapolis", lat: 44.9778, lng: -93.265, aliases: ["minneapolis"] },
  { label: "New Orleans", lat: 29.9511, lng: -90.0715, aliases: ["new orleans"] },
  { label: "Las Vegas", lat: 36.1699, lng: -115.1398, aliases: ["las vegas"] },
  { label: "Portland", lat: 45.5152, lng: -122.6784, aliases: ["portland"] },
  { label: "Salt Lake City", lat: 40.7608, lng: -111.891, aliases: ["salt lake"] },
  { label: "Kansas City", lat: 39.0997, lng: -94.5786, aliases: ["kansas city"] },
  { label: "St. Louis", lat: 38.627, lng: -90.1994, aliases: ["st. louis", "st louis"] },
  { label: "Philadelphia", lat: 39.9526, lng: -75.1652, aliases: ["philadelphia"] },
  { label: "San Diego", lat: 32.7157, lng: -117.1611, aliases: ["san diego"] },
  { label: "California", lat: 36.7783, lng: -119.4179, aliases: ["california"] },
  { label: "Texas", lat: 31.0, lng: -100.0, aliases: ["texas"] },
  { label: "Florida", lat: 27.7663, lng: -81.6868, aliases: ["florida"] },
  { label: "Colorado", lat: 39.5501, lng: -105.7821, aliases: ["colorado"] },
  { label: "Arizona", lat: 34.0489, lng: -111.0937, aliases: ["arizona"] },
  { label: "Illinois", lat: 40.6331, lng: -89.3985, aliases: ["illinois"] },
  { label: "Ohio", lat: 40.4173, lng: -82.9071, aliases: ["ohio"] },
  { label: "Michigan", lat: 44.3148, lng: -85.6024, aliases: ["michigan"] },
  { label: "Georgia", lat: 32.1656, lng: -82.9001, aliases: ["georgia"] },
  { label: "North Carolina", lat: 35.7596, lng: -79.0193, aliases: ["north carolina"] },
  { label: "Pennsylvania", lat: 41.2033, lng: -77.1945, aliases: ["pennsylvania"] },
  { label: "Oregon", lat: 43.8041, lng: -120.5542, aliases: ["oregon"] },
  { label: "Nevada", lat: 38.8026, lng: -116.4194, aliases: ["nevada"] },
  { label: "Washington State", lat: 47.4009, lng: -121.4905, aliases: ["washington state"] },
  { label: "Alaska", lat: 64.2008, lng: -149.4937, aliases: ["alaska"] },
  { label: "Hawaii", lat: 21.3069, lng: -157.8583, aliases: ["hawaii", "honolulu"] },
  { label: "Niamey", lat: 13.5116, lng: 2.1254, aliases: ["niger", "niamey", "sahel"] },
  { label: "Palau", lat: 7.5149, lng: 134.5825, aliases: ["palau", "pacific islands forum", "pacific islands"] },
  { label: "Taiwan", lat: 23.6978, lng: 120.9605, aliases: ["taiwan", "taipei", "taiwan strait"] },
  { label: "Beijing", lat: 39.9042, lng: 116.4074, aliases: ["beijing", "china", "chinese", "prc"] },
  { label: "Australia", lat: -35.2809, lng: 149.13, aliases: ["australia", "canberra", "sydney"] },
  { label: "New Zealand", lat: -41.2865, lng: 174.7762, aliases: ["new zealand", "wellington", "auckland"] },
  { label: "Ukraine", lat: 50.4501, lng: 30.5234, aliases: ["ukraine", "kyiv", "kiev", "donbas", "crimea"] },
  { label: "Israel", lat: 31.7683, lng: 35.2137, aliases: ["israel", "tel aviv", "jerusalem", "gaza", "west bank"] },
  { label: "Syria", lat: 33.5138, lng: 36.2765, aliases: ["syria", "damascus"] },
  { label: "Red Sea", lat: 20.0, lng: 40.0, aliases: ["red sea", "houthi", "bab el-mandeb", "yemen"] },
  { label: "South China Sea", lat: 12.0, lng: 114.0, aliases: ["south china sea", "spratly"] },
  { label: "Korea", lat: 37.5665, lng: 126.978, aliases: ["north korea", "south korea", "pyongyang", "seoul", "korean"] },
  { label: "India", lat: 28.6139, lng: 77.209, aliases: ["india", "new delhi", "delhi"] },
  { label: "Pakistan", lat: 33.6844, lng: 73.0479, aliases: ["pakistan", "islamabad"] },
  { label: "Turkey", lat: 39.9334, lng: 32.8597, aliases: ["turkey", "türkiye", "ankara", "istanbul"] },
  { label: "Algeria", lat: 36.7538, lng: 3.0588, aliases: ["algeria", "algiers"] },
  { label: "Germany", lat: 52.52, lng: 13.405, aliases: ["germany", "berlin", "bundeswehr"] },
  { label: "France", lat: 48.8566, lng: 2.3522, aliases: ["france", "paris"] },
  { label: "Baltic Sea", lat: 58.0, lng: 20.0, aliases: ["baltic", "kaliningrad", "gotland"] },
  { label: "Black Sea", lat: 43.5, lng: 34.0, aliases: ["black sea", "odessa", "odesa", "sevastopol"] },

  { label: "Saudi Arabia", lat: 24.7136, lng: 46.6753, aliases: ["saudi arabia", "saudi", "riyadh", "mecca", "jeddah", "medina"] },
  { label: "Egypt", lat: 30.0444, lng: 31.2357, aliases: ["egypt", "cairo", "sinai"] },
  { label: "Suez Canal", lat: 30.5234, lng: 32.2569, aliases: ["suez"] },
  { label: "Iraq", lat: 33.3152, lng: 44.3661, aliases: ["iraq", "baghdad", "erbil", "basra"] },
  { label: "Lebanon", lat: 33.8938, lng: 35.5018, aliases: ["lebanon", "beirut"] },
  { label: "Qatar", lat: 25.2854, lng: 51.531, aliases: ["qatar", "doha"] },
  { label: "Kuwait", lat: 29.3759, lng: 47.9774, aliases: ["kuwait"] },
  { label: "Oman", lat: 23.5859, lng: 58.4059, aliases: ["oman", "muscat"] },
  { label: "Afghanistan", lat: 34.5553, lng: 69.2075, aliases: ["afghanistan", "kabul", "taliban"] },
  { label: "Poland", lat: 52.2297, lng: 21.0122, aliases: ["poland", "warsaw", "polish"] },
  { label: "Belarus", lat: 53.9006, lng: 27.559, aliases: ["belarus", "minsk", "lukashenko"] },
  { label: "Netherlands", lat: 52.3676, lng: 4.9041, aliases: ["netherlands", "dutch", "amsterdam", "the hague"] },
  { label: "Spain", lat: 40.4168, lng: -3.7038, aliases: ["spain", "madrid", "spanish"] },
  { label: "Italy", lat: 41.9028, lng: 12.4964, aliases: ["italy", "rome", "italian"] },
  { label: "Sweden", lat: 59.3293, lng: 18.0686, aliases: ["sweden", "stockholm", "swedish"] },
  { label: "Finland", lat: 60.1699, lng: 24.9384, aliases: ["finland", "helsinki", "finnish"] },
  { label: "Denmark", lat: 55.6761, lng: 12.5683, aliases: ["denmark", "copenhagen", "danish", "greenland"] },
  { label: "Ireland", lat: 53.3498, lng: -6.2603, aliases: ["ireland", "dublin", "irish"] },
  { label: "Greece", lat: 37.9838, lng: 23.7275, aliases: ["greece", "athens", "greek"] },
  { label: "Romania", lat: 44.4268, lng: 26.1025, aliases: ["romania", "bucharest"] },
  { label: "Switzerland", lat: 46.948, lng: 7.4474, aliases: ["switzerland", "swiss", "geneva", "davos", "bern", "zurich"] },
  { label: "Kazakhstan", lat: 51.1605, lng: 71.4704, aliases: ["kazakhstan", "astana"] },
  { label: "Azerbaijan", lat: 40.4093, lng: 49.8671, aliases: ["azerbaijan", "baku"] },
  { label: "Armenia", lat: 40.1792, lng: 44.4991, aliases: ["armenia", "yerevan"] },
  { label: "Georgia (Caucasus)", lat: 41.7151, lng: 44.8271, aliases: ["tbilisi", "georgian"] },
  { label: "Nigeria", lat: 9.0765, lng: 7.3986, aliases: ["nigeria", "abuja", "lagos"] },
  { label: "Sudan", lat: 15.5007, lng: 32.5599, aliases: ["sudan", "khartoum", "darfur"] },
  { label: "Libya", lat: 32.8872, lng: 13.1913, aliases: ["libya", "tripoli", "benghazi"] },
  { label: "Somalia", lat: 2.0469, lng: 45.3182, aliases: ["somalia", "mogadishu"] },
  { label: "Ethiopia", lat: 9.03, lng: 38.74, aliases: ["ethiopia", "addis ababa", "tigray"] },
  { label: "Kenya", lat: -1.2921, lng: 36.8219, aliases: ["kenya", "nairobi"] },
  { label: "Mali", lat: 12.6392, lng: -8.0029, aliases: ["mali", "bamako"] },
  { label: "Burkina Faso", lat: 12.3714, lng: -1.5197, aliases: ["burkina faso", "ouagadougou"] },
  { label: "DR Congo", lat: -4.4419, lng: 15.2663, aliases: ["dr congo", "democratic republic of congo", "kinshasa", "goma"] },
  { label: "South Africa", lat: -25.7479, lng: 28.2293, aliases: ["south africa", "pretoria", "johannesburg", "cape town"] },
  { label: "Venezuela", lat: 10.4806, lng: -66.9036, aliases: ["venezuela", "caracas", "maduro"] },
  { label: "Brazil", lat: -15.8267, lng: -47.9218, aliases: ["brazil", "brasilia", "brazilian"] },
  { label: "Mexico", lat: 19.4326, lng: -99.1332, aliases: ["mexico", "mexican", "mexico city"] },
  { label: "Canada", lat: 45.4215, lng: -75.6972, aliases: ["canada", "ottawa", "canadian", "toronto"] },
  { label: "Colombia", lat: 4.711, lng: -74.0721, aliases: ["colombia", "bogota"] },
  { label: "Argentina", lat: -34.6037, lng: -58.3816, aliases: ["argentina", "buenos aires"] },
  { label: "Chile", lat: -33.4489, lng: -70.6693, aliases: ["chile", "santiago"] },
  { label: "Cuba", lat: 23.1136, lng: -82.3666, aliases: ["cuba", "havana"] },
  { label: "Panama Canal", lat: 9.08, lng: -79.68, aliases: ["panama canal", "panama"] },
  { label: "Japan", lat: 35.6762, lng: 139.6503, aliases: ["japan", "tokyo", "japanese", "okinawa"] },
  { label: "Indonesia", lat: -6.2088, lng: 106.8456, aliases: ["indonesia", "jakarta"] },
  { label: "Philippines", lat: 14.5995, lng: 120.9842, aliases: ["philippines", "manila", "filipino"] },
  { label: "Vietnam", lat: 21.0278, lng: 105.8342, aliases: ["vietnam", "hanoi"] },
  { label: "Malaysia", lat: 3.139, lng: 101.6869, aliases: ["malaysia", "kuala lumpur"] },
  { label: "Singapore", lat: 1.3521, lng: 103.8198, aliases: ["singapore"] },
  { label: "Bangladesh", lat: 23.8103, lng: 90.4125, aliases: ["bangladesh", "dhaka"] },
  { label: "Myanmar", lat: 16.8409, lng: 96.1735, aliases: ["myanmar", "burma", "yangon"] },
  { label: "Thailand", lat: 13.7563, lng: 100.5018, aliases: ["thailand", "bangkok"] },

  { label: "Manchester", lat: 53.4808, lng: -2.2426, aliases: ["manchester", "heaton park"] },
  { label: "Birmingham", lat: 52.4862, lng: -1.8904, aliases: ["birmingham"] },
  { label: "Cardiff", lat: 51.4816, lng: -3.1791, aliases: ["cardiff"] },
  { label: "Belfast", lat: 54.5973, lng: -5.9301, aliases: ["belfast", "northern ireland"] },
  { label: "Portsmouth", lat: 50.8198, lng: -1.088, aliases: ["portsmouth", "hmnb portsmouth"] },
  { label: "Faslane", lat: 56.0644, lng: -4.8181, aliases: ["faslane", "clyde naval base"] },
  { label: "Barrow-in-Furness", lat: 54.1108, lng: -3.2261, aliases: ["barrow-in-furness", "barrow"] },
  { label: "Donetsk", lat: 48.0159, lng: 37.8029, aliases: ["donetsk", "pokrovsk", "bakhmut"] },
  { label: "Kharkiv", lat: 49.9935, lng: 36.2304, aliases: ["kharkiv", "kursk"] },
  { label: "Taiwan Strait", lat: 24.5, lng: 119.5, aliases: ["taiwan strait"] },
];

/**
 * Aliases have to match whole words. A plain substring test puts "woman" in
 * Oman, "Ukraine" in London via "uk", and "Somalia" in Mali, which then plots
 * the story on the wrong side of the globe.
 */
const ALIAS_MATCHERS: { place: Place; alias: string; pattern: RegExp }[] = GAZETTEER.flatMap(
  (place) =>
    place.aliases.map((alias) => ({
      place,
      alias,
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
        "iu",
      ),
    })),
);

export function geocodeText(...parts: Array<string | null | undefined>): Place | null {
  const chunks = parts.filter(Boolean).map((p) => String(p));
  if (chunks.length === 0) return null;

  // Prefer matches in earlier parts (e.g. placeHint / headline before body)
  let best: { place: Place; score: number } | null = null;
  for (let partIdx = 0; partIdx < chunks.length; partIdx++) {
    const haystack = chunks[partIdx];
    const partWeight = (chunks.length - partIdx) * 100;
    for (const { place, alias, pattern } of ALIAS_MATCHERS) {
      if (!pattern.test(haystack)) continue;
      const score = partWeight + alias.length;
      if (!best || score > best.score) {
        best = { place, score };
      }
    }
  }
  return best?.place ?? null;
}

/** Continental US points used when a story is American but names no city. */
const US_SPREAD: Place[] = [
  { label: "United States", lat: 47.6062, lng: -122.3321, aliases: [] }, // Seattle
  { label: "United States", lat: 45.5152, lng: -122.6784, aliases: [] }, // Portland
  { label: "United States", lat: 37.7749, lng: -122.4194, aliases: [] }, // San Francisco
  { label: "United States", lat: 34.0522, lng: -118.2437, aliases: [] }, // Los Angeles
  { label: "United States", lat: 36.1699, lng: -115.1398, aliases: [] }, // Las Vegas
  { label: "United States", lat: 33.4484, lng: -112.074, aliases: [] }, // Phoenix
  { label: "United States", lat: 40.7608, lng: -111.891, aliases: [] }, // Salt Lake
  { label: "United States", lat: 39.7392, lng: -104.9903, aliases: [] }, // Denver
  { label: "United States", lat: 35.0844, lng: -106.6504, aliases: [] }, // Albuquerque
  { label: "United States", lat: 32.7767, lng: -96.797, aliases: [] }, // Dallas
  { label: "United States", lat: 29.7604, lng: -95.3698, aliases: [] }, // Houston
  { label: "United States", lat: 29.9511, lng: -90.0715, aliases: [] }, // New Orleans
  { label: "United States", lat: 35.2271, lng: -80.8431, aliases: [] }, // Charlotte
  { label: "United States", lat: 33.749, lng: -84.388, aliases: [] }, // Atlanta
  { label: "United States", lat: 41.8781, lng: -87.6298, aliases: [] }, // Chicago
  { label: "United States", lat: 44.9778, lng: -93.265, aliases: [] }, // Minneapolis
  { label: "United States", lat: 39.0997, lng: -94.5786, aliases: [] }, // Kansas City
  { label: "United States", lat: 42.3314, lng: -83.0458, aliases: [] }, // Detroit
  { label: "United States", lat: 38.627, lng: -90.1994, aliases: [] }, // St Louis
  { label: "United States", lat: 39.9526, lng: -75.1652, aliases: [] }, // Philadelphia
  { label: "United States", lat: 42.3601, lng: -71.0589, aliases: [] }, // Boston
  { label: "United States", lat: 25.7617, lng: -80.1918, aliases: [] }, // Miami
  { label: "United States", lat: 27.9506, lng: -82.4572, aliases: [] }, // Tampa
  { label: "United States", lat: 36.1627, lng: -86.7816, aliases: [] }, // Nashville
];

const US_STORY = /\b(united states|\bu\.s\.a?\b|\bamerica\b|\bamerican\b)/iu;
const DC_SPECIFIC = /\b(washington|white house|pentagon|capitol|d\.c\.|dc)\b/iu;

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickUsSpread(id: string): Place {
  return US_SPREAD[hash32(id) % US_SPREAD.length]!;
}

function looksAmerican(text: string, tags?: string[], lanes?: string[]): boolean {
  if (tags?.includes("US") || lanes?.includes("us")) return true;
  return US_STORY.test(text);
}

function isGenericWashington(place: Place, text: string): boolean {
  return place.label === "Washington D.C." && !DC_SPECIFIC.test(text);
}

/**
 * Picks a globe coordinate. Specific cities win. Generic US copy is hashed
 * across the continental US so it does not pile up on Washington.
 */
export function plotLocation(input: {
  id: string;
  title: string;
  extra?: Array<string | null | undefined>;
  tags?: string[];
  lanes?: string[];
  lat?: number | null;
  lng?: number | null;
  placeLabel?: string | null;
}): { label: string; lat: number; lng: number } | null {
  const parts = [input.title, input.placeLabel, ...(input.extra ?? [])];
  const text = parts.filter(Boolean).join(" ");
  const hit = geocodeText(...parts);

  if (hit && !isGenericWashington(hit, input.title)) {
    return { label: hit.label, lat: hit.lat, lng: hit.lng };
  }

  if (looksAmerican(text, input.tags, input.lanes)) {
    const spread = pickUsSpread(input.id);
    return { label: spread.label, lat: spread.lat, lng: spread.lng };
  }

  if (input.lat != null && input.lng != null && Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    return { label: input.placeLabel ?? "Location unknown", lat: input.lat, lng: input.lng };
  }

  return null;
}
