"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { PRECEDENCE_STYLES } from "@/lib/classify";
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

export function GlobeView({
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [sunLabel, setSunLabel] = useState<string>("");

  const material = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const loader = new THREE.TextureLoader();
    const dayTexture = loader.load("/globe/earth-day.jpg");
    const nightTexture = loader.load("/globe/earth-night-hi.jpg");
    for (const texture of [dayTexture, nightTexture]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
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

  const imagePins = useMemo(
    () =>
      links.length > 0
        ? []
        : showImagery
          ? pins.filter((p) => Boolean(p.imageUrl))
          : [],
    [pins, showImagery, links.length],
  );

  const points = useMemo(() => {
    const articlePoints = pins
      .filter((p) => links.length > 0 || !showImagery || !p.imageUrl)
      .map((p) => ({
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
  }, [pins, selectedId, showImagery, links.length, hazardMarks]);

  /**
   * A selected story's source web replaces the ambient home arcs. Dashes
   * travel from each source toward the hub — reporting arriving at the event.
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
        dashAnimateTime: 2800,
        altitudeScale: 0.38,
      }));
    }

    return pins
      .filter((p) => p.kind === "story")
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
        dashAnimateTime: 5000,
        altitudeScale: 0.4,
      }));
  }, [pins, links]);

  const rings = useMemo(
    () => [
      ...pins
        .filter((p) => p.focus || p.precedence === "FLASH" || p.id === selectedId)
        .map((p) => ({ lat: p.lat, lng: p.lng, color: "255,183,124" })),
      ...hazardMarks.map((mark) => ({
        lat: mark.lat,
        lng: mark.lng,
        color: mark.kind === "warzone" ? "255,70,60" : mark.severity === "extreme" ? "196,120,255" : "255,176,64",
      })),
    ],
    [pins, selectedId, hazardMarks],
  );

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
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          bumpImageUrl="/globe/earth-topology.png"
          showGraticules={false}
          atmosphereColor="#8fbfd6"
          atmosphereAltitude={0.17}
          onZoom={({ lng, lat }) => {
            if (!material) return;
            material.uniforms.globeRotation.value.set(lng, lat);
          }}
          polygonsData={polygons}
          polygonCapColor={(d) => polygonFill(d)}
          polygonSideColor={() => "rgba(0, 0, 0, 0)"}
          polygonStrokeColor={(d) => polygonStroke(d)}
          polygonAltitude={(d) => (featureLayer(d) ? 0.008 : 0.005)}
          polygonsTransitionDuration={0}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.02}
          pointRadius="radius"
          pointColor="color"
          pointLabel={(d) => tooltip(d)}
          onPointClick={(d) => {
            if (isHazard(d)) return;
            onSelectPin(d as unknown as GlobePin);
          }}
          labelsData={hazardMarks}
          labelLat="lat"
          labelLng="lng"
          labelText="label"
          labelSize={1.05}
          labelDotRadius={0}
          labelAltitude={0.02}
          labelColor={(d) => stormColor(d as HazardMark)}
          labelResolution={2}
          htmlElementsData={imagePins}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.03}
          htmlElement={(d) => {
            const pin = d as unknown as GlobePin;
            const el = document.createElement("div");
            el.className = "globe-marker";
            el.style.borderColor =
              pin.id === selectedId
                ? "#ffb77c"
                : (PRECEDENCE_STYLES[pin.precedence]?.fg ?? "#8a949b");
            el.title = `${pin.placeLabel ?? ""} — ${pin.label}`;
            const img = document.createElement("img");
            img.src = pin.imageUrl ?? "";
            img.alt = "";
            img.loading = "lazy";
            el.appendChild(img);
            el.onclick = () => onSelectPin(pin);
            return el;
          }}
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
          arcsTransitionDuration={0}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={(d: { color?: string }) => (t: number) => {
            const rgb = d.color ?? "255,183,124";
            return `rgba(${rgb},${(1 - t) * 0.9})`;
          }}
          ringMaxRadius={3}
          ringPropagationSpeed={1.4}
          ringRepeatPeriod={1700}
        />
      )}
    </div>
  );
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

function polygonFill(value: unknown): string {
  const layer = featureLayer(value);
  const severity = (value as CountryFeature)?.properties?.severity;
  if (layer === "warzone") return "rgba(255, 48, 42, 0.32)";
  if (layer === "storm") {
    return severity === "extreme" ? "rgba(180, 110, 255, 0.28)" : "rgba(255, 176, 64, 0.30)";
  }
  return "rgba(0, 0, 0, 0)";
}

function polygonStroke(value: unknown): string {
  const layer = featureLayer(value);
  if (layer === "warzone") return "rgba(255, 80, 70, 0.95)";
  if (layer === "storm") {
    const severity = (value as CountryFeature)?.properties?.severity;
    return severity === "extreme" ? "rgba(199, 125, 255, 0.95)" : "rgba(255, 196, 90, 0.95)";
  }
  return "rgba(190, 214, 228, 0.42)";
}

function tooltip(datum: unknown) {
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
