import type { RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollControls } from '@react-three/drei';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { NoToneMapping } from 'three';
import { CityScene } from './CityScene';
import { SCENES } from './scenes';

type CityCanvasProps = {
  reduced: boolean;
  progressRef: RefObject<HTMLDivElement | null>;
  onSceneChange: (index: number) => void;
};

export function CityCanvas({ reduced, progressRef, onSceneChange }: CityCanvasProps) {
  return (
    <Canvas
      dpr={reduced ? 1 : [1, 1.5]}
      camera={{ fov: 60, near: 0.1, far: 900, position: [0, 6, 34] }}
      gl={{ antialias: !reduced, powerPreference: 'high-performance', toneMapping: NoToneMapping }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.testid = 'city-canvas';
      }}
    >
      <ScrollControls pages={SCENES.length} damping={0.2}>
        <CityScene
          key={reduced ? 'reduced' : 'full'}
          reduced={reduced}
          progressRef={progressRef}
          onSceneChange={onSceneChange}
        />
        {!reduced && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={1.1} luminanceThreshold={0.45} luminanceSmoothing={0.25} radius={0.85} mipmapBlur />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.0008, 0.0008]} />
            <Vignette blendFunction={BlendFunction.NORMAL} offset={0.28} darkness={0.7} />
          </EffectComposer>
        )}
      </ScrollControls>
    </Canvas>
  );
}
