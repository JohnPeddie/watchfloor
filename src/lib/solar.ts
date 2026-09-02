/**
 * Solar geometry for the globe's day/night terminator.
 * NOAA-style approximation: accurate to well under a degree, which is far
 * finer than the terminator band rendered on screen.
 */

const DEG = Math.PI / 180;

function julianCenturies(date: Date): number {
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  return (julianDay - 2451545) / 36525;
}

/** Solar declination in degrees. */
export function declination(date: Date): number {
  const t = julianCenturies(date);
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const centre =
    Math.sin(meanAnomaly * DEG) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly * DEG) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly * DEG) * 0.000289;
  const trueLongitude = meanLongitude + centre;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * DEG);

  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const meanObliquity = 23 + (26 + seconds / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * DEG);

  return (
    Math.asin(Math.sin(obliquity * DEG) * Math.sin(apparentLongitude * DEG)) / DEG
  );
}

/** Equation of time in minutes. */
export function equationOfTime(date: Date): number {
  const t = julianCenturies(date);
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const meanObliquity = 23 + (26 + seconds / 60) / 60;
  const omega = 125.04 - 1934.136 * t;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * DEG);

  const y = Math.tan((obliquity / 2) * DEG) ** 2;

  return (
    4 *
    (y * Math.sin(2 * meanLongitude * DEG) -
      2 * eccentricity * Math.sin(meanAnomaly * DEG) +
      4 * eccentricity * y * Math.sin(meanAnomaly * DEG) * Math.cos(2 * meanLongitude * DEG) -
      0.5 * y * y * Math.sin(4 * meanLongitude * DEG) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * DEG)) /
    DEG
  );
}

/** Point directly beneath the sun, as [longitude, latitude] in degrees. */
export function subsolarPoint(date: Date): [number, number] {
  const dayStart = new Date(date).setUTCHours(0, 0, 0, 0);
  const longitude = ((dayStart - date.getTime()) / 864e5) * 360 - 180;
  return [longitude - equationOfTime(date) / 4, declination(date)];
}
