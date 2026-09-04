import { feedByCode, feedByName } from "../../config/feeds";
import type { BriefSourceDTO, BriefStoryDTO, GlobeLink, GlobePin } from "./serializers";

/** Degrees: two points this close are treated as the same place on the globe. */
const SAME_PLACE = 0.45;

function nearly(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return Math.abs(a.lat - b.lat) <= SAME_PLACE && Math.abs(a.lng - b.lng) <= SAME_PLACE;
}

function bureauOf(source: BriefSourceDTO) {
  return feedByName(source.sourceName)?.bureau ?? feedByCode(source.sourceCode)?.bureau ?? null;
}

/**
 * Spreads stacked points around a centre so each source keeps its own pin
 * and the arcs between them stay visible instead of collapsing into one.
 */
function fan(
  centre: { lat: number; lng: number },
  index: number,
  count: number,
  radiusDeg: number,
): { lat: number; lng: number } {
  if (count <= 1) return centre;
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  const cosLat = Math.max(0.2, Math.cos((centre.lat * Math.PI) / 180));
  return {
    lat: centre.lat + Math.cos(angle) * radiusDeg,
    lng: centre.lng + (Math.sin(angle) * radiusDeg) / cosLat,
  };
}

function centroid(
  points: Array<{ lat: number; lng: number }>,
): { lat: number; lng: number } | null {
  if (points.length === 0) return null;
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length,
  };
}

/**
 * Builds the spiderweb for a selected brief item.
 *
 * The hub is the subject of the story — roughly where it is happening. Each
 * related report becomes a spoke. Arcs run from the source toward the hub so
 * the dash reads as reporting arriving at the event. The spoke lands on the
 * outlet's bureau when the article was geocoded to the same place as the
 * story (otherwise every UK desk would sit on top of the hub and the web
 * would vanish). Reports about a different place keep that location.
 */
export function buildSourceWeb(story: BriefStoryDTO): {
  hub: { lat: number; lng: number } | null;
  pins: GlobePin[];
  links: GlobeLink[];
} {
  const sources = story.sources ?? [];

  const hub =
    story.lat != null && story.lng != null
      ? { lat: story.lat, lng: story.lng }
      : centroid(
          sources
            .filter((s) => s.lat != null && s.lng != null)
            .map((s) => ({ lat: s.lat as number, lng: s.lng as number })),
        );

  if (!hub) {
    return { hub: null, pins: [], links: [] };
  }

  type Spoke = {
    source: BriefSourceDTO;
    lat: number;
    lng: number;
    placeLabel: string;
  };

  const spokes: Spoke[] = sources.map((source) => {
    const subject =
      source.lat != null && source.lng != null
        ? { lat: source.lat, lng: source.lng, label: source.placeLabel ?? "Subject" }
        : null;
    const bureau = bureauOf(source);

    // Prefer a location that is actually away from the hub, so the arc has
    // somewhere to go. Subject first (chatter elsewhere), then the desk.
    if (subject && !nearly(subject, hub)) {
      return {
        source,
        lat: subject.lat,
        lng: subject.lng,
        placeLabel: subject.label,
      };
    }
    if (bureau) {
      return {
        source,
        lat: bureau.lat,
        lng: bureau.lng,
        placeLabel: bureau.label,
      };
    }
    if (subject) {
      return {
        source,
        lat: subject.lat,
        lng: subject.lng,
        placeLabel: subject.label,
      };
    }
    return {
      source,
      lat: hub.lat,
      lng: hub.lng,
      placeLabel: story.placeLabel ?? "Unknown",
    };
  });

  const groups = new Map<string, Spoke[]>();
  for (const spoke of spokes) {
    const key = `${spoke.lat.toFixed(1)},${spoke.lng.toFixed(1)}`;
    const list = groups.get(key) ?? [];
    list.push(spoke);
    groups.set(key, list);
  }

  const placed: Spoke[] = [];
  for (const group of groups.values()) {
    const aroundHub = nearly(group[0], hub);
    const radius = aroundHub ? 2.4 : 1.6;
    group.forEach((spoke, index) => {
      const point = fan(group[0], index, group.length, radius);
      placed.push({ ...spoke, lat: point.lat, lng: point.lng });
    });
  }

  const hubPin: GlobePin = {
    id: `story:${story.id}`,
    kind: "story",
    label: story.headline,
    lat: hub.lat,
    lng: hub.lng,
    placeLabel: story.placeLabel,
    precedence: story.precedence,
    imageUrl: story.imageUrl,
    focus: true,
  };

  const sourcePins: GlobePin[] = placed.map((spoke) => ({
    id: `source:${story.id}:${spoke.source.id}`,
    kind: "source",
    label: spoke.source.title,
    lat: spoke.lat,
    lng: spoke.lng,
    placeLabel: `${spoke.source.sourceCode} · ${spoke.placeLabel}`,
    precedence: spoke.source.precedence,
    imageUrl: spoke.source.imageUrl,
    articleId: spoke.source.id,
  }));

  const links: GlobeLink[] = placed.map((spoke) => ({
    id: `link:${story.id}:${spoke.source.id}`,
    startLat: spoke.lat,
    startLng: spoke.lng,
    endLat: hub.lat,
    endLng: hub.lng,
    label: spoke.source.sourceCode,
  }));

  return { hub, pins: [hubPin, ...sourcePins], links };
}
