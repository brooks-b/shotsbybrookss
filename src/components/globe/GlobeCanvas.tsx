"use client";

/* eslint-disable react-hooks/immutability -- shader uniforms are mutable GPU inputs, written every frame by design */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  type Group,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { GLOBE_READY } from "@/lib/preloader";
import { angleDelta, arcPoints, type GlobeProps, latLngToVec3, rotationToFace, type Vec3 } from "./geo3d";
import {
  arcFragment,
  arcVertex,
  atmosphereFragment,
  atmosphereVertex,
  dotsFragment,
  dotsVertex,
  pinFragment,
  pinVertex,
} from "./shaders";

export type { GlobeDrive, GlobeProps } from "./geo3d";
type Props = GlobeProps;

const PAPER = new Color("#ede8df");
const SIGNAL = new Color("#f0602f");
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

function Earth({ stops, active, drive, lite, onPick }: Omit<Props, "running">) {
  const group = useRef<Group>(null);
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

  const dotUniforms = useMemo(
    () => ({
      uSize: { value: lite ? 3.4 : 2.8 },
      uPixelRatio: { value: 1 },
      uActive: { value: new Vector3(0, 0, 1) },
      uActiveStrength: { value: 0 },
      uColor: { value: PAPER },
      uAccent: { value: SIGNAL },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    }),
    [lite],
  );

  // Uniform objects are created once per stop list so re-renders never reset them.
  const atmoUniforms = useMemo(() => ({ uColor: { value: PAPER }, uOpacity: { value: 0 } }), []);
  const arcUniforms = useMemo(
    () => stops.slice(1).map(() => ({ uColor: { value: SIGNAL }, uDraw: { value: 0 }, uOpacity: { value: 0 } })),
    [stops],
  );
  const pinUniforms = useMemo(
    () =>
      stops.map(() => ({
        uColor: { value: SIGNAL },
        uTime: { value: 0 },
        uActive: { value: 0 },
        uOpacity: { value: 0 },
      })),
    [stops],
  );

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
        return new TubeGeometry(curve, lite ? 40 : 96, lite ? 0.0045 : 0.0032, 6, false);
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
      g.rotation.x += (target.x * 0.85 - g.rotation.x) * ease(3.2);
      g.rotation.y += angleDelta(g.rotation.y, target.y) * ease(3.2);
    } else {
      g.rotation.x += (0.32 - g.rotation.x) * ease(2);
      g.rotation.y += dt * 0.06;
    }

    // On wide screens the globe slides right while the tour runs.
    const shiftTarget = viewport.width / viewport.height < 1.15 ? 0 : d.shift * Math.min(viewport.width * 0.14, 0.55);
    g.position.x += (shiftTarget - g.position.x) * ease(4);
    g.scale.setScalar(0.94 + 0.06 * d.intro);

    dotUniforms.uTime.value = t;
    dotUniforms.uOpacity.value = d.intro;
    dotUniforms.uPixelRatio.value = gl.getPixelRatio();
    if (stop) dotUniforms.uActive.value.lerp(toV3(latLngToVec3(stop.lat, stop.lng)), ease(5));
    dotUniforms.uActiveStrength.value += ((stop ? 1 : 0) - dotUniforms.uActiveStrength.value) * ease(4);
    atmoUniforms.uOpacity.value = 0.22 * d.intro;

    arcUniforms.forEach((u, i) => {
      u.uDraw.value = Math.min(Math.max(d.progress - i, 0), 1);
      u.uOpacity.value = d.intro;
    });
    pinUniforms.forEach((u, i) => {
      u.uTime.value = t + i * 0.37;
      const on = i === active || i === hovered ? 1 : 0;
      u.uActive.value += (on - u.uActive.value) * ease(6);
      // Pins appear as the route reaches them; all show faintly when idle.
      const reached = stop ? Math.min(Math.max(d.progress - i + 1, 0.3), 1) : 0.55;
      u.uOpacity.value = d.intro * reached;
    });
  });

  return (
    <group ref={group}>
      {/* Body: occludes back-side dots and blocks clicks on hidden pins */}
      <mesh onClick={(e) => e.stopPropagation()} onPointerOver={(e) => e.stopPropagation()}>
        <sphereGeometry args={[0.995, lite ? 48 : 72, lite ? 48 : 72]} />
        <meshBasicMaterial color="#11100e" />
      </mesh>

      {dots && (
        <points geometry={dots}>
          <shaderMaterial
            vertexShader={dotsVertex}
            fragmentShader={dotsFragment}
            uniforms={dotUniforms}
            transparent
            depthWrite={false}
          />
        </points>
      )}

      <mesh scale={1.16}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmoUniforms}
          side={BackSide}
          blending={AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>

      {arcs.map((geometry, i) => (
        <mesh key={`arc-${stops[i].slug}-${stops[i].name}-${i}`} geometry={geometry}>
          <shaderMaterial
            vertexShader={arcVertex}
            fragmentShader={arcFragment}
            uniforms={arcUniforms[i]}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}

      {pins.map((p, i) => (
        <group key={`pin-${stops[i].slug}-${stops[i].name}`} position={p.position} quaternion={p.quaternion}>
          <mesh>
            <planeGeometry args={[0.11, 0.11]} />
            <shaderMaterial
              vertexShader={pinVertex}
              fragmentShader={pinFragment}
              uniforms={pinUniforms[i]}
              transparent
              depthWrite={false}
            />
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
