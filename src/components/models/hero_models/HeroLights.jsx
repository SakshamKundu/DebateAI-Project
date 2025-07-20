import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const HeroLights = () => {
  const mainSpotRef = useRef();
  const blueSpotRef = useRef();
  const purpleSpotRef = useRef();
  const areaLightRef = useRef();
  const atmosphericPoint1Ref = useRef();
  const atmosphericPoint2Ref = useRef();

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    // Subtle flickering for main lamp (like a real bulb)
    if (mainSpotRef.current) {
      mainSpotRef.current.intensity = 80 + Math.sin(time * 8) * 3 + Math.sin(time * 13) * 5;
    }
    
    // Gentle breathing effect for blue overhead
    if (blueSpotRef.current) {
      blueSpotRef.current.intensity = 38 + Math.sin(time * 0.7) * 6;
      // Slight position sway
      blueSpotRef.current.position.x = 4 + Math.sin(time * 0.3) * 0.2;
    }
    
    // Purple side light gentle pulsing
    if (purpleSpotRef.current) {
      purpleSpotRef.current.intensity = 55 + Math.sin(time * 0.5) * 8;
    }
    
    // Area light gentle oscillation
    if (areaLightRef.current) {
      areaLightRef.current.intensity = 13 + Math.sin(time * 0.4) * 4;
      // Slight rotation animation
      areaLightRef.current.rotation.y = Math.PI / 4 + Math.sin(time * 0.2) * 0.1;
    }
    
    // Atmospheric points with slow color shifts
    if (atmosphericPoint1Ref.current) {
      const colorShift = 0.5 + 0.5 * Math.sin(time * 0.3);
      atmosphericPoint1Ref.current.color.setHSL(0.83 - colorShift * 0.1, 0.8, 0.5); // Purple to deep blue
      atmosphericPoint1Ref.current.intensity = 8 + Math.sin(time * 0.6) * 4;
    }
    
    if (atmosphericPoint2Ref.current) {
      const colorShift = 0.5 + 0.5 * Math.sin(time * 0.4 + Math.PI);
      atmosphericPoint2Ref.current.color.setHSL(0.75 + colorShift * 0.08, 0.9, 0.4); // Blue to violet
      atmosphericPoint2Ref.current.intensity = 7 + Math.sin(time * 0.8) * 5;
      // Gentle floating motion
      atmosphericPoint2Ref.current.position.y = 2 + Math.sin(time * 0.25) * 0.3;
    }
  });

  return (
    <>
      {/* Enhanced main lamp with realistic flickering */}
      <spotLight
        ref={mainSpotRef}
        position={[2, 5, 6]}
        angle={0.15}
        penumbra={0.2}
        intensity={100}
        color="white"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      
      {/* Enhanced bluish overhead with breathing effect */}
      <spotLight
        ref={blueSpotRef}
        position={[4, 5, 4]}
        angle={0.3}
        penumbra={0.5}
        intensity={40}
        color="#4cc9f0"
        castShadow
      />
      
      {/* Enhanced purple side with gentle pulsing */}
      <spotLight
        ref={purpleSpotRef}
        position={[-3, 5, 5]}
        angle={0.4}
        penumbra={1}
        intensity={60}
        color="#9d4edd"
      />
      
      {/* Enhanced area light with rotation animation */}
      <primitive
        ref={areaLightRef}
        object={new THREE.RectAreaLight("#a259ff", 8, 3, 2)}
        position={[1, 3, 4]}
        rotation={[-Math.PI / 4, Math.PI / 4, 0]}
        intensity={15}
      />
      
      {/* Enhanced atmospheric points with color shifting */}
      <pointLight 
        ref={atmosphericPoint1Ref}
        position={[0, 1, 0]} 
        intensity={10} 
        color="#7209b7"
        distance={8}
        decay={1.5}
      />
      <pointLight 
        ref={atmosphericPoint2Ref}
        position={[1, 2, -2]} 
        intensity={10} 
        color="#0d00a4"
        distance={6}
        decay={2}
      />
      
      {/* Additional ambient enhancement lights */}
      <pointLight 
        position={[-2, 1.5, 3]} 
        intensity={5} 
        color="#ff6b9d"
        distance={4}
        decay={2}
      />
      
      {/* Subtle rim lighting for depth */}
      <spotLight
        position={[6, 3, -3]}
        target-position={[0, 0, 0]}
        angle={0.8}
        penumbra={1}
        intensity={15}
        color="#1a1a40"
      />
    </>
  );
};

export default HeroLights;