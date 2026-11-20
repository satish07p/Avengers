// ═══════════════════════════════════════════════════════
// AVENGERS — THE MULTIVERSE EXPERIENCE
// Main Application — Three.js + GSAP + Web Audio
// ═══════════════════════════════════════════════════════

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// GSAP loaded globally via CDN script tag
const gsap = window.gsap;

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────
const CONFIG = {
  particles: {
    starCount: 2500,
    nebulaCount: 800,
    dustCount: 400,
    spread: 120,
    speed: 0.00015,
  },
  camera: {
    fov: 55,
    startZ: 60,
    heroZ: 38,
    transitionZ: 5,
  },
  bloom: {
    strength: 1.4,
    radius: 0.6,
    threshold: 0.15,
  },
  colors: {
    blue: 0x4fc3f7,
    purple: 0x7c4dff,
    gold: 0xffd740,
    red: 0xff1744,
    cyan: 0x00e5ff,
    white: 0xe8eaf6,
  },
};

// ─────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────
let scene, camera, renderer, composer;
let starSystem, nebulaSystem, dustSystem;
let godRays = [];
let lights = [];
let clock = new THREE.Clock();
let mouse = new THREE.Vector2(0, 0);
let targetMouse = new THREE.Vector2(0, 0);
let currentSection = 'hero';

// Audio
let audioCtx = null;
let audioEnabled = false;
let masterGain = null;
let ambientOsc = null;
let ambientGain = null;

// ═════════════════════════════════════════════
// SCENE SETUP
// ═════════════════════════════════════════════
function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000008, 0.008);

  camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.set(0, 0, CONFIG.camera.startZ);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  document.getElementById('canvas-container').appendChild(renderer.domElement);
}

// ═════════════════════════════════════════════
// PARTICLES — STARS
// ═════════════════════════════════════════════
function createStars() {
  const count = CONFIG.particles.starCount;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = CONFIG.particles.spread;
    positions[i * 3] = (Math.random() - 0.5) * r * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * r * 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * r * 2;
    sizes[i] = Math.random() * 2.5 + 0.5;
    opacities[i] = Math.random() * 0.8 + 0.2;
    speeds[i] = Math.random() * 0.5 + 0.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(CONFIG.colors.blue) },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMouse: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec2 uMouse;
      varying float vOpacity;
      varying float vDist;

      void main() {
        vec3 pos = position;

        // Gentle orbital motion
        float angle = uTime * 0.08 * aSpeed;
        float cosA = cos(angle);
        float sinA = sin(angle);
        pos.x = position.x * cosA - position.z * sinA;
        pos.z = position.x * sinA + position.z * cosA;

        // Gentle vertical bob
        pos.y += sin(uTime * 0.3 * aSpeed + position.x * 0.1) * 0.5;

        // Mouse repulsion
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vec4 projected = projectionMatrix * mvPos;
        vec2 screenPos = projected.xy / projected.w;
        float mouseDist = length(screenPos - uMouse);
        float repulsion = smoothstep(0.3, 0.0, mouseDist) * 3.0;
        pos += normalize(pos) * repulsion;

        mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPos.z);

        vOpacity = aOpacity;
        vDist = length(pos);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying float vDist;
      uniform vec3 uColor;
      uniform float uTime;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.05, d) * vOpacity;

        // Twinkle
        alpha *= 0.7 + 0.3 * sin(uTime * 2.0 + vDist * 0.5);

        // Distance fade
        alpha *= smoothstep(120.0, 20.0, vDist);

        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  starSystem = new THREE.Points(geometry, material);
  scene.add(starSystem);
}

// ═════════════════════════════════════════════
// PARTICLES — NEBULA (COLORED CLOUDS)
// ═════════════════════════════════════════════
function createNebula() {
  const count = CONFIG.particles.nebulaCount;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color(0x4fc3f7),
    new THREE.Color(0x7c4dff),
    new THREE.Color(0x1a237e),
    new THREE.Color(0x0d47a1),
    new THREE.Color(0x4a148c),
  ];

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 20 + Math.random() * 60;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.4;
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random() * 20 + 8;

    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;

      void main() {
        vColor = color;
        vec3 pos = position;
        float angle = uTime * 0.02;
        float c = cos(angle), s = sin(angle);
        pos.x = position.x * c - position.z * s;
        pos.z = position.x * s + position.z * c;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPos.z);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, d) * 0.08;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  nebulaSystem = new THREE.Points(geometry, material);
  scene.add(nebulaSystem);
}

// ═════════════════════════════════════════════
// PARTICLES — DUST / SMOKE
// ═════════════════════════════════════════════
function createDust() {
  const count = CONFIG.particles.dustCount;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    sizes[i] = Math.random() * 30 + 10;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float aSize;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 pos = position;
        pos.x += sin(uTime * 0.1 + position.y * 0.05) * 3.0;
        pos.y += cos(uTime * 0.08 + position.x * 0.03) * 2.0;
        pos.z += sin(uTime * 0.06) * 1.5;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;
        gl_PointSize = aSize * uPixelRatio * (150.0 / -mvPos.z);

        vAlpha = smoothstep(80.0, 10.0, length(pos));
      }
    `,
    fragmentShader: `
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.15, d) * 0.03 * vAlpha;
        gl_FragColor = vec4(0.6, 0.7, 1.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  dustSystem = new THREE.Points(geometry, material);
  scene.add(dustSystem);
}

// ═════════════════════════════════════════════
// GOD RAYS
// ═════════════════════════════════════════════
function createGodRays() {
  const rayCount = 6;

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const length = 40 + Math.random() * 30;

    const geometry = new THREE.ConeGeometry(0.3 + Math.random() * 0.4, length, 4, 1, true);
    geometry.translate(0, length / 2, 0);
    geometry.rotateX(Math.PI);

    const material = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.blue,
      transparent: true,
      opacity: 0.02 + Math.random() * 0.02,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const ray = new THREE.Mesh(geometry, material);
    ray.rotation.z = angle;
    ray.userData = { baseAngle: angle, speed: 0.05 + Math.random() * 0.08 };

    godRays.push(ray);
    scene.add(ray);
  }
}

// ═════════════════════════════════════════════
// LIGHTING
// ═════════════════════════════════════════════
function createLighting() {
  const ambient = new THREE.AmbientLight(0x0a0a20, 0.3);
  scene.add(ambient);

  const lightDefs = [
    { color: 0x4fc3f7, intensity: 2, pos: [15, 10, 20], orbit: 0.1 },
    { color: 0x7c4dff, intensity: 1.5, pos: [-15, -8, 15], orbit: -0.08 },
    { color: 0xffd740, intensity: 0.8, pos: [0, 15, -10], orbit: 0.06 },
    { color: 0x1a237e, intensity: 1, pos: [-20, 5, -15], orbit: -0.12 },
  ];

  for (const def of lightDefs) {
    const light = new THREE.PointLight(def.color, def.intensity, 80);
    light.position.set(...def.pos);
    light.userData = {
      basePos: new THREE.Vector3(...def.pos),
      orbitSpeed: def.orbit,
    };
    lights.push(light);
    scene.add(light);
  }
}

// ═════════════════════════════════════════════
// POST-PROCESSING
// ═════════════════════════════════════════════
function setupPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloom.strength,
    CONFIG.bloom.radius,
    CONFIG.bloom.threshold
  );
  composer.addPass(bloomPass);
}

// ═════════════════════════════════════════════
// AUDIO ENGINE (Web Audio API synthesis)
// ═════════════════════════════════════════════
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);
}

function playAmbientDrone() {
  if (!audioCtx) return;
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(masterGain);

  // Deep bass drone
  const bass = audioCtx.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = 55;
  const bassGain = audioCtx.createGain();
  bassGain.gain.value = 0.15;
  bass.connect(bassGain).connect(ambientGain);
  bass.start();

  // Mid atmosphere
  const mid = audioCtx.createOscillator();
  mid.type = 'sine';
  mid.frequency.value = 110;
  const midGain = audioCtx.createGain();
  midGain.gain.value = 0.06;
  mid.connect(midGain).connect(ambientGain);
  mid.start();

  // High shimmer
  const high = audioCtx.createOscillator();
  high.type = 'sine';
  high.frequency.value = 880;
  const highGain = audioCtx.createGain();
  highGain.gain.value = 0.01;
  const highFilter = audioCtx.createBiquadFilter();
  highFilter.type = 'lowpass';
  highFilter.frequency.value = 1200;
  high.connect(highFilter).connect(highGain).connect(ambientGain);
  high.start();

  // Slow LFO on bass
  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.1;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 10;
  lfo.connect(lfoGain).connect(bass.frequency);
  lfo.start();

  // Fade in
  ambientGain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 3);
}

function playCinematicHit() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Deep impact
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 1.5);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 2);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 2);

  // Noise burst
  const bufferSize = audioCtx.sampleRate * 0.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.1));
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.15, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  noise.connect(filter).connect(noiseGain).connect(masterGain);
  noise.start(now);
}

function playTransitionSound() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Rising sweep
  const sweep = audioCtx.createOscillator();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(100, now);
  sweep.frequency.exponentialRampToValueAtTime(2000, now + 0.8);

  const sweepGain = audioCtx.createGain();
  sweepGain.gain.setValueAtTime(0.1, now);
  sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 1);

  const sweepFilter = audioCtx.createBiquadFilter();
  sweepFilter.type = 'bandpass';
  sweepFilter.frequency.value = 500;
  sweepFilter.Q.value = 2;

  sweep.connect(sweepFilter).connect(sweepGain).connect(masterGain);
  sweep.start(now);
  sweep.stop(now + 1);

  // Impact after sweep
  setTimeout(() => playCinematicHit(), 400);
}

function playUIClick() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.1);
}

// ═════════════════════════════════════════════
// INTRO ANIMATION SEQUENCE
// ═════════════════════════════════════════════
function playIntroSequence() {
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    delay: 0.3,
  });

  // Hide loader
  tl.to('#loader', {
    opacity: 0,
    duration: 0.8,
    onComplete: () => {
      document.getElementById('loader').classList.add('hidden');
    },
  });

  // Camera dolly in
  tl.to(camera.position, {
    z: CONFIG.camera.heroZ,
    duration: 6,
    ease: 'power2.inOut',
  }, 0.5);

  // Logo fade in & scale
  tl.to('.logo-wrapper', {
    opacity: 1,
    scale: 1,
    duration: 2,
    ease: 'power2.out',
    onStart: () => {
      // Draw the circle
      setTimeout(() => {
        document.querySelector('.logo-circle')?.classList.add('drawn');
      }, 300);
      // Show the A
      setTimeout(() => {
        document.querySelector('.logo-a')?.classList.add('visible');
        document.querySelector('.logo-cutout')?.classList.add('visible');
        if (audioEnabled) playCinematicHit();
      }, 1200);
    },
  }, 1.0);

  // Title
  tl.to('.hero-title', {
    opacity: 1,
    y: 0,
    duration: 1.5,
  }, 2.5);

  // Subtitle
  tl.to('.hero-subtitle', {
    opacity: 1,
    y: 0,
    duration: 1.2,
  }, 3.2);

  // CTA button
  tl.to('.cta-wrapper', {
    opacity: 1,
    y: 0,
    duration: 1,
  }, 3.8);

  // Audio button
  tl.to('.audio-toggle', {
    opacity: 1,
    duration: 0.8,
  }, 4.0);
}

// ═════════════════════════════════════════════
// IRON MAN TRANSITION
// ═════════════════════════════════════════════
function transitionToIronMan() {
  if (currentSection !== 'hero') return;
  currentSection = 'transitioning';

  if (audioEnabled) playTransitionSound();

  const tl = gsap.timeline({
    defaults: { ease: 'power3.inOut' },
  });

  // Camera rush forward
  tl.to(camera.position, {
    z: CONFIG.camera.transitionZ,
    duration: 1.2,
    ease: 'power4.in',
  });

  // Flash
  tl.to('#transitionFlash', {
    opacity: 1,
    duration: 0.15,
  }, 0.8);

  // Hide hero
  tl.to('#hero', {
    opacity: 0,
    duration: 0.3,
  }, 0.7);

  // Flash out
  tl.to('#transitionFlash', {
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out',
  }, 1.0);

  // Change scene colors
  tl.call(() => {
    changeSceneToIronMan();
  }, null, 1.0);

  // Show Iron Man section
  tl.call(() => {
    document.getElementById('ironman').classList.add('active');
    currentSection = 'ironman';
  }, null, 1.1);

  // Camera pull back to new position
  tl.to(camera.position, {
    z: CONFIG.camera.heroZ + 5,
    duration: 1.5,
    ease: 'power2.out',
  }, 1.2);

  // Animate HUD elements
  tl.to('.hud-corner', {
    opacity: 0.6,
    duration: 0.3,
    stagger: 0.08,
  }, 1.4);

  tl.to('.hud-line', {
    opacity: 0.15,
    duration: 0.4,
  }, 1.5);

  tl.to('.im-header', {
    opacity: 1,
    duration: 0.8,
  }, 1.6);

  // Arc reactor power up
  tl.to('.arc-reactor', {
    opacity: 1,
    duration: 1,
    ease: 'power2.out',
  }, 1.8);

  // Panels slide in
  tl.to('.panel-left', {
    opacity: 1,
    x: 0,
    duration: 0.8,
  }, 2.0);

  tl.to('.panel-right', {
    opacity: 1,
    x: 0,
    duration: 0.8,
  }, 2.2);

  tl.to('.panel-bottom', {
    opacity: 1,
    y: 0,
    duration: 0.8,
  }, 2.4);

  // Animate stat bars
  tl.call(() => animateStatBars(), null, 2.6);

  // Suit label
  tl.to('.suit-label', {
    opacity: 1,
    duration: 0.8,
  }, 2.8);

  // JARVIS message
  tl.call(() => typeJarvisMessage(), null, 3.0);
}

function changeSceneToIronMan() {
  // Shift particle colors to red/gold
  if (starSystem) {
    gsap.to(starSystem.material.uniforms.uColor.value, {
      r: 1.0,
      g: 0.2,
      b: 0.15,
      duration: 2,
    });
  }

  // Shift lights
  if (lights[0]) {
    gsap.to(lights[0].color, { r: 1, g: 0.09, b: 0.27, duration: 2 });
  }
  if (lights[1]) {
    gsap.to(lights[1].color, { r: 1, g: 0.84, b: 0.25, duration: 2 });
  }
  if (lights[2]) {
    gsap.to(lights[2].color, { r: 1, g: 0.4, b: 0.2, duration: 2 });
  }

  // God rays to red
  godRays.forEach((ray) => {
    gsap.to(ray.material.color, { r: 1, g: 0.1, b: 0.1, duration: 2 });
  });

  // Increase bloom
  if (composer && composer.passes[1]) {
    gsap.to(composer.passes[1], { strength: 1.8, duration: 2 });
  }
}

function animateStatBars() {
  document.querySelectorAll('.stat-fill').forEach((bar) => {
    const value = bar.dataset.value;
    const color = bar.dataset.color;
    bar.style.background = color;
    bar.style.boxShadow = `0 0 8px ${color}`;
    gsap.to(bar, {
      width: `${value}%`,
      duration: 1.5,
      ease: 'power2.out',
      delay: Math.random() * 0.3,
    });
  });
}

function typeJarvisMessage() {
  const msg = 'Good evening, sir. All systems operational. The Avengers Initiative is active.';
  const el = document.getElementById('jarvisMsg');
  if (!el) return;

  gsap.to(el, { opacity: 1, duration: 0.3 });

  let idx = 0;
  const interval = setInterval(() => {
    el.textContent = msg.substring(0, idx + 1);
    idx++;
    if (idx >= msg.length) clearInterval(interval);
  }, 35);
}

// ═════════════════════════════════════════════
// EVENT LISTENERS
// ═════════════════════════════════════════════
function setupEventListeners() {
  // Window resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);

    if (starSystem) starSystem.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (nebulaSystem) nebulaSystem.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    if (dustSystem) dustSystem.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  // Mouse tracking
  window.addEventListener('mousemove', (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Update CTA ripple position
    const btn = document.querySelector('.cta-button');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--mx', `${mx}%`);
      btn.style.setProperty('--my', `${my}%`);
    }
  });

  // Enter button
  document.getElementById('enterBtn')?.addEventListener('click', () => {
    if (audioEnabled) playUIClick();
    transitionToIronMan();
  });

  // Audio toggle
  const audioToggle = document.getElementById('audioToggle');
  audioToggle?.addEventListener('click', () => {
    if (!audioCtx) {
      initAudio();
      audioEnabled = true;
      playAmbientDrone();
      audioToggle.classList.remove('muted');
    } else {
      audioEnabled = !audioEnabled;
      if (audioEnabled) {
        audioCtx.resume();
        masterGain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.3);
        audioToggle.classList.remove('muted');
      } else {
        masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        audioToggle.classList.add('muted');
      }
    }
  });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      if (currentSection === 'hero') {
        e.preventDefault();
        transitionToIronMan();
      }
    }
    if (e.code === 'KeyM') {
      audioToggle?.click();
    }
  });
}

// ═════════════════════════════════════════════
// RENDER LOOP
// ═════════════════════════════════════════════
function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();

  // Smooth mouse
  mouse.lerp(targetMouse, 0.05);

  // Update particle uniforms
  if (starSystem) {
    starSystem.material.uniforms.uTime.value = elapsed;
    starSystem.material.uniforms.uMouse.value.copy(mouse);
  }
  if (nebulaSystem) {
    nebulaSystem.material.uniforms.uTime.value = elapsed;
  }
  if (dustSystem) {
    dustSystem.material.uniforms.uTime.value = elapsed;
  }

  // Animate god rays
  godRays.forEach((ray) => {
    ray.rotation.z = ray.userData.baseAngle + elapsed * ray.userData.speed;
    ray.material.opacity = 0.015 + Math.sin(elapsed * 0.5 + ray.userData.baseAngle) * 0.01;
  });

  // Animate lights
  lights.forEach((light) => {
    const { basePos, orbitSpeed } = light.userData;
    const angle = elapsed * orbitSpeed;
    light.position.x = basePos.x * Math.cos(angle) - basePos.z * Math.sin(angle);
    light.position.z = basePos.x * Math.sin(angle) + basePos.z * Math.cos(angle);
    light.position.y = basePos.y + Math.sin(elapsed * 0.3) * 2;
  });

  // Subtle camera sway
  if (currentSection !== 'transitioning') {
    camera.position.x += (mouse.x * 2 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 1.5 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  }

  // Render with post-processing
  composer.render();
}

// ═════════════════════════════════════════════
// INITIALIZE
// ═════════════════════════════════════════════
function init() {
  initScene();
  createStars();
  createNebula();
  createDust();
  createGodRays();
  createLighting();
  setupPostProcessing();
  setupEventListeners();
  animate();

  // Start intro after a small delay (simulating load)
  gsap.delayedCall(2.2, playIntroSequence);
}

// Start everything
init();
