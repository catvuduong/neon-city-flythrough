'use client';

import dynamic from 'next/dynamic';
import { useRef, useState, useSyncExternalStore } from 'react';
import { SCENES } from './scenes';

const CityCanvas = dynamic(() => import('./CityCanvas').then((module) => module.CityCanvas), { ssr: false });

const STORAGE_KEY = 'neon-city:reduce-effects';
const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse)';

// The reduce-effects preference lives outside React so every component reads the same value.
// An explicit choice wins (kept in memory even if storage is blocked); otherwise small or touch screens start reduced.
let preference: boolean | null = null;
const listeners = new Set<() => void>();

function readStoredPreference(): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === '1';
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getReducedSnapshot() {
  if (preference === null) {
    preference = readStoredPreference() ?? window.matchMedia(MOBILE_QUERY).matches;
  }
  return preference;
}

function getServerReducedSnapshot() {
  return false;
}

function setReducedPreference(reduced: boolean) {
  preference = reduced;
  try {
    window.localStorage.setItem(STORAGE_KEY, reduced ? '1' : '0');
  } catch {
    // Storage can be blocked (private mode); the in-memory value still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function CityExperience() {
  const reduced = useSyncExternalStore(subscribe, getReducedSnapshot, getServerReducedSnapshot);
  const [sceneIndex, setSceneIndex] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const scene = SCENES[sceneIndex];

  return (
    <main className="city" data-reduced={reduced ? 'true' : 'false'}>
      <div className="city-stage">
        <CityCanvas reduced={reduced} progressRef={progressRef} onSceneChange={setSceneIndex} />
      </div>

      <div className="hud">
        <header className="hud-top">
          <h1 className="hud-title">Neon City</h1>
          <button
            type="button"
            data-testid="reduce-effects"
            className="hud-toggle"
            aria-pressed={reduced}
            onClick={() => setReducedPreference(!reduced)}
          >
            <span className="hud-toggle-dot" aria-hidden="true" />
            Reduce effects
          </button>
        </header>

        <footer className="hud-bottom">
          <p className="hud-index">
            {String(sceneIndex + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}
            <span className="hud-hint">Scroll to fly</span>
          </p>
          <div key={sceneIndex} className="hud-scene-block">
            <h2 data-testid="scene-name" className="hud-scene">
              {scene.name}
            </h2>
            <p className="hud-caption">{scene.caption}</p>
          </div>
          <div className="hud-progress" aria-hidden="true">
            <div ref={progressRef} data-testid="scroll-progress" className="hud-progress-fill" />
          </div>
        </footer>
      </div>
    </main>
  );
}
