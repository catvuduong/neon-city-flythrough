import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import {
  AdditiveBlending,
  Color,
  DataTexture,
  Group,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
} from 'three';
import { applyInstances, mulberry32, type Instance } from './generate';
import { damp, readScrollProgress } from './scroll';

const RAIN_BOX = new Vector3(70, 40, 70);
const SPEED_SMOOTHING = 5;
const scratchMatrix = new Matrix4();

const rainVertex = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aEnd;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  varying float vAlpha;

  void main() {
    float speed = 22.0 + aSeed.x * 14.0;
    float y = mod(aSeed.y * uBox.y - uTime * speed, uBox.y) - uBox.y * 0.5;
    float len = 0.9 + aSeed.z * 0.7 + speed * 0.03;
    vec3 rel = vec3((aSeed.x - 0.5) * uBox.x, y - aEnd * len, (aSeed.z - 0.5) * uBox.z);
    rel.x -= aEnd * 0.25;
    vec3 world = uCenter + rel;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);

    float edge = 1.0 - smoothstep(0.55, 1.0, length(rel.xz) / (uBox.x * 0.5));
    float ground = smoothstep(0.2, 2.5, world.y);
    vAlpha = (1.0 - aEnd) * edge * ground;
  }
`;

const rainFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, vAlpha * 0.5);
  }
`;

const speedVertex = /* glsl */ `
  attribute vec3 aSeed;
  attribute float aEnd;
  uniform float uTime;
  uniform float uSpeed;
  varying float vAlpha;

  void main() {
    float travel = uTime * (40.0 + 120.0 * uSpeed);
    float z = -60.0 + mod(aSeed.z * 60.0 + travel, 60.0);
    vec2 dir = normalize(aSeed.xy * 2.0 - 1.0 + vec2(0.0001));
    float len = 3.0 + 9.0 * uSpeed;
    vec3 p = vec3(dir * (0.8 + aSeed.x * 2.2), z - aEnd * len);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

    float fade = smoothstep(-60.0, -40.0, z) * (1.0 - smoothstep(-8.0, -1.5, z));
    vAlpha = uSpeed * (1.0 - aEnd) * fade;
  }
`;

const speedFragment = /* glsl */ `
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(vec3(0.75, 0.95, 1.0), vAlpha * 0.7);
  }
`;

// Each streak is two vertices sharing one random seed; aEnd picks the head (0) or the tail (1).
function buildStreaks(count: number, seed: number) {
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 2 * 3);
  const seeds = new Float32Array(count * 2 * 3);
  const ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [rng(), rng(), rng()];
    for (let e = 0; e < 2; e++) {
      const v = i * 2 + e;
      seeds.set(s, v * 3);
      ends[v] = e;
    }
  }
  return { positions, seeds, ends };
}

function Streaks({ count, seed }: { count: number; seed: number }) {
  const { positions, seeds, ends } = useMemo(() => buildStreaks(count, seed), [count, seed]);
  return (
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      <bufferAttribute attach="attributes-aSeed" args={[seeds, 3]} />
      <bufferAttribute attach="attributes-aEnd" args={[ends, 1]} />
    </bufferGeometry>
  );
}

// Falling streaks that stay centred on the camera. The fall happens on the GPU, so this costs one draw call.
export function Rain({ count }: { count: number }) {
  const { camera } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCenter: { value: new Vector3() },
      uBox: { value: RAIN_BOX },
      uColor: { value: new Color('#8fd8ff') },
    }),
    [],
  );

  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    const live = materialRef.current?.uniforms;
    if (!live) return;
    live.uTime.value = state.clock.elapsedTime;
    live.uCenter.value.copy(camera.position);
  });

  return (
    <lineSegments frustumCulled={false}>
      <Streaks count={count} seed={7} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={rainVertex}
        fragmentShader={rainFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </lineSegments>
  );
}

// Streaks rushing past the camera; they only show while the scroll speed is high.
export function SpeedLines({ count }: { count: number }) {
  const scroll = useScroll();
  const { camera } = useThree();
  const groupRef = useRef<Group>(null);
  const speed = useRef(0);
  const lastOffset = useRef(0);
  const materialRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSpeed: { value: 0 } }), []);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const live = materialRef.current?.uniforms;
    if (!group || !live) return;
    const progress = readScrollProgress(scroll);
    const rawSpeed = Math.abs(progress - lastOffset.current) / Math.max(delta, 1e-3);
    lastOffset.current = progress;
    speed.current = damp(speed.current, Math.min(1, rawSpeed * 2.5), SPEED_SMOOTHING, delta);

    group.position.copy(camera.position);
    group.quaternion.copy(camera.quaternion);
    group.visible = speed.current > 0.02;
    live.uSpeed.value = speed.current;
    live.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={groupRef}>
      <lineSegments frustumCulled={false}>
        <Streaks count={count} seed={21} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={speedVertex}
          fragmentShader={speedFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

// A soft radial gradient used for the fog banks, so no image asset is needed.
function makeGlowTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = ((x + 0.5) / size) * 2 - 1;
      const dy = ((y + 0.5) / size) * 2 - 1;
      const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      data.set([255, 255, 255, Math.round(falloff * falloff * 255)], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Street-level fog banks that always face the camera. One draw call for all of them.
export function FogBanks({ banks }: { banks: Instance[] }) {
  const { camera } = useThree();
  const meshRef = useRef<InstancedMesh>(null);
  const texture = useMemo(() => makeGlowTexture(), []);

  useLayoutEffect(() => {
    if (meshRef.current) applyInstances(meshRef.current, banks);
  }, [banks]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    banks.forEach((bank, i) => {
      scratchMatrix.compose(bank.position, camera.quaternion, bank.scale);
      mesh.setMatrixAt(i, scratchMatrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, banks.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  );
}
