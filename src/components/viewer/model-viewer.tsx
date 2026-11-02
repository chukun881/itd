'use client';

import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface ModelProps {
  url: string;
  wireframe?: boolean;
}

function ModelMesh({ url, wireframe = false }: ModelProps) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);

  // Apply wireframe override if requested
  React.useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            if ('wireframe' in mat) {
              (mat as THREE.MeshStandardMaterial).wireframe = wireframe;
            }
          });
        } else if (mesh.material && 'wireframe' in mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).wireframe = wireframe;
        }
      }
    });
  }, [scene, wireframe]);

  return (
    <Center top>
      <primitive ref={modelRef} object={scene} />
    </Center>
  );
}

interface ModelViewerProps {
  modelUrl: string;
  wireframe?: boolean;
  autoRotate?: boolean;
  className?: string;
}

export function ModelViewer({
  modelUrl,
  wireframe = false,
  autoRotate = true,
  className = 'w-full h-[500px]',
}: ModelViewerProps) {
  return (
    <div className={`relative rounded-xl overflow-hidden bg-neutral-900 ${className}`}>
      <Canvas
        camera={{ position: [0, 1.5, 3.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, -2, -5]} intensity={0.4} />

        <Suspense fallback={null}>
          <ModelMesh url={modelUrl} wireframe={wireframe} />
          <Environment preset="city" />
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.6}
            scale={10}
            blur={2}
            far={4}
          />
        </Suspense>

        <OrbitControls
          makeDefault
          autoRotate={autoRotate}
          autoRotateSpeed={1.5}
          enablePan={true}
          enableZoom={true}
          minDistance={1}
          maxDistance={15}
        />
      </Canvas>
    </div>
  );
}
