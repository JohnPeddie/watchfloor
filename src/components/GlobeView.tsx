"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { PRECEDENCE_STYLES, type Precedence } from "@/lib/classify";
import { subsolarPoint } from "@/lib/solar";
import { hazardDisc, type HazardMark, type HazardsPayload } from "@/lib/hazard-geometry";
import type { GlobeLink, GlobePin } from "@/lib/serializers";

type GlobeViewProps = {
  pins: GlobePin[];
  focus: { lat: number; lng: number; altitude?: number } | null;
  selectedId: string | null;
  onSelectPin: (pin: GlobePin) => void;
  showImagery: boolean;
  showBoundaries: boolean;
  showHazards?: boolean;
  hazards?: HazardsPayload;
  /** Story-to-source connectors, drawn in place of the ambient arcs. */
  links: GlobeLink[];
};

type ArcDatum = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[];
  stroke: number;
  dashLength: number;
  dashGap: number;
  dashAnimateTime: number;
  altitudeScale: number;
};

type CountryFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
};

const UK_HOME = { lat: 54.5, lng: -3.0 };

/** HTML photo markers are CSS2D — they are the main source of flick stutter. */
const MAX_HTML_MARKERS = 12;
/** GPU points are cheap; still cap so pointer picking stays light. */
const MAX_POINTS = 96;
const PRECEDENCE_RANK: Record<Precedence, number> = {
  FLASH: 0,
  IMMEDIATE: 1,
  PRIORITY: 2,
  ROUTINE: 3,
};

const VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
  }
`;

/** Blends a daylight texture into a night-lights texture across the terminator. */
const FRAGMENT_SHADER = `
  #define PI 3.141592653589793
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunPosition;
  uniform vec2 globeRotation;
  varying vec3 vNormal;
  varying vec2 vUv;

  float toRad(in float a) { return a * PI / 180.0; }

  vec3 polarToCartesian(in vec2 c) {
    float theta = toRad(90.0 - c.x);
    float phi = toRad(90.0 - c.y);
    return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
  }

  void main() {
    float invLon = toRad(globeRotation.x);
    float invLat = -toRad(globeRotation.y);
    mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
    mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
    vec3 sunDirection = rotX * rotY * polarToCartesian(sunPosition);
    float intensity = dot(normalize(vNormal), normalize(sunDirection));

    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;

    // Lift the VIIRS night-lights so cities read clearly, with a sodium-lamp tint.
    vec3 cityLights = pow(clamp(nightColor, 0.0, 1.0), vec3(0.72)) * 2.35;
    cityLights *= vec3(1.12, 0.95, 0.68);
    vec3 nightSide = cityLights + vec3(0.012, 0.020, 0.036);

    // Cool the daylit side slightly to sit with the dashboard palette.
    vec3 daySide = dayColor * vec3(0.86, 0.91, 0.97);

    // Wide, soft terminator so dusk reads as a band rather than a hard line.
    float blend = smoothstep(-0.20, 0.24, intensity);

    // Warm dusk glow through the terminator band.
    float dusk = (1.0 - abs(intensity * 4.6)) * step(abs(intensity), 0.22);
    vec3 base = mix(nightSide, daySide, blend);
    base += vec3(0.16, 0.07, 0.02) * max(dusk, 0.0);

    gl_FragColor = vec4(base, 1.0);
  }
`;

function pinRank(pin: GlobePin, selectedId: string | null): number {
  if (pin.focus || pin.id === selectedId) return -2;
  if (pin.kind === "story") return PRECEDENCE_RANK[pin.precedence];
  if (pin.kind === "source") return 4;
  return 5 + PRECEDENCE_RANK[pin.precedence];
}

function takePins(pins: GlobePin[], selectedId: string | null, limit: number): GlobePin[] {
  if (pins.length <= limit) return pins;
  const ranked = [...pins].sort((a, b) => pinRank(a, selectedId) - pinRank(b, selectedId));
  const picked = ranked.slice(0, limit);
  if (selectedId && !picked.some((p) => p.id === selectedId)) {
    const extra = pins.find((p) => p.id === selectedId);
    if (extra) {
      picked[picked.length - 1] = extra;
    }
  }
  return picked;
}

export const GlobeView = memo(function GlobeView({
  pins,
  focus,
  selectedId,
  onSelectPin,
  showImagery,
  showBoundaries,
  showHazards = true,
  hazards,
  links,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectPinRef = useRef(onSelectPin);
  const focusRef = useRef(focus);
  const busyRef = useRef(false);
  const detachControls = useRef<(() => void) | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [sunLabel, setSunLabel] = useState<string>("");
  const [interacting, setInteracting] = useState(false);

  onSelectPinRef.current = onSelectPin;
  focusRef.current = focus;

  const material = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const loader = new THREE.TextureLoader();
    const dayTexture = loader.load("/globe/earth-day.jpg");
    const nightTexture = loader.load("/globe/earth-night-hi.jpg");
    for (const texture of [dayTexture, nightTexture]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
    }

    return new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        sunPosition: { value: new THREE.Vector2(...subsolarPoint(new Date())) },
        globeRotation: { value: new THREE.Vector2() },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
  }, []);

  // Keep the terminator tracking real time.
  useEffect(() => {
    if (!material) return;
    const update = () => {
      const now = new Date();
      const [lng, lat] = subsolarPoint(now);
      material.uniforms.sunPosition.value.set(lng, lat);
      setSunLabel(
        `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(1)}°${
          lng >= 0 ? "E" : "W"
        }`,
      );
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [material]);

  useEffect(() => {
    let cancelled = false;
    fetch("/globe/countries-110m.geojson")
      .then((r) => r.json())
      .then((data: { features?: CountryFeature[] }) => {
        if (!cancelled) setCountries(data.features ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const hazardMarks = useMemo<HazardMark[]>(
    () => (showHazards ? [...(hazards?.warzones ?? []), ...(hazards?.storms ?? [])] : []),
    [showHazards, hazards],
  );

  const polygons = useMemo(
    () => [...(showBoundaries ? countries : []), ...hazardMarks.map((mark) => hazardDisc(mark))],
    [showBoundaries, countries, hazardMarks],
  );

  const plottedPins = useMemo(
    () => takePins(pins, selectedId, MAX_POINTS),
    [pins, selectedId],
  );

  const imagePins = useMemo(() => {
    if (interacting || links.length > 0 || !showImagery) return [];
    return plottedPins.filter((p) => Boolean(p.imageUrl)).slice(0, MAX_HTML_MARKERS);
  }, [plottedPins, showImagery, links.length, interacting]);

  const points = useMemo(() => {
    const articlePoints = plottedPins.map((p) => ({
        ...p,
        radius: p.focus ? 0.7 : p.kind === "source" ? 0.32 : p.kind === "story" ? 0.4 : 0.22,
        color: p.focus
          ? "#ffb77c"
          : p.kind === "source"
            ? "#7fd6c9"
            : p.id === selectedId
              ? "#ffb77c"
              : (PRECEDENCE_STYLES[p.precedence]?.fg ?? "#8a949b"),
      }));
    const overlayPoints = hazardMarks.map((mark) => ({
      ...mark,
      radius: mark.kind === "warzone" ? 0.55 : 0.48,
      color: stormColor(mark),
    }));
    return [...overlayPoints, ...articlePoints];
  }, [plottedPins, selectedId, hazardMarks]);

  /**
   * A selected story's source web replaces the ambient home arcs. Dashes stay
   * static so the fragment shader is not animating every frame.
   */
  const arcs = useMemo<ArcDatum[]>(() => {
    if (links.length > 0) {
      return links.map((link) => ({
        startLat: link.startLat,
        startLng: link.startLng,
        endLat: link.endLat,
        endLng: link.endLng,
        color: ["rgba(127,214,201,0.9)", "rgba(255,183,124,0.95)"],
        stroke: 0.55,
        dashLength: 0.7,
        dashGap: 0.18,
        dashAnimateTime: 0,
        altitudeScale: 0.38,
      }));
    }

    return plottedPins
      .filter((p) => p.kind === "story" && (p.precedence === "FLASH" || p.precedence === "IMMEDIATE"))
      .slice(0, 8)
      .map((p) => ({
        startLat: UK_HOME.lat,
        startLng: UK_HOME.lng,
        endLat: p.lat,
        endLng: p.lng,
        color:
          p.precedence === "FLASH"
            ? ["rgba(255,180,171,0.02)", "rgba(255,180,171,0.5)"]
            : ["rgba(127,214,201,0.02)", "rgba(127,214,201,0.34)"],
        stroke: 0.3,
        dashLength: 0.45,
        dashGap: 0.22,
        dashAnimateTime: 0,
        altitudeScale: 0.4,
      }));
  }, [plottedPins, links]);

  const rings = useMemo(() => {
    if (interacting) return [];
    const selected = plottedPins.filter((p) => p.focus || p.id === selectedId);
    return selected.map((p) => ({ lat: p.lat, lng: p.lng, color: "255,183,124" }));
  }, [plottedPins, selectedId, interacting]);

  const labels = interacting ? [] : hazardMarks;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize((prev) => (Math.abs(prev.w - w) < 8 && Math.abs(prev.h - h) < 8 ? prev : { w, h }));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = !focus;
    controls.autoRotateSpeed = 0.25;
    controls.enableDamping = true;
    if (!focus) g.pointOfView({ lat: 28, lng: 8, altitude: 2.4 }, 0);
  }, [focus]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !focus) return;
    g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.altitude ?? 1.5 }, 1300);
  }, [focus]);

  useEffect(() => () => detachControls.current?.(), []);

  const attachGlobe = useCallback((globe: GlobeMethods) => {
    detachControls.current?.();
    globeRef.current = globe;

    const renderer = globe.renderer();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    renderer.setPixelRatio(Math.min(dpr, 1.25));

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.16;
    controls.autoRotate = !focusRef.current;
    controls.autoRotateSpeed = 0.25;

    let dragging = false;
    let settle = 0;
    const markBusy = () => {
      if (busyRef.current) return;
      busyRef.current = true;
      setInteracting(true);
    };
    const markIdleSoon = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        busyRef.current = false;
        setInteracting(false);
      }, 220);
    };
    const onStart = () => {
      dragging = true;
      window.clearTimeout(settle);
      markBusy();
    };
    const onEnd = () => {
      dragging = false;
      markIdleSoon();
    };
    const onChange = () => {
      if (!dragging && busyRef.current) markIdleSoon();
    };

    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    controls.addEventListener("change", onChange);

    detachControls.current = () => {
      window.clearTimeout(settle);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.removeEventListener("change", onChange);
    };
  }, []);

  const htmlElement = useCallback((d: object) => {
    const pin = d as unknown as GlobePin;
    const el = document.createElement("div");
    el.className = "globe-marker";
    el.style.borderColor = PRECEDENCE_STYLES[pin.precedence]?.fg ?? "#8a949b";
    el.title = `${pin.placeLabel ?? ""} — ${pin.label}`;
    const img = document.createElement("img");
    img.src = pin.imageUrl ?? "";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    el.appendChild(img);
    el.onclick = (event) => {
      event.stopPropagation();
      onSelectPinRef.current(pin);
    };
    return el;
  }, []);

  const onPointClick = useCallback((d: object) => {
    if (isHazard(d)) return;
    onSelectPinRef.current(d as unknown as GlobePin);
  }, []);

  const onZoom = useCallback(
    ({ lng, lat }: { lng: number; lat: number }) => {
      if (!material) return;
      material.uniforms.globeRotation.value.set(lng, lat);
    },
    [material],
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      /* Isolated stacking context keeps globe HTML markers beneath panel overlays. */
      style={{ isolation: "isolate", zIndex: 0 }}
    >
      {sunLabel && (
        <div className="on-globe pointer-events-none absolute bottom-3 left-3 z-[60] space-y-1">
          <div
            className="md-label-sm md-mono rounded-full px-2 py-1"
            style={{ background: "rgba(11,14,17,0.72)" }}
          >
            Subsolar point {sunLabel}
          </div>
          {showHazards && hazardMarks.length > 0 && (
            <div
              className="md-label-sm flex items-center gap-2 rounded-full px-2 py-1"
              style={{ background: "rgba(11,14,17,0.72)" }}
            >
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#ff3b30" }} />
                Warzones
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#ffb000" }} />
                Storms
              </span>
            </div>
          )}
        </div>
      )}

      {size.w > 0 && size.h > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          animateIn={false}
          rendererConfig={{
            antialias: size.w < 1100,
            alpha: true,
            powerPreference: "high-performance",
          }}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showGraticules={false}
          atmosphereColor="#8fbfd6"
          atmosphereAltitude={0.14}
          onGlobeReady={() => {
            const g = globeRef.current;
            if (g) attachGlobe(g);
          }}
          onZoom={onZoom}
          polygonsData={polygons}
          polygonCapColor={polygonFill}
          polygonSideColor={polygonSide}
          polygonStrokeColor={polygonStroke}
          polygonAltitude={polygonAltitude}
          polygonCapCurvatureResolution={3}
          polygonsTransitionDuration={0}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.02}
          pointRadius="radius"
          pointColor="color"
          pointResolution={8}
          pointLabel={tooltip}
          pointsTransitionDuration={0}
          onPointClick={onPointClick}
          labelsData={labels}
          labelLat="lat"
          labelLng="lng"
          labelText="label"
          labelSize={1.05}
          labelDotRadius={0}
          labelAltitude={0.02}
          labelColor={labelColor}
          labelResolution={1}
          labelsTransitionDuration={0}
          htmlElementsData={imagePins}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.03}
          htmlTransitionDuration={0}
          htmlElement={htmlElement}
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcAltitudeAutoScale="altitudeScale"
          arcStroke="stroke"
          arcDashLength="dashLength"
          arcDashGap="dashGap"
          arcDashAnimateTime="dashAnimateTime"
          arcCurveResolution={32}
          arcsTransitionDuration={0}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={ringColor}
          ringMaxRadius={3}
          ringPropagationSpeed={1.4}
          ringRepeatPeriod={1700}
          ringsTransitionDuration={0}
        />
      )}
    </div>
  );
});

function polygonSide() {
  return "rgba(0, 0, 0, 0)";
}

function polygonAltitude(d: object) {
  return featureLayer(d) ? 0.008 : 0.005;
}

function labelColor(d: object) {
  return stormColor(d as HazardMark);
}

function ringColor(d: { color?: string }) {
  return (t: number) => {
    const rgb = d.color ?? "255,183,124";
    return `rgba(${rgb},${(1 - t) * 0.9})`;
  };
}

function isHazard(value: unknown): value is HazardMark {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: string }).kind;
  return kind === "warzone" || kind === "storm";
}

function stormColor(mark: HazardMark): string {
  if (mark.kind === "warzone") return mark.severity === "extreme" ? "#ff3b30" : "#ff5c4d";
  return mark.severity === "extreme" ? "#c77dff" : "#ffb000";
}

function featureLayer(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("properties" in value)) return null;
  const layer = (value as CountryFeature).properties?.layer;
  return typeof layer === "string" ? layer : null;
}

function polygonFill(value: object): string {
  const layer = featureLayer(value);
  const severity = (value as CountryFeature)?.properties?.severity;
  if (layer === "warzone") return "rgba(255, 48, 42, 0.32)";
  if (layer === "storm") {
    return severity === "extreme" ? "rgba(180, 110, 255, 0.28)" : "rgba(255, 176, 64, 0.30)";
  }
  return "rgba(0, 0, 0, 0)";
}

function polygonStroke(value: object): string {
  const layer = featureLayer(value);
  if (layer === "warzone") return "rgba(255, 80, 70, 0.95)";
  if (layer === "storm") {
    const severity = (value as CountryFeature)?.properties?.severity;
    return severity === "extreme" ? "rgba(199, 125, 255, 0.95)" : "rgba(255, 196, 90, 0.95)";
  }
  return "rgba(190, 214, 228, 0.42)";
}

function tooltip(datum: object) {
  if (isHazard(datum)) {
    const accent = stormColor(datum);
    const kind = datum.kind === "warzone" ? "Warzone" : "Storm";
    return `<div style="font-family:Roboto,sans-serif;font-size:12px;padding:8px 10px;background:#252b31;border-radius:12px;max-width:260px;color:#e2e5e8;box-shadow:0 4px 8px 3px rgba(0,0,0,.26)"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${accent}">${kind}</div><div style="margin-top:3px;color:#e2e5e8">${datum.label}</div><div style="margin-top:2px;color:#b9c3c9">${datum.detail}</div></div>`;
  }
  const pin = datum as GlobePin;
  return `<div style="font-family:Roboto,sans-serif;font-size:12px;padding:8px 10px;background:#252b31;border-radius:12px;max-width:260px;color:#e2e5e8;box-shadow:0 4px 8px 3px rgba(0,0,0,.26)"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#ffb77c">${
    pin.placeLabel ?? "Location unknown"
  } · ${pin.precedence}</div><div style="margin-top:3px;color:#b9c3c9">${pin.label}</div></div>`;
}
