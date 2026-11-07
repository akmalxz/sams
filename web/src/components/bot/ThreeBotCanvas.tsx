import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type BotMood = 'focus' | 'clean' | 'dirty' | 'error';

interface ThreeBotCanvasProps {
  mood?: BotMood;
  message?: string;
  isDark?: boolean;
  onBotClick?: () => void;
}

export const ThreeBotCanvas: React.FC<ThreeBotCanvasProps> = ({
  mood = 'focus',
  message,
  isDark = false,
  onBotClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [speechVisible, setSpeechVisible] = useState(true);

  // Visor color according to mood
  const getMoodColor = (m: BotMood): number => {
    switch (m) {
      case 'clean':
        return 0x10b981; // Emerald green
      case 'dirty':
        return 0xf59e0b; // Amber
      case 'error':
        return 0xef4444; // Red
      case 'focus':
      default:
        return 0x3b82f6; // Royal blue
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 4.2);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.9 : 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.4 : 1.8);
    dirLight.position.set(3, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(isDark ? 0x3b82f6 : 0x60a5fa, 0.8);
    backLight.position.set(-3, -2, -2);
    scene.add(backLight);

    // Visor glow point light
    const visorLight = new THREE.PointLight(getMoodColor(mood), 2.5, 3);
    visorLight.position.set(0, 0.3, 0.9);
    scene.add(visorLight);

    // 4. Procedural 3D Bot Hierarchy
    const botRoot = new THREE.Group();
    scene.add(botRoot);

    // Materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e293b : 0xf8fafc,
      roughness: 0.25,
      metalness: 0.1,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: isDark ? 0x0f172a : 0xe2e8f0,
      roughness: 0.4,
      metalness: 0.2,
    });

    const visorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.2,
      ior: 1.5,
    });

    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: getMoodColor(mood),
      emissive: getMoodColor(mood),
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    // A. Head (Rounded capsule shape)
    const headGroup = new THREE.Group();
    botRoot.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.8, 32, 24);
    headGeo.scale(1, 0.92, 0.95);
    const headMesh = new THREE.Mesh(headGeo, bodyMaterial);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // B. Visor (Dark Glass Faceplate)
    const visorGeo = new THREE.SphereGeometry(0.72, 32, 16, 0, Math.PI, 0, Math.PI);
    visorGeo.scale(1.02, 0.65, 0.6);
    visorGeo.rotateX(Math.PI / 2);
    const visorMesh = new THREE.Mesh(visorGeo, visorMaterial);
    visorMesh.position.set(0, 0.05, 0.52);
    headGroup.add(visorMesh);

    // C. Glowing Eyes (2 digital capsule pills)
    const eyeGeo = new THREE.CapsuleGeometry(0.06, 0.12, 8, 16);
    eyeGeo.rotateZ(Math.PI / 2);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    leftEye.position.set(-0.24, 0.08, 0.82);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    rightEye.position.set(0.24, 0.08, 0.82);
    headGroup.add(rightEye);

    // D. Halo / Crown Ring
    const haloGeo = new THREE.TorusGeometry(0.48, 0.035, 16, 32);
    haloGeo.rotateX(Math.PI / 2);
    const haloMesh = new THREE.Mesh(haloGeo, eyeMaterial);
    haloMesh.position.set(0, 0.92, 0);
    headGroup.add(haloMesh);

    // E. Left & Right Magnetic Floating Hands
    const handGeo = new THREE.SphereGeometry(0.2, 24, 16);
    handGeo.scale(0.9, 1.2, 0.9);

    const leftHand = new THREE.Mesh(handGeo, accentMaterial);
    leftHand.position.set(-1.15, -0.3, 0.1);
    leftHand.castShadow = true;
    botRoot.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, accentMaterial);
    rightHand.position.set(1.15, -0.3, 0.1);
    rightHand.castShadow = true;
    botRoot.add(rightHand);

    // F. Thruster Hover Ring underneath
    const thrusterGeo = new THREE.TorusGeometry(0.28, 0.04, 16, 24);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMesh = new THREE.Mesh(thrusterGeo, eyeMaterial);
    thrusterMesh.position.set(0, -0.85, 0);
    botRoot.add(thrusterMesh);

    // Soft Contact Shadow Plane underneath
    const shadowGeo = new THREE.PlaneGeometry(2.2, 2.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: isDark ? 0.35 : 0.18,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotateX(-Math.PI / 2);
    shadowMesh.position.set(0, -1.35, 0);
    scene.add(shadowMesh);

    // 5. Mouse Interaction / Cursor Gaze Tracking
    const mouse = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - (rect.left + rect.width / 2);
      const clientY = e.clientY - (rect.top + rect.height / 2);

      // Normalized coordinates (-1 to 1 bounded)
      mouse.x = Math.max(-1, Math.min(1, clientX / (window.innerWidth / 2)));
      mouse.y = Math.max(-1, Math.min(1, clientY / (window.innerHeight / 2)));

      targetRotation.y = mouse.x * 0.45;
      targetRotation.x = -mouse.y * 0.28;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Click spin animation state
    let spinVelocity = 0;
    const handleContainerClick = () => {
      spinVelocity = Math.PI * 2;
      if (onBotClick) onBotClick();
    };

    container.addEventListener('click', handleContainerClick);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 6. Animation Loop with Modern Web Guidance Resource Guard
    let animId = 0;
    let isPaused = false;
    const clock = new THREE.Clock();

    const animate = () => {
      if (isPaused) return;

      const elapsed = clock.getElapsedTime();

      // Smooth floating bob physics
      const floatY = Math.sin(elapsed * 2.2) * 0.08;
      botRoot.position.y = floatY;

      // Magnetic hands independent breathing float
      leftHand.position.y = -0.3 + Math.sin(elapsed * 2.5 + 0.6) * 0.06;
      rightHand.position.y = -0.3 + Math.sin(elapsed * 2.5 - 0.6) * 0.06;

      // Halo gentle spin & bob
      haloMesh.rotation.z = elapsed * 0.8;
      haloMesh.position.y = 0.92 + Math.sin(elapsed * 3) * 0.03;

      // Contact shadow breath
      shadowMesh.scale.setScalar(1 - floatY * 0.4);

      // Spin physics on click
      if (spinVelocity > 0.01) {
        headGroup.rotation.y += spinVelocity * 0.12;
        spinVelocity *= 0.88;
      } else {
        // Cursor gaze tracking interpolation (Lerp)
        headGroup.rotation.y += (targetRotation.y - headGroup.rotation.y) * 0.08;
        headGroup.rotation.x += (targetRotation.x - headGroup.rotation.x) * 0.08;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    // Modern Web Guidance: Pause WebGL when tab is hidden to save battery & CPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPaused = true;
        cancelAnimationFrame(animId);
      } else {
        isPaused = false;
        clock.start();
        animate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleContainerClick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Three.js assets
      renderer.dispose();
      headGeo.dispose();
      visorGeo.dispose();
      eyeGeo.dispose();
      haloGeo.dispose();
      handGeo.dispose();
      thrusterGeo.dispose();
      shadowGeo.dispose();
      bodyMaterial.dispose();
      accentMaterial.dispose();
      visorMaterial.dispose();
      eyeMaterial.dispose();
      shadowMat.dispose();
    };
  }, [mood, isDark, onBotClick]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-64 sm:h-72 cursor-pointer transition-transform hover:scale-102 active:scale-98"
        title="Click SAM to interact"
      />

      {/* Interactive Speech / Status Bubble */}
      {message && speechVisible && (
        <div className="relative -mt-4 mx-4 px-4 py-2.5 rounded-2xl bg-surface/90 backdrop-blur-md border border-line shadow-lg max-w-xs text-center transition-all animate-fade-in">
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-line/40">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" />
              SAM 3D
            </span>
            <button
              type="button"
              onClick={() => setSpeechVisible(false)}
              className="text-[10px] text-ink-muted hover:text-ink cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-ink font-medium leading-relaxed mt-1">
            {message}
          </p>
        </div>
      )}
    </div>
  );
};
