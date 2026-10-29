import { CatmullRomCurve3, Vector3 } from 'three';

export const SCENES = [
  { name: 'Downtown', caption: 'Neon canyons and wet asphalt.' },
  { name: 'Skyline', caption: 'Rising above the towers.' },
  { name: 'Underpass', caption: 'Beneath the elevated highway.' },
  { name: 'Rooftops', caption: 'Skimming low over the rooftops.' },
  { name: 'Horizon', caption: 'Where the city meets the bay.' },
] as const;

// Every second control point is a scene anchor, so scene i sits exactly at scroll progress i / 4.
const ROUTE_POINTS = [
  new Vector3(0, 6, 34), // Downtown
  new Vector3(-5, 14, -8),
  new Vector3(-9, 72, -55), // Skyline
  new Vector3(4, 26, -105),
  new Vector3(0, 3.2, -140), // Underpass, below the overpass deck at z = -140
  new Vector3(5, 14, -175),
  new Vector3(-6, 30, -225), // Rooftops
  new Vector3(6, 30, -280),
  new Vector3(0, 12, -340), // Horizon
];

export const ROUTE = new CatmullRomCurve3(ROUTE_POINTS, false, 'centripetal');

export function sceneIndexFor(progress: number) {
  const last = SCENES.length - 1;
  return Math.min(last, Math.max(0, Math.round(progress * last)));
}
