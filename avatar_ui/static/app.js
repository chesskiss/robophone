import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const canvas = document.getElementById("avatar-canvas");
const teacherText = document.getElementById("teacher-text");
const childText = document.getElementById("child-text");
const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");
const emotionTag = document.getElementById("emotion-tag");

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe7e1, 9, 28);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 1.2, 11);

const root = new THREE.Group();
scene.add(root);

const palette = {
  neutral: { accent: 0x2e8f78, mood: 0xf4fbf7 },
  happy: { accent: 0xe0a12f, mood: 0xfff7db },
  sad: { accent: 0x4e73a5, mood: 0xe9f0fb },
  angry: { accent: 0xbc4e3f, mood: 0xffece7 },
  disgust: { accent: 0x6f8e4e, mood: 0xf0f9e8 },
  fear: { accent: 0x7f69a8, mood: 0xf1ecff },
  surprise: { accent: 0xd68052, mood: 0xfff0e6 },
  confused: { accent: 0x627884, mood: 0xedf3f6 },
  idle: { accent: 0x2e8f78, mood: 0xf4fbf7 },
};

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9e5df, roughness: 0.54, metalness: 0.14 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0xf8fff9, roughness: 0.5, metalness: 0.05 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x13221b, roughness: 0.42 });
const accentMat = new THREE.MeshStandardMaterial({ color: palette.idle.accent, roughness: 0.36, metalness: 0.08 });
const glowMat = new THREE.MeshStandardMaterial({ color: palette.idle.mood, roughness: 0.2, emissive: palette.idle.accent, emissiveIntensity: 0.15 });

const torso = mesh(new THREE.CapsuleGeometry(1.05, 1.25, 8, 20), bodyMat, [0, -1.28, 0]);
torso.scale.set(1.12, 1, 0.58);
torso.castShadow = true;
root.add(torso);

const neck = mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.42, 24), accentMat, [0, -0.25, 0]);
root.add(neck);

const head = mesh(new THREE.BoxGeometry(2.65, 1.95, 1.35, 6, 6, 4), faceMat, [0, 0.86, 0]);
head.castShadow = true;
root.add(head);

const visor = mesh(new THREE.BoxGeometry(2.05, 0.72, 0.08), glowMat, [0, 0.98, 0.71]);
root.add(visor);

const leftEye = mesh(new THREE.SphereGeometry(0.15, 24, 16), darkMat, [-0.48, 1.05, 0.79]);
const rightEye = mesh(new THREE.SphereGeometry(0.15, 24, 16), darkMat, [0.48, 1.05, 0.79]);
root.add(leftEye, rightEye);

const leftBrow = mesh(new THREE.BoxGeometry(0.46, 0.055, 0.055), darkMat, [-0.48, 1.34, 0.8]);
const rightBrow = mesh(new THREE.BoxGeometry(0.46, 0.055, 0.055), darkMat, [0.48, 1.34, 0.8]);
root.add(leftBrow, rightBrow);

const mouth = mesh(new THREE.BoxGeometry(0.78, 0.085, 0.07), darkMat, [0, 0.62, 0.8]);
root.add(mouth);

const antennaStem = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 12), accentMat, [0, 2.08, 0]);
const antennaBall = mesh(new THREE.SphereGeometry(0.14, 24, 16), accentMat, [0, 2.42, 0]);
root.add(antennaStem, antennaBall);

const leftArm = mesh(new THREE.CapsuleGeometry(0.18, 1.2, 8, 14), bodyMat, [-1.35, -1.22, 0]);
const rightArm = mesh(new THREE.CapsuleGeometry(0.18, 1.2, 8, 14), bodyMat, [1.35, -1.22, 0]);
leftArm.rotation.z = 0.22;
rightArm.rotation.z = -0.22;
root.add(leftArm, rightArm);

const floor = mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: 0xcbd8d0, roughness: 0.82 }), [0, -2.32, 0]);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(3, 5, 6);
keyLight.castShadow = true;
scene.add(keyLight);
scene.add(new THREE.HemisphereLight(0xf5fff8, 0x627068, 1.4));

let currentEmotion = "idle";
let lastTeacherText = "";
let speakingUntil = 0;
let gestureUntil = 0;
let targetAccent = new THREE.Color(palette.idle.accent);
let targetMood = new THREE.Color(palette.idle.mood);

function mesh(geometry, material, position) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  return item;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

async function pollSession() {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    const state = await response.json();
    applySessionState(state);
  } catch (error) {
    setStatus("Avatar UI cannot reach local session API", true);
  } finally {
    setTimeout(pollSession, 420);
  }
}

function applySessionState(state) {
  if (state.status === "error") {
    setStatus(state.error || "ER session error", true);
  } else if (state.status === "waiting") {
    setStatus("Waiting for ER session", false);
  } else {
    setStatus(state.conversation_active ? "Conversation active" : "ER session connected", false);
  }

  const emotion = state.emotion || "idle";
  if (emotion !== currentEmotion) {
    currentEmotion = emotion;
    setEmotion(emotion);
  }

  const teacher = state.teacher_message?.text || "";
  if (teacher && teacher !== lastTeacherText) {
    lastTeacherText = teacher;
    teacherText.textContent = teacher;
    speakingUntil = performance.now() + Math.min(5200, Math.max(1800, teacher.length * 38));
    gestureUntil = performance.now() + 900;
  }

  childText.textContent = state.child_message?.text || "";
}

function setStatus(text, isError) {
  statusText.textContent = text;
  statusDot.style.background = isError ? "#bc4e3f" : cssColor(targetAccent);
  statusDot.style.boxShadow = `0 0 0 6px ${isError ? "rgba(188, 78, 63, 0.16)" : "rgba(46, 143, 120, 0.18)"}`;
}

function setEmotion(emotion) {
  const colors = palette[emotion] || palette.neutral;
  targetAccent = new THREE.Color(colors.accent);
  targetMood = new THREE.Color(colors.mood);
  emotionTag.textContent = emotion;
  document.documentElement.style.setProperty("--accent", cssColor(targetAccent));
  document.documentElement.style.setProperty("--accent-soft", `${cssColor(targetAccent)}2b`);
}

function cssColor(color) {
  return `#${color.getHexString()}`;
}

function expressionTargets(emotion) {
  const base = {
    browLeft: 0,
    browRight: 0,
    browTiltLeft: 0,
    browTiltRight: 0,
    eyeY: 1,
    eyeScaleY: 1,
    mouthY: 1,
    mouthScaleX: 1,
    posture: 0,
  };
  const table = {
    happy: { browLeft: 0.08, browRight: 0.08, browTiltLeft: 0.12, browTiltRight: -0.12, eyeScaleY: 0.78, mouthY: 0.16, mouthScaleX: 1.22, posture: 0.12 },
    sad: { browLeft: -0.08, browRight: -0.08, browTiltLeft: -0.22, browTiltRight: 0.22, eyeY: -0.04, mouthY: -0.12, mouthScaleX: 0.84, posture: -0.18 },
    angry: { browLeft: -0.03, browRight: -0.03, browTiltLeft: 0.34, browTiltRight: -0.34, eyeScaleY: 0.72, mouthY: -0.08, mouthScaleX: 0.82, posture: 0.03 },
    disgust: { browLeft: -0.02, browRight: 0.05, browTiltLeft: -0.18, browTiltRight: -0.08, mouthY: -0.05, mouthScaleX: 0.72, posture: -0.08 },
    fear: { browLeft: 0.13, browRight: 0.13, eyeY: 0.03, eyeScaleY: 1.28, mouthY: -0.02, mouthScaleX: 0.7, posture: -0.12 },
    surprise: { browLeft: 0.16, browRight: 0.16, eyeY: 0.05, eyeScaleY: 1.34, mouthY: 0.02, mouthScaleX: 0.55, posture: 0.08 },
    confused: { browLeft: -0.03, browRight: 0.12, browTiltLeft: -0.2, browTiltRight: -0.18, mouthY: -0.02, mouthScaleX: 0.78, posture: -0.04 },
    neutral: {},
    idle: {},
  };
  return { ...base, ...(table[emotion] || {}) };
}

function animate(now) {
  requestAnimationFrame(animate);
  const seconds = now / 1000;
  const targets = expressionTargets(currentEmotion);
  const isSpeaking = now < speakingUntil;
  const isGesturing = now < gestureUntil;

  accentMat.color.lerp(targetAccent, 0.08);
  accentMat.emissive?.lerp(targetAccent, 0.08);
  glowMat.color.lerp(targetMood, 0.08);
  glowMat.emissive.lerp(targetAccent, 0.08);

  root.position.y = Math.sin(seconds * 1.5) * 0.035 + targets.posture;
  root.rotation.y = Math.sin(seconds * 0.55) * 0.08 + (isGesturing ? Math.sin(seconds * 8) * 0.06 : 0);
  head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, targets.posture * 0.08, 0.08);

  leftBrow.position.y = THREE.MathUtils.lerp(leftBrow.position.y, 1.34 + targets.browLeft, 0.12);
  rightBrow.position.y = THREE.MathUtils.lerp(rightBrow.position.y, 1.34 + targets.browRight, 0.12);
  leftBrow.rotation.z = THREE.MathUtils.lerp(leftBrow.rotation.z, targets.browTiltLeft, 0.12);
  rightBrow.rotation.z = THREE.MathUtils.lerp(rightBrow.rotation.z, targets.browTiltRight, 0.12);
  leftEye.position.y = THREE.MathUtils.lerp(leftEye.position.y, 1.05 + targets.eyeY * 0.02, 0.12);
  rightEye.position.y = THREE.MathUtils.lerp(rightEye.position.y, 1.05 + targets.eyeY * 0.02, 0.12);
  leftEye.scale.y = THREE.MathUtils.lerp(leftEye.scale.y, targets.eyeScaleY, 0.12);
  rightEye.scale.y = THREE.MathUtils.lerp(rightEye.scale.y, targets.eyeScaleY, 0.12);

  const mouthOpen = isSpeaking ? 0.22 + Math.abs(Math.sin(seconds * 17)) * 0.52 : 0.08;
  mouth.position.y = THREE.MathUtils.lerp(mouth.position.y, 0.62 + targets.mouthY * 0.2, 0.16);
  mouth.scale.x = THREE.MathUtils.lerp(mouth.scale.x, targets.mouthScaleX, 0.12);
  mouth.scale.y = THREE.MathUtils.lerp(mouth.scale.y, mouthOpen, 0.22);

  leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0.22 + (isGesturing ? 0.22 : 0), 0.09);
  rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, -0.22 - (isGesturing ? 0.28 : 0), 0.09);
  antennaBall.position.y = 2.42 + Math.sin(seconds * 2.4) * 0.035;

  renderer.render(scene, camera);
}

pollSession();
requestAnimationFrame(animate);

