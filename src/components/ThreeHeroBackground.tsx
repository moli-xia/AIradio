import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type ThreeHeroBackgroundProps = {
  imageSrc: string;
  progress: number;
};

function supportsDynamicScene() {
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  const likelyLowSpec = cores <= 2 || (cores <= 4 && memory <= 4);

  if (prefersReducedMotion || likelyLowSpec) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function getPhaseColor(progress: number) {
  const phase = Math.max(0, Math.min(1, progress / 100));
  const stops = [
    new THREE.Color("#39428c"),
    new THREE.Color("#f3b7d6"),
    new THREE.Color("#b8d9ff"),
    new THREE.Color("#7552d8"),
  ];
  const scaled = phase * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  return stops[index].clone().lerp(stops[index + 1], scaled - index);
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(80, 80, 0, 80, 80, 80);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.34, "rgba(255,255,255,0.42)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function ThreeHeroBackground({ imageSrc, progress }: ThreeHeroBackgroundProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(progress);
  const [dynamic, setDynamic] = useState(false);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    setDynamic(supportsDynamicScene());
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !dynamic) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0xffffff, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    mount.appendChild(renderer.domElement);

    const texture = new THREE.TextureLoader().load(imageSrc);
    texture.colorSpace = THREE.SRGBColorSpace;
    const background = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.82 }),
    );
    background.position.z = -0.2;
    scene.add(background);

    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        color: getPhaseColor(progressRef.current),
        transparent: true,
        opacity: 0.22,
      }),
    );
    tint.position.z = -0.1;
    scene.add(tint);

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 48),
      new THREE.MeshBasicMaterial({ color: "#fff2b8", transparent: true, opacity: 0.88 }),
    );
    sun.position.z = 0.08;
    scene.add(sun);

    const glowTexture = createGlowTexture();
    const glowSprites = [
      { color: "#8b5cf6", opacity: 0.62, scale: [0.72, 0.5], speed: 0.34, x: 0.18, y: 0.08 },
      { color: "#5dd8ff", opacity: 0.5, scale: [0.58, 0.42], speed: 0.46, x: 0.6, y: -0.12 },
      { color: "#ffb4cf", opacity: 0.42, scale: [0.9, 0.5], speed: 0.26, x: -0.08, y: 0.34 },
    ].map((item) => {
      const material = new THREE.SpriteMaterial({
        map: glowTexture,
        color: item.color,
        transparent: true,
        opacity: item.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(item.x, item.y, 0.04);
      sprite.scale.set(item.scale[0], item.scale[1], 1);
      scene.add(sprite);
      return { ...item, material, sprite };
    });

    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 220;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = Math.random() * 2 - 1;
      positions[i * 3 + 1] = Math.random() * 1.4 - 0.1;
      positions[i * 3 + 2] = Math.random() * 0.5;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({
        color: "#ffffff",
        size: 0.018,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(particles);

    const streaks: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let i = 0; i < 10; i += 1) {
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42 + (i % 3) * 0.12, 0.007),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? "#d8f8ff" : "#ffffff",
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      streak.position.set(-1.2 + i * 0.26, -0.38 + ((i * 17) % 62) / 100, 0.1);
      streak.rotation.z = -0.08;
      streaks.push(streak);
      scene.add(streak);
    }

    const waveGroup = new THREE.Group();
    const waveBars: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
    for (let i = 0; i < 43; i += 1) {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(0.01, 0.15),
        new THREE.MeshBasicMaterial({
          color: "#ffffff",
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      bar.position.x = -0.54 + i * 0.026;
      bar.position.y = 0.25;
      bar.position.z = 0.12;
      waveBars.push(bar);
      waveGroup.add(bar);
    }
    scene.add(waveGroup);

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
      background.scale.set(aspect > 1 ? aspect : 1, 1, 1);
      tint.scale.copy(background.scale);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const phase = Math.max(0, Math.min(1, progressRef.current / 100));
      const date = new Date();
      const clockPhase = ((date.getHours() * 60 + date.getMinutes()) / 1440 + elapsed * 0.006) % 1;
      const color = getPhaseColor((phase * 0.72 + clockPhase * 0.28) * 100);

      (tint.material as THREE.MeshBasicMaterial).color.copy(color);
      (tint.material as THREE.MeshBasicMaterial).opacity =
        0.2 + Math.sin(phase * Math.PI) * 0.08 + Math.sin(elapsed * 0.7) * 0.03;

      sun.position.x = -0.58 + phase * 1.15;
      sun.position.y = -0.26 + Math.sin(phase * Math.PI) * 0.42;
      sun.scale.setScalar(1.1 + Math.sin(elapsed * 1.7) * 0.13);

      glowSprites.forEach((item, index) => {
        const drift = elapsed * item.speed + index * 1.8 + clockPhase * Math.PI * 2;
        item.sprite.position.x = item.x + Math.sin(drift) * 0.18;
        item.sprite.position.y = item.y + Math.cos(drift * 0.74) * 0.12;
        item.sprite.scale.set(item.scale[0] * (1 + Math.sin(drift * 1.6) * 0.1), item.scale[1], 1);
        item.material.opacity = item.opacity + Math.sin(drift * 1.2) * 0.08;
      });

      particles.rotation.z = elapsed * 0.026;
      particles.position.y = Math.sin(elapsed * 0.24) * 0.045;

      streaks.forEach((streak, index) => {
        streak.position.x = ((elapsed * (0.11 + index * 0.005) + index * 0.29) % 2.7) - 1.25;
        streak.position.y += Math.sin(elapsed * 0.8 + index) * 0.0007;
        streak.material.opacity = 0.12 + Math.abs(Math.sin(elapsed * 0.9 + index * 0.6)) * 0.26;
      });

      waveBars.forEach((bar, index) => {
        const height = 0.48 + Math.sin(elapsed * 3.2 + index * 0.62 + phase * 4) * 0.82;
        bar.scale.y = Math.max(0.18, height);
        bar.material.opacity = 0.48 + Math.abs(Math.sin(elapsed * 1.4 + index)) * 0.42;
      });

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      texture.dispose();
      glowTexture.dispose();
      particlesGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      glowSprites.forEach((item) => item.material.dispose());
      streaks.forEach((streak) => {
        streak.geometry.dispose();
        streak.material.dispose();
      });
      waveBars.forEach((bar) => {
        bar.geometry.dispose();
        bar.material.dispose();
      });
      background.geometry.dispose();
      (background.material as THREE.Material).dispose();
      tint.geometry.dispose();
      (tint.material as THREE.Material).dispose();
      sun.geometry.dispose();
      (sun.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [dynamic, imageSrc]);

  if (!dynamic) {
    return <img alt="" className="hero-art" src={imageSrc} />;
  }

  return (
    <div className="hero-three-shell" data-three-hero="active">
      <img alt="" className="hero-art hero-art--static-underlay" src={imageSrc} />
      <div ref={mountRef} className="hero-three-canvas" />
    </div>
  );
}
