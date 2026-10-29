import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useScroll, MeshReflectorMaterial } from '@react-three/drei';
import { Color, Quaternion, Vector3, type InstancedMesh } from 'three';
import { FogBanks, Rain, SpeedLines } from './effects';
import { applyInstances, generateCity, mulberry32, type Instance } from './generate';
import { ROUTE, sceneIndexFor } from './scenes';
import { damp, readScrollProgress } from './scroll';

type SceneProps = {
  reduced: boolean;
  progressRef: RefObject<HTMLDivElement | null>;
  onSceneChange: (index: number) => void;
};

const SKY = '#06030d';
const FOG = '#140a24';
const SUN = new Color('#ff8a3d').multiplyScalar(1.1);
const OVERPASS_EDGE = new Color('#1ee8ff').multiplyScalar(2.4);
const FOG_COLORS = [new Color('#4a1660'), new Color('#0f4a5e')];
const CAMERA_GLIDE = 4;

const scratchTarget = new Vector3();
const scratchTangent = new Vector3();
const scratchPoint = new Vector3();

function fogBanks(reduced: boolean): Instance[] {
  const rng = mulberry32(404);
  const count = reduced ? 24 : 48;
  return Array.from({ length: count }, () => ({
    position: new Vector3(-70 + rng() * 140, 2 + rng() * 10, 40 - rng() * 370),
    scale: new Vector3(26 + rng() * 22, 14 + rng() * 10, 1),
    quaternion: new Quaternion(),
    color: FOG_COLORS[Math.floor(rng() * FOG_COLORS.length)].clone().multiplyScalar(0.35 + rng() * 0.3),
  }));
}

// Scroll progress drives the camera along the curve, with a gentle sway on top.
function CameraRig({ reduced, progressRef, onSceneChange }: SceneProps) {
  const scroll = useScroll();
  const { camera } = useThree();
  const lastScene = useRef(-1);
  const progress = useRef(0);

  useFrame((state, delta) => {
    progress.current = damp(progress.current, readScrollProgress(scroll), CAMERA_GLIDE, delta);
    const t = progress.current;
    const time = state.clock.elapsedTime;
    const sway = reduced ? 0.5 : 1;

    ROUTE.getPoint(t, scratchPoint);
    ROUTE.getTangent(t, scratchTangent);
    camera.position.set(
      scratchPoint.x + Math.sin(time * 0.55) * 0.6 * sway,
      scratchPoint.y + Math.sin(time * 0.83) * 0.25 * sway,
      scratchPoint.z,
    );
    scratchTarget.copy(scratchPoint).addScaledVector(scratchTangent, 16);
    scratchTarget.y += Math.sin(time * 0.4) * 0.3 * sway;
    camera.lookAt(scratchTarget);

    const index = sceneIndexFor(t);
    if (index !== lastScene.current) {
      lastScene.current = index;
      onSceneChange(index);
    }
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${t})`;
  });

  return null;
}

export function CityScene({ reduced, progressRef, onSceneChange }: SceneProps) {
  const city = useMemo(() => generateCity(reduced), [reduced]);
  const banks = useMemo(() => fogBanks(reduced), [reduced]);
  const buildingsRef = useRef<InstancedMesh>(null);
  const windowsRef = useRef<InstancedMesh>(null);
  const signsRef = useRef<InstancedMesh>(null);
  const dashesRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    if (buildingsRef.current) applyInstances(buildingsRef.current, city.buildings);
    if (windowsRef.current) applyInstances(windowsRef.current, city.windows);
    if (signsRef.current) applyInstances(signsRef.current, city.signs);
    if (dashesRef.current) applyInstances(dashesRef.current, city.dashes);
  }, [city]);

  return (
    <>
      <color attach="background" args={[SKY]} />
      <fogExp2 attach="fog" args={[FOG, 0.011]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#6a4cff', '#06030a', 0.6]} />
      <directionalLight position={[-30, 40, 20]} intensity={0.8} color="#8a7cff" />

      <CameraRig reduced={reduced} progressRef={progressRef} onSceneChange={onSceneChange} />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -150]}>
        <planeGeometry args={[400, 700]} />
        {reduced ? (
          <meshStandardMaterial color="#0a0814" roughness={0.3} metalness={0.6} />
        ) : (
          <MeshReflectorMaterial
            color="#0a0814"
            resolution={512}
            blur={[160, 60]}
            mixBlur={1}
            mixStrength={35}
            mirror={0.6}
            roughness={0.9}
            metalness={0.5}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            depthScale={1.2}
          />
        )}
      </mesh>

      <instancedMesh ref={buildingsRef} args={[undefined, undefined, city.buildings.length]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial roughness={0.85} metalness={0.1} />
      </instancedMesh>

      <instancedMesh ref={windowsRef} args={[undefined, undefined, city.windows.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={signsRef} args={[undefined, undefined, city.signs.length]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <instancedMesh ref={dashesRef} args={[undefined, undefined, city.dashes.length]} frustumCulled={false}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <mesh position={[0, 10, -140]}>
        <boxGeometry args={[120, 1.2, 6]} />
        <meshStandardMaterial color="#15121f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 9.35, -136.8]}>
        <boxGeometry args={[120, 0.12, 0.2]} />
        <meshBasicMaterial color={OVERPASS_EDGE} toneMapped={false} />
      </mesh>

      <mesh position={[0, 34, -470]}>
        <circleGeometry args={[40, 64]} />
        <meshBasicMaterial color={SUN} toneMapped={false} fog={false} />
      </mesh>

      <FogBanks banks={banks} />
      <Rain count={reduced ? 900 : 1800} />
      <SpeedLines count={reduced ? 70 : 140} />
    </>
  );
}
