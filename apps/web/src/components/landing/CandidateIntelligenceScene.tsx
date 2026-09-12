"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const NODE_COUNT = 12;
const CAMERA_TARGETS = [
  [0, 0.3, 8], [1.1, 0.5, 7], [-0.8, 0.2, 6.6], [0, 1.1, 7.4],
  [1.4, 0.5, 8.2], [-1.1, 1.4, 7], [0, 0.1, 6.2],
] as const;

function positionFor(stage: number, index: number) {
  const angle = (index / NODE_COUNT) * Math.PI * 2;
  if (stage === 0) return new THREE.Vector3(Math.cos(angle) * 0.9, Math.sin(angle * 2) * 0.45, Math.sin(angle) * 0.9);
  if (stage === 1) return new THREE.Vector3((index % 2 ? 1 : -1) * (1.2 + (index % 3) * 0.35), (Math.floor(index / 2) - 2.5) * 0.42, Math.sin(angle) * 0.4);
  if (stage === 2) return new THREE.Vector3(Math.cos(angle) * (1.7 + (index % 3) * 0.3), Math.sin(angle) * 1.5, Math.sin(angle * 2) * 0.7);
  if (stage === 3) return new THREE.Vector3(Math.cos(angle) * 2.3, Math.sin(angle) * 2.3, (index % 3 - 1) * 0.45);
  if (stage === 4) return new THREE.Vector3(Math.cos(angle) * (1.5 + (index % 4) * 0.35), Math.sin(angle * 1.5) * 1.8, Math.sin(angle) * 1.6);
  if (stage === 5) return new THREE.Vector3((index % 4 - 1.5) * 0.9, (Math.floor(index / 4) - 1) * 1.1, Math.sin(angle) * 0.35);
  return new THREE.Vector3(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, Math.sin(angle * 3) * 0.3);
}

function Scene({ progress }: { progress: number }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const nodes = useRef<Array<THREE.Mesh | null>>([]);
  const { camera, invalidate } = useThree();
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const scaled = progress * 6;
    const from = Math.floor(scaled);
    const to = Math.min(6, from + 1);
    const mix = scaled - from;
    const fromCamera = CAMERA_TARGETS[from];
    const toCamera = CAMERA_TARGETS[to];

    camera.position.set(
      THREE.MathUtils.lerp(fromCamera[0], toCamera[0], mix),
      THREE.MathUtils.lerp(fromCamera[1], toCamera[1], mix),
      THREE.MathUtils.lerp(fromCamera[2], toCamera[2], mix),
    );
    camera.lookAt(0, 0, 0);
    if (group.current) {
      group.current.rotation.set(progress * 0.35, progress * Math.PI * 1.4, progress * 0.12);
      group.current.scale.setScalar(0.88 + Math.sin(progress * Math.PI) * 0.12);
    }
    if (core.current) {
      core.current.rotation.set(progress * Math.PI, progress * Math.PI * 2, 0);
      core.current.scale.setScalar(0.8 + progress * 0.35);
    }

    const linePoints: number[] = [];
    nodes.current.forEach((node, index) => {
      if (!node) return;
      const position = positionFor(from, index).lerp(positionFor(to, index), mix);
      node.position.copy(position);
      node.scale.setScalar(index <= Math.ceil(progress * NODE_COUNT) ? 1 : 0.55);
      linePoints.push(0, 0, 0, position.x, position.y, position.z);
    });
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(linePoints, 3));
    invalidate();
  }, [camera, geometry, invalidate, progress]);

  return (
    <group ref={group}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color="#ff4d1c" transparent opacity={0.2 + progress * 0.25} />
      </lineSegments>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial color="#171717" emissive="#ff4d1c" emissiveIntensity={0.22 + progress * 0.35} metalness={0.75} roughness={0.35} wireframe />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.66, 0]} />
        <meshStandardMaterial color="#24140f" emissive="#ff4d1c" emissiveIntensity={0.35} metalness={0.65} roughness={0.4} />
      </mesh>
      {Array.from({ length: NODE_COUNT }, (_, index) => (
        <mesh key={index} ref={(node) => { nodes.current[index] = node; }}>
          <sphereGeometry args={[index % 3 === 0 ? 0.13 : 0.085, 8, 8]} />
          <meshStandardMaterial color={index <= progress * NODE_COUNT ? "#ff4d1c" : "#817d76"} emissive="#ff4d1c" emissiveIntensity={index <= progress * NODE_COUNT ? 1.4 : 0.08} />
        </mesh>
      ))}
    </group>
  );
}

export default function CandidateIntelligenceScene({ progress }: { progress: number }) {
  return (
    <Canvas
      className="core-narrative__canvas"
      camera={{ position: [0, 0.3, 8], fov: 42 }}
      dpr={[1, 1.5]}
      frameloop="demand"
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#101010"]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[4, 5, 5]} intensity={2.2} color="#ff4d1c" />
      <pointLight position={[-4, -2, 3]} intensity={0.7} color="#f0ede8" />
      <Scene progress={progress} />
    </Canvas>
  );
}
