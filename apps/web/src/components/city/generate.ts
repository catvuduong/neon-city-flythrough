import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';

export type Instance = {
  position: Vector3;
  scale: Vector3;
  quaternion: Quaternion;
  color: Color;
};

export type City = {
  buildings: Instance[];
  windows: Instance[];
  signs: Instance[];
  dashes: Instance[];
};

// Values above 1 push the neon past the bloom threshold.
const NEON = [
  new Color('#ff2bd6').multiplyScalar(2.6), // magenta
  new Color('#1ee8ff').multiplyScalar(2.6), // cyan
  new Color('#ffb020').multiplyScalar(2.6), // amber
];
const DASH_COLOR = new Color('#ffb020').multiplyScalar(2);
const BUILDING_DARK = new Color('#0d0b18');
const BUILDING_LIGHT = new Color('#1f1a33');

const ROAD_HALF_WIDTH = 16;
const ROW_SPACING = 16;
const ROWS_PER_SIDE = 5;
const WINDOW_CHANCE = 0.2;
const WINDOW_STEP_X = 2.2;
const WINDOW_STEP_Y = 3.2;
const SIGN_CHANCE = 0.3;
const FACE_OFFSET = 0.03;
const SIGN_OFFSET = 0.15;
const Z_AXIS = new Vector3(0, 0, 1);
const FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Keeps the underpass clear of the overpass deck (underside at y = 9.4), and makes the rooftop district low-rise.
function heightCap(z: number) {
  if (z < -124 && z > -158) return 8;
  if (z < -232 && z > -300) return 24;
  return Infinity;
}

function place(position: Vector3, normal: Vector3, scale: Vector3, color: Color): Instance {
  return {
    position,
    scale,
    quaternion: new Quaternion().setFromUnitVectors(Z_AXIS, normal),
    color,
  };
}

// Deterministic: the same seed always yields the same city. `reduced` keeps every other building,
// which halves every instance count derived from them.
export function generateCity(reduced: boolean): City {
  const rng = mulberry32(1337);
  const city: City = { buildings: [], windows: [], signs: [], dashes: [] };
  let candidate = 0;

  for (let row = 0; row < ROWS_PER_SIDE; row++) {
    for (const side of [-1, 1]) {
      let z = 60;
      while (z > -320) {
        const depth = 6 + rng() * 5;
        const width = 7 + rng() * 7;
        const xStart = ROAD_HALF_WIDTH + row * ROW_SPACING + rng() * 2;
        const core = Math.exp(-(((z + 150) / 120) ** 2));
        let height = 6 + rng() ** 2 * (28 + 90 * core) * (1 - row * 0.12);
        if (rng() < 0.06) height *= 1.8;
        height = Math.max(4, Math.min(height, heightCap(z)));

        const footprintZ = z - depth / 2;
        z -= depth + 0.6 + rng() * 2.2;

        const keep = !reduced || candidate % 2 === 0;
        candidate++;
        if (!keep) continue;

        const center = new Vector3(side * (xStart + width / 2), height / 2, footprintZ);
        const size = new Vector3(width, height, depth);
        city.buildings.push(place(center, Z_AXIS, size, new Color().lerpColors(BUILDING_DARK, BUILDING_LIGHT, rng())));
        addWindows(center, size, city.windows, rng);
        if (rng() < SIGN_CHANCE) addSign(center, size, city.signs, rng);
      }
    }
  }

  for (let dz = 50; dz > -340; dz -= 7) {
    city.dashes.push(place(new Vector3(0, 0.03, dz - 1.5), Z_AXIS, new Vector3(0.35, 0.02, 3), DASH_COLOR));
  }

  return city;
}

function addWindows(center: Vector3, size: Vector3, out: Instance[], rng: () => number) {
  const rows = Math.floor((size.y - 2) / WINDOW_STEP_Y);
  for (const normal of FACE_NORMALS) {
    const span = normal.x ? size.z : size.x;
    const cols = Math.floor(span / WINDOW_STEP_X);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() > WINDOW_CHANCE) continue;
        const along = -span / 2 + (c + 0.5) * (span / cols);
        const y = 2.2 + r * WINDOW_STEP_Y;
        const position = faceCenter(center, size, normal, along, y, FACE_OFFSET);
        const color = NEON[Math.floor(rng() * NEON.length)].clone();
        out.push(place(position, normal, new Vector3(1.1, 1.5, 1), color));
      }
    }
  }
}

function addSign(center: Vector3, size: Vector3, out: Instance[], rng: () => number) {
  const normal = FACE_NORMALS[Math.floor(rng() * FACE_NORMALS.length)];
  const span = normal.x ? size.z : size.x;
  const vertical = rng() < 0.5;
  const width = vertical ? 0.35 : Math.min(span * 0.5, 2 + rng() * 3);
  const height = vertical ? 3 + rng() * 4 : 0.7;
  const maxY = size.y - height - 1;
  if (maxY < 2) return;

  const along = (rng() - 0.5) * (span - width);
  const y = 2 + rng() * (maxY - 2);
  const position = faceCenter(center, size, normal, along, y + height / 2, SIGN_OFFSET);
  const scale = normal.x ? new Vector3(0.25, height, width) : new Vector3(width, height, 0.25);
  const color = NEON[Math.floor(rng() * NEON.length)].clone();
  out.push(place(position, normal, scale, color));
}

// Point on a building face at `along` (horizontal, across the face) and height `y`, pushed out by `offset`.
function faceCenter(center: Vector3, size: Vector3, normal: Vector3, along: number, y: number, offset: number) {
  return normal.x
    ? new Vector3(center.x + normal.x * (size.x / 2 + offset), y, center.z + along)
    : new Vector3(center.x + along, y, center.z + normal.z * (size.z / 2 + offset));
}

export function applyInstances(mesh: InstancedMesh, instances: Instance[]) {
  const matrix = new Matrix4();
  instances.forEach((instance, i) => {
    matrix.compose(instance.position, instance.quaternion, instance.scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, instance.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
