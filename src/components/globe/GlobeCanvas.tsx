"use client";

/* eslint-disable react-hooks/immutability -- shader uniforms are mutable GPU inputs, written every frame by design */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  type Group,
  Quaternion,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import { GLOBE_READY } from "@/lib/preloader";
import { angleDelta, arcPoints, type GlobeProps, latLngToVec3, rotationToFace, type Vec3 } from "./geo3d";
import { arcFragment, arcVertex, dotsFragment, dotsVertex, pinFragment, pinVertex } from "./shaders";

export type { GlobeDrive, GlobeProps } from "./geo3d";
type Props = GlobeProps;

// The shaders write colour straight to the screen with no sRGB conversion,
// so these hold raw sRGB values (setRGB) rather than linearized hex.
const srgb = (hex: number) =>
  new Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
const PAPER = srgb(0xede8df);
const SIGNAL = srgb(0xf0602f);
const Z = new Vector3(0, 0, 1);
const toV3 = (v: Vec3) => new Vector3(v.x, v.y, v.z);

function useLandDots(lite: boolean) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(lite ? "/globe/land-lite.bin" : "/globe/land.bin")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        const packed = new Int16Array(buf);
        const count = packed.length / 2;
        const positions = new Float32Array(count * 3);
        const rand = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const v = latLngToVec3(packed[i * 2] / 100, packed[i * 2 + 1] / 100, 1.001);
          positions.set([v.x, v.y, v.z], i * 3);
          rand[i] = Math.random();
        }
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(positions, 3));
        g.setAttribute("aRand", new BufferAttribute(rand, 1));
        setGeometry(g);
        window.dispatchEvent(new Event(GLOBE_READY));
      });
    return () => {
      cancelled = true;
    };
  }, [lite]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

function Earth({ stops, active, focus, label, drive, lite, onPick }: Omit<Props, "running">) {
  const group = useRef<Group>(null);
  const zoomed = useRef(0);
  const dots = useLandDots(lite);
  const { gl, viewport, camera, size } = useThree();

  // Keep the whole globe in frame on tall screens: back the camera off as the
  // viewport gets narrower than it is high.
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.position.z = aspect < 1.15 ? (3.6 * 1.15) / aspect : 3.6;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  const [hovered, setHovered] = useState<number | null>(null);

  // Materials are built here rather than as JSX props: R3F copies a `uniforms`
  // prop into the material it creates, so per-frame writes to our own object
  // would never reach the GPU. Owning the material keeps one uniforms object.
  const dotsMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: dotsVertex,
        fragmentShader: dotsFragment,
        uniforms: {
          uSize: { value: lite ? 3.4 : 2.8 },
          uPixelRatio: { value: 1 },
          uActive: { value: new Vector3(0, 0, 1) },
          uActiveStrength: { value: 0 },
          uColor: { value: PAPER },
          uAccent: { value: SIGNAL },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      }),
    [lite],
  );
  const arcMaterials = useMemo(
    () =>
      stops.slice(1).map(
        () =>
          new ShaderMaterial({
            vertexShader: arcVertex,
            fragmentShader: arcFragment,
            uniforms: {
              uColor: { value: SIGNAL },
              uDraw: { value: 0 },
              uOpacity: { value: 0 },
              uBase: { value: 0.55 },
            },
            transparent: true,
            depthWrite: false,
          }),
      ),
    [stops],
  );
  const pinMaterials = useMemo(
    () =>
      stops.map(
        () =>
          new ShaderMaterial({
            vertexShader: pinVertex,
            fragmentShader: pinFragment,
            uniforms: { uColor: { value: SIGNAL }, uTime: { value: 0 }, uActive: { value: 0 }, uOpacity: { value: 0 } },
            transparent: true,
            depthWrite: false,
          }),
      ),
    [stops],
  );
  useEffect(() => () => dotsMaterial.dispose(), [dotsMaterial]);
  useEffect(() => () => arcMaterials.forEach((m) => m.dispose()), [arcMaterials]);
  useEffect(() => () => pinMaterials.forEach((m) => m.dispose()), [pinMaterials]);

  const pins = useMemo(
    () =>
      stops.map((s) => {
        const normal = toV3(latLngToVec3(s.lat, s.lng));
        return {
          position: normal.clone().multiplyScalar(1.006),
          quaternion: new Quaternion().setFromUnitVectors(Z, normal),
        };
      }),
    [stops],
  );

  const arcs = useMemo(
    () =>
      stops.slice(1).map((s, i) => {
        const curve = new CatmullRomCurve3(arcPoints(stops[i], s, lite ? 40 : 72).map(toV3));
        return new TubeGeometry(curve, lite ? 40 : 96, 0.0042, 6, false);
      }),
    [stops, lite],
  );
  useEffect(() => () => arcs.forEach((g) => g.dispose()), [arcs]);

  useEffect(() => {
    document.body.style.cursor = hovered === null ? "" : "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const focusSet = useMemo(() => new Set(focus), [focus]);
  // Scratch vectors for placing the name tag, reused every frame.
  const tag = useMemo(
    () => ({ pos: new Vector3(), centre: new Vector3(), normal: new Vector3(), view: new Vector3() }),
    [],
  );

  useFrame((state, delta) => {
    const g = group.current;
    const d = drive.current;
    if (!g || !d) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);

    // Face the active stop (Y the short way round), or drift slowly when idle.
    const stop = stops[active];
    if (stop) {
      const target = rotationToFace(stop.lat, stop.lng);
      // Tilt slightly short of the city's latitude (north stays readable), but
      // centre it exactly when zoomed in on a place.
      g.rotation.x += (target.x * (0.85 + 0.15 * zoomed.current) - g.rotation.x) * ease(3.2);
      g.rotation.y += angleDelta(g.rotation.y, target.y) * ease(3.2);
    } else {
      g.rotation.x += (0.32 - g.rotation.x) * ease(2);
      g.rotation.y += dt * 0.06;
    }

    // On wide screens the globe slides right while the tour runs.
    const shiftTarget =
      viewport.width / viewport.height < 1.15
        ? 0
        : d.shift * Math.min(viewport.width * 0.14, 0.55) * (1 + 0.7 * zoomed.current);
    g.position.x += (shiftTarget - g.position.x) * ease(4);
    // Zoom eases in and out rather than snapping between places.
    zoomed.current += (d.zoom - zoomed.current) * ease(2.5);
    g.scale.setScalar((0.94 + 0.06 * d.intro) * (1 + 0.35 * zoomed.current));

    const du = dotsMaterial.uniforms;
    du.uTime.value = t;
    du.uOpacity.value = d.intro;
    du.uPixelRatio.value = gl.getPixelRatio();
    if (stop) du.uActive.value.lerp(toV3(latLngToVec3(stop.lat, stop.lng)), ease(5));
    du.uActiveStrength.value += ((stop ? 1 : 0) - du.uActiveStrength.value) * ease(4);

    arcMaterials.forEach(({ uniforms: u }, i) => {
      u.uDraw.value = Math.min(Math.max(d.progress - i, 0), 1);
      u.uOpacity.value = d.intro;
      // The whole route shows while idle; untravelled legs dim once the tour starts.
      u.uBase.value += ((stop ? 0.28 : 0.55) - u.uBase.value) * ease(4);
    });
    pinMaterials.forEach(({ uniforms: u }, i) => {
      u.uTime.value = t + i * 0.37;
      const on = i === active || i === hovered ? 1 : 0;
      u.uActive.value += (on - u.uActive.value) * ease(6);
      // Pins appear as the route reaches them; all show faintly when idle.
      // While touring, the current place's pins stay bright and the rest recede.
      const strength = stop ? (focusSet.has(i) ? 1 : 0.22) : 0.55;
      u.uOpacity.value += (d.intro * strength - u.uOpacity.value) * ease(5);

      // Pin the name tag beside the chosen city, hidden once it turns away.
      const el = label.current;
      if (el) {
        const pin = stop ? pins[active] : undefined;
        if (pin) {
          g.updateMatrixWorld();
          tag.pos.copy(pin.position).applyMatrix4(g.matrixWorld);
          g.getWorldPosition(tag.centre);
          tag.normal.copy(tag.pos).sub(tag.centre).normalize();
          tag.view.copy(state.camera.position).sub(tag.pos).normalize();
          const facing = tag.normal.dot(tag.view);
          tag.pos.project(state.camera);
          const x = ((tag.pos.x + 1) / 2) * state.size.width;
          const y = ((1 - tag.pos.y) / 2) * state.size.height;
          el.style.transform = `translate(${Math.round(x + 12)}px, ${Math.round(y)}px) translateY(-50%)`;
          el.style.opacity = facing > 0.2 ? "1" : "0";
        } else {
          el.style.opacity = "0";
        }
      }
    });
  });

  return (
    <group ref={group}>
      {/* Body: occludes back-side dots and blocks clicks on hidden pins */}
      <mesh onClick={(e) => e.stopPropagation()} onPointerOver={(e) => e.stopPropagation()}>
        <sphereGeometry args={[0.995, lite ? 48 : 72, lite ? 48 : 72]} />
        <meshBasicMaterial color="#11100e" />
      </mesh>

      {dots && <points geometry={dots} material={dotsMaterial} />}

      {arcs.map((geometry, i) => (
        <mesh key={`arc-${stops[i].slug}-${stops[i].name}-${i}`} geometry={geometry} material={arcMaterials[i]} />
      ))}

      {pins.map((p, i) => (
        <group key={`pin-${stops[i].slug}-${stops[i].name}`} position={p.position} quaternion={p.quaternion}>
          <mesh material={pinMaterials[i]}>
            <planeGeometry args={[0.11, 0.11]} />
          </mesh>
          {/* Generous invisible hit area */}
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(i);
            }}
            onPointerOut={() => setHovered((h) => (h === i ? null : h))}
          >
            <circleGeometry args={[0.05, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function GlobeCanvas({ running, lite, ...props }: Props) {
  return (
    <Canvas
      frameloop={running ? "always" : "never"}
      dpr={lite ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, lite ? 4.2 : 3.3], fov: 34 }}
      gl={{ antialias: !lite, alpha: true, powerPreference: "high-performance" }}
      fallback={
        <p className="micro p-6 text-paper-dim">
          WebGL isn&apos;t available, so the globe is off. The stop list still works.
        </p>
      }
      aria-hidden
    >
      <Earth lite={lite} {...props} />
    </Canvas>
  );
}
