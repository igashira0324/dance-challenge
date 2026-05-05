import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';

interface Props {
  vrm: VRM | null;
  onReady?: (scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) => void;
}

export const VRMViewport: React.FC<Props> = ({ vrm, onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    if (!containerRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.Fog(0x050510, 5, 15);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(40, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 1.4, 2.5);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 10, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // STAGE / FLOOR
    const grid = new THREE.GridHelper(20, 20, 0x00ffff, 0x444444);
    grid.position.y = -0.01;
    scene.add(grid);

    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x111111,
      roughness: 0.1,
      metalness: 0.5,
      transparent: true,
      opacity: 0.5
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // PARTICLES (Basic)
    const count = 500;
    const vertices = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      vertices[i * 3] = (Math.random() - 0.5) * 10;
      vertices[i * 3 + 1] = Math.random() * 5;
      vertices[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const particleMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0x00ffff, transparent: true, opacity: 0.5 });
    const points = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(points);

    // HANDLE RESIZE
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ANIMATION LOOP
    let requestFrameId: number;
    const animate = () => {
      requestFrameId = requestAnimationFrame(animate);
      clockRef.current.getDelta();
      
      // Floating effect for particles
      points.rotation.y += 0.001;

      renderer.render(scene, camera);
    };
    animate();

    if (onReady) onReady(scene, camera, renderer);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestFrameId);
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync VRM with Scene
  useEffect(() => {
    if (sceneRef.current && vrm) {
      sceneRef.current.add(vrm.scene);
      return () => {
        if (sceneRef.current) sceneRef.current.remove(vrm.scene);
      };
    }
  }, [vrm]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default VRMViewport;
