"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import { PRECEDENCE_STYLES } from "@/lib/classify";
import { subsolarPoint } from "@/lib/solar";
import type { GlobePin } from "@/lib/serializers";

type GlobeViewProps = {
  pins: GlobePin[];
  focus: { lat: number; lng: number; altitude?: number } | null;
  selectedId: string | null;
  onSelectPin: (pin: GlobePin) => void;
  showImagery: boolean;
  showBoundaries: boolean;
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

  const imagePins = useMemo(
    () => (showImagery ? pins.filter((p) => Boolean(p.imageUrl)) : []),
    [pins, showImagery],
  );

  const points = useMemo(
    () =>
      pins
        .filter((p) => !showImagery || !p.imageUrl)
        .map((p) => ({
          ...p,
          radius: p.id === selectedId ? 0.55 : p.kind === "story" ? 0.4 : 0.22,
          color:
            p.id === selectedId
              ? "#ffb77c"
              : (PRECEDENCE_STYLES[p.precedence]?.fg ?? "#8a949b"),
        })),
    [pins, selectedId, showImagery],
  );

  const arcs = useMemo(
    () =>
      pins
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
        })),
    [pins],
  );

  const rings = useMemo(
    () =>
      pins
        .filter((p) => p.precedence === "FLASH" || p.id === selectedId)
        .map((p) => ({ lat: p.lat, lng: p.lng })),
    [pins, selectedId],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        w: Math.floor(entry.contentRect.width),
        h: Math.floor(entry.contentRect.height),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
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
        <div className="pointer-events-none absolute bottom-3 left-3 z-[60]">
          <div
            className="md-label-sm md-mono rounded-full px-2 py-1"
            style={{ background: "rgba(11,14,17,0.72)" }}
          >
            Subsolar point {sunLabel}
          </div>
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
          polygonsData={showBoundaries ? countries : []}
          polygonCapColor={() => "rgba(0, 0, 0, 0)"}
          polygonSideColor={() => "rgba(0, 0, 0, 0)"}
          polygonStrokeColor={() => "rgba(190, 214, 228, 0.42)"}
          polygonAltitude={0.005}
          polygonsTransitionDuration={0}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.02}
          pointRadius="radius"
          pointColor="color"
          pointLabel={(d) => tooltip(d as unknown as GlobePin)}
          onPointClick={(d) => onSelectPin(d as unknown as GlobePin)}
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
          arcColor="color"
          arcAltitudeAutoScale={0.4}
          arcStroke={0.3}
          arcDashLength={0.45}
          arcDashGap={0.22}
          arcDashAnimateTime={5000}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (t: number) => `rgba(255,183,124,${1 - t})`}
          ringMaxRadius={3}
          ringPropagationSpeed={1.4}
          ringRepeatPeriod={1700}
        />
      )}
    </div>
  );
}

function tooltip(pin: GlobePin) {
  return `<div style="font-family:Roboto,sans-serif;font-size:12px;padding:8px 10px;background:#252b31;border-radius:12px;max-width:260px;color:#e2e5e8;box-shadow:0 4px 8px 3px rgba(0,0,0,.26)"><div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#ffb77c">${
    pin.placeLabel ?? "Location unknown"
  } · ${pin.precedence}</div><div style="margin-top:3px;color:#b9c3c9">${pin.label}</div></div>`;
}
