import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";

const Particles = ({ count = 200 }) => {
  const mesh = useRef();
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        position: [
          (Math.random() - 0.5) * 10,
          Math.random() * 8 - 2, // hovering height range
          (Math.random() - 0.5) * 10,
        ],
        velocity: [
          (Math.random() - 0.5) * 0.01, // gentle horizontal drift
          (Math.random() - 0.5) * 0.003, // subtle vertical float
          (Math.random() - 0.5) * 0.01,
        ],
        fallSpeed: 0.001 + Math.random() * 0.0005, // very gentle falling
      });
    }
    return temp;
  }, [count]);
  
  useFrame(({ clock }) => {
    const positions = mesh.current.geometry.attributes.position.array;
    const time = clock.getElapsedTime();
    
    for (let i = 0; i < count; i++) {
      const particle = particles[i];
      
      // Get current position
      let x = positions[i * 3];
      let y = positions[i * 3 + 1];
      let z = positions[i * 3 + 2];
      
      // Apply gentle floating motion like fireflies
      x += particle.velocity[0] + Math.sin(time * 0.3 + i) * 0.002;
      y += particle.velocity[1] + Math.cos(time * 0.2 + i * 0.5) * 0.003;
      z += particle.velocity[2] + Math.sin(time * 0.25 + i * 0.3) * 0.002;
      
      // Very gentle falling motion
      y -= particle.fallSpeed;
      if (y < -4) y = Math.random() * 8 - 2; // reset to hovering range
      
      // Boundary constraints to keep particles in area
      if (x > 5) {
        x = 5;
        particle.velocity[0] *= -0.8;
      } else if (x < -5) {
        x = -5;
        particle.velocity[0] *= -0.8;
      }
      
      // Y-axis (height) boundaries for hovering motion
      if (y > 4) {
        y = 4;
        particle.velocity[1] *= -0.8;
      } else if (y < -4) {
        y = -4;
        particle.velocity[1] *= -0.8;
      }
      
      if (z > 5) { // CHANGE THIS VALUE to control Z-axis maximum
        z = 5;
        particle.velocity[2] *= -0.8;
      } else if (z < -5) { // CHANGE THIS VALUE to control Z-axis minimum
        z = -5;
        particle.velocity[2] *= -0.8;
      }
      
      // Update positions
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });
  
  const positions = new Float32Array(count * 3);
  particles.forEach((p, i) => {
    positions[i * 3] = p.position[0];
    positions[i * 3 + 1] = p.position[1];
    positions[i * 3 + 2] = p.position[2];
  });
  
  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.05}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
};

export default Particles;