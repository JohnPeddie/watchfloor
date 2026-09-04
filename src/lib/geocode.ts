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
  { label: "Washington D.C.", lat: 38.9072, lng: -77.0369, aliases: ["washington", "white house", "pentagon", "u.s.", "united states", "america"] },
  { label: "Moscow", lat: 55.7558, lng: 37.6173, aliases: ["moscow", "russia", "kremlin", "russian"] },
  { label: "Arctic", lat: 78.0, lng: 15.0, aliases: ["arctic", "svalbard", "barents", "northern fleet"] },
  { label: "Norway", lat: 59.9139, lng: 10.7522, aliases: ["norway", "oslo", "nordic"] },
  { label: "NATO HQ", lat: 50.8776, lng: 4.4222, aliases: ["nato", "brussels"] },
  { label: "Strait of Hormuz", lat: 26.5667, lng: 56.25, aliases: ["hormuz", "strait of hormuz", "persian gulf", "gulf"] },
  { label: "Iran", lat: 32.4279, lng: 53.688, aliases: ["iran", "tehran", "iranian", "larak"] },
  { label: "Jordan", lat: 31.9539, lng: 35.9106, aliases: ["jordan", "amman"] },
  { label: "UAE", lat: 24.4539, lng: 54.3773, aliases: ["uae", "abu dhabi", "dubai", "emirates"] },
  { label: "Grand Canyon", lat: 36.1069, lng: -112.1129, aliases: ["grand canyon", "arizona", "bright angel"] },
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
