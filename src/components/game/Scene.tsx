
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, INITIAL_GAME_STATE, ZOMBIE_CLASSES, ZombieType } from '@/lib/game-types';
import HUD from './HUD';
import GameOver from './GameOver';

// Constants
const SEGMENT_LENGTH = 40;
const CORRIDOR_WIDTH = 12;
const CORRIDOR_HEIGHT = 13.5; // Increased 1.5x from 9

interface ZombieInstance {
  mesh: THREE.Group;
  hp: number;
  speed: number;
  type: ZombieType;
  scoreValue: number;
  isDead: boolean;
  lastAttackTime: number;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  originalMaterials: Map<THREE.Mesh, THREE.Material>;
}

interface ParticleInstance {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface SegmentInstance {
  mesh: THREE.Group;
  startZ: number;
  endZ: number;
}

export default function GameScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement>(null);
  const gunshotPoolRef = useRef<HTMLAudioElement[]>([]);
  const zombieSoundPoolRef = useRef<HTMLAudioElement[]>([]);
  const isGameOverTriggered = useRef(false);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [distToWall, setDistToWall] = useState(20);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  
  const engineRef = useRef({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(75, 1, 0.1, 1000),
    renderer: null as THREE.WebGLRenderer | null,
    clock: new THREE.Clock(),
    keysPressed: {} as Record<string, boolean>,
    zombies: [] as ZombieInstance[],
    particles: [] as ParticleInstance[],
    segments: [] as SegmentInstance[],
    player: new THREE.Group(),
    weaponGroup: new THREE.Group(),
    muzzleFlash: new THREE.PointLight(0xffaa00, 0, 8),
    muzzleFlashMesh: null as THREE.Mesh | null,
    bobTimer: 0,
    raycaster: new THREE.Raycaster(),
    // Collapse Wall components
    wallGroup: new THREE.Group(),
    wallGrid: new THREE.Group(),
    wallLight: new THREE.SpotLight(0xff003c, 8.0, 60),
    ambientLight: new THREE.AmbientLight(0xffffff, 0.45),
  });

  const stateRef = useRef<GameState>(INITIAL_GAME_STATE);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Pre-allocate audio pools
  useEffect(() => {
    const gunshotUrl = "https://www.myinstants.com/media/sounds/gsht-44263.mp3";
    const gPool: HTMLAudioElement[] = [];
    for (let i = 0; i < 15; i++) {
      const audio = new Audio(gunshotUrl);
      audio.load();
      gPool.push(audio);
    }
    gunshotPoolRef.current = gPool;

    const zombieSoundUrl = "https://www.myinstants.com/media/sounds/old-minecraft-zombie-sound.mp3";
    const zPool: HTMLAudioElement[] = [];
    for (let i = 0; i < 10; i++) {
      const audio = new Audio(zombieSoundUrl);
      audio.load();
      zPool.push(audio);
    }
    zombieSoundPoolRef.current = zPool;
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (bgMusicRef.current) {
      bgMusicRef.current.muted = nextMuted;
    }
    gunshotPoolRef.current.forEach(a => a.muted = nextMuted);
    zombieSoundPoolRef.current.forEach(a => a.muted = nextMuted);
  }, []);

  const playGunshotSound = () => {
    if (isMutedRef.current) return;
    const sound = gunshotPoolRef.current.find(a => a.paused || a.ended);
    if (sound) {
      sound.volume = 0.8;
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  };

  const playZombieSound = () => {
    if (isMutedRef.current) return;
    const sound = zombieSoundPoolRef.current.find(a => a.paused || a.ended);
    if (sound) {
      sound.currentTime = 0;
      sound.volume = 0.5;
      sound.play().catch(() => {});
    }
  };

  const triggerDamageFlash = () => {
    if (flashRef.current) {
      flashRef.current.style.backgroundColor = 'rgba(255, 0, 60, 0.4)';
      setTimeout(() => {
        if (flashRef.current) flashRef.current.style.backgroundColor = 'rgba(255, 0, 60, 0)';
      }, 100);
    }
  };

  const createWeaponModel = (type: 'Standard' | 'AK47') => {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.1 });
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1.0, roughness: 0.2 });
    const emissionMat = new THREE.MeshStandardMaterial({ color: 0xff003c, emissive: 0xff003c, emissiveIntensity: 3.0 });

    if (type === 'Standard') {
      const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.7), metalMat);
      const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), detailMat);
      barrel1.rotation.x = Math.PI / 2;
      barrel1.position.set(0.05, 0.06, 0.45);
      const barrel2 = barrel1.clone();
      barrel2.position.x = -0.05;
      const glowRail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.65), emissionMat);
      glowRail.position.set(0, 0.12, 0.1);
      group.add(gunBody, barrel1, barrel2, glowRail);
    } else {
      // AK-47 Design
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.9), metalMat);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.2), detailMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.08, 0.75);
      const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.25), metalMat);
      magazine.position.set(0, -0.3, 0.2);
      magazine.rotation.x = -0.2;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 }));
      stock.position.set(0, -0.05, -0.6);
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.0), emissionMat);
      rail1.position.set(0.1, 0.12, 0.3);
      const rail2 = rail1.clone();
      rail2.position.x = -0.1;
      group.add(receiver, barrel, magazine, stock, rail1, rail2);
    }

    group.position.set(0.45, -0.35, -0.8);
    group.scale.setScalar(1.2);
    group.castShadow = true;
    return group;
  };

  const spawnZombie = () => {
    const { scene, player, zombies } = engineRef.current;
    const current = stateRef.current;
    const stage = current.progression.currentStage;

    let type: ZombieType;
    const rand = Math.random();

    if (stage === 1) {
      type = 'Walker';
    } else if (stage === 2) {
      if (rand < 0.7) type = 'Walker';
      else if (rand < 0.9) type = 'Runner';
      else type = 'Tank';
    } else if (stage === 3) {
      if (rand < 0.4) type = 'Walker';
      else if (rand < 0.8) type = 'Runner';
      else if (rand < 0.95) type = 'Tank';
      else type = 'Elite';
    } else {
      if (rand < 0.1) type = 'Walker';
      else if (rand < 0.5) type = 'Runner';
      else if (rand < 0.8) type = 'Tank';
      else type = 'Elite';
    }

    const stats = ZOMBIE_CLASSES[type];
    const multiplier = current.progression.globalDifficultyMultiplier;

    const speed = stats.baseSpeed * multiplier;
    const hp = Math.round(stats.baseHp * multiplier);
    const scoreValue = Math.round(stats.scoreValue * multiplier);

    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x6a6c6e, roughness: 1.0, metalness: 0 }); 
    const clothingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 }); 
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const goreMat = new THREE.MeshStandardMaterial({ color: 0x440000, roughness: 0.8 }); 

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skinMat);
    head.position.y = 1.45;
    head.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(head);

    const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
    lEye.position.set(-0.12, 1.55, 0.22);
    group.add(lEye);
    const rEye = lEye.clone();
    rEye.position.x = 0.12;
    group.add(rEye);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.04), mouthMat);
    mouth.position.set(0, 1.25, 0.22);
    group.add(mouth);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), clothingMat);
    torso.position.y = 0.9;
    group.add(torso);

    const wound = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.05), goreMat);
    wound.position.set(0, 0.9, 0.16);
    group.add(wound);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), skinMat);
    leftArm.position.set(-0.35, 1.15, 0.4);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), skinMat);
    rightArm.position.set(0.35, 1.1, 0.55);
    group.add(rightArm);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), clothingMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    group.add(leftLeg);
    
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    group.add(rightLeg);

    group.scale.setScalar(stats.scale);
    group.position.set(
      (Math.random() - 0.5) * (CORRIDOR_WIDTH - 4.0),
      0,
      player.position.z + 50 + Math.random() * 50
    );

    const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
    group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        originalMaterials.set(obj, obj.material);
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    const instance: ZombieInstance = {
      mesh: group,
      hp,
      speed,
      type,
      scoreValue,
      isDead: false,
      lastAttackTime: 0,
      leftArm,
      rightArm,
      originalMaterials
    };

    scene.add(group);
    zombies.push(instance);
    playZombieSound();
  };

  const createSegment = (z: number) => {
    const group = new THREE.Group();
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111215, metalness: 0.8, roughness: 0.8 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.2, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222429, metalness: 0.5, roughness: 0.7 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x0f1012, metalness: 0.8, roughness: 0.6 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xff003c, emissive: 0xff002b, emissiveIntensity: 2.5 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_WIDTH, 0.2, SEGMENT_LENGTH), floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    group.add(floor);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_WIDTH, 0.2, SEGMENT_LENGTH), ceilingMat);
    ceiling.position.y = CORRIDOR_HEIGHT;
    ceiling.receiveShadow = true;
    group.add(ceiling);

    const lWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, CORRIDOR_HEIGHT, SEGMENT_LENGTH), wallMat);
    lWall.position.x = -CORRIDOR_WIDTH / 2 - 0.1;
    lWall.position.y = CORRIDOR_HEIGHT / 2;
    lWall.receiveShadow = true;
    group.add(lWall);

    const rWall = lWall.clone();
    rWall.position.x = CORRIDOR_WIDTH / 2 + 0.1;
    rWall.position.y = CORRIDOR_HEIGHT / 2;
    rWall.receiveShadow = true;
    group.add(rWall);

    for (let i = -SEGMENT_LENGTH / 2 + 4; i < SEGMENT_LENGTH / 2; i += 8) {
      const lPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, CORRIDOR_HEIGHT, 0.8), beamMat);
      lPillar.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, i);
      lPillar.receiveShadow = true;
      group.add(lPillar);

      const rPillar = lPillar.clone();
      rPillar.position.x = CORRIDOR_WIDTH / 2;
      rPillar.receiveShadow = true;
      group.add(rPillar);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_WIDTH - 0.6, 0.4, 0.8), beamMat);
      beam.position.set(0, CORRIDOR_HEIGHT - 0.2, i);
      beam.receiveShadow = true;
      group.add(beam);
    }

    const railPositions = [
      { x: -CORRIDOR_WIDTH / 2, y: 0.1 },
      { x: CORRIDOR_WIDTH / 2, y: 0.1 },
      { x: -CORRIDOR_WIDTH / 2, y: CORRIDOR_HEIGHT - 0.1 },
      { x: CORRIDOR_WIDTH / 2, y: CORRIDOR_HEIGHT - 0.1 }
    ];
    railPositions.forEach(pos => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, SEGMENT_LENGTH), ledMat);
      rail.position.set(pos.x, pos.y, 0);
      group.add(rail);
    });

    for (let i = -SEGMENT_LENGTH / 2 + 10; i < SEGMENT_LENGTH / 2; i += 15) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.8), new THREE.MeshBasicMaterial({ color: 0xff0022 }));
      lamp.position.set(0, CORRIDOR_HEIGHT - 0.05, i);
      group.add(lamp);

      const light = new THREE.PointLight(0xff3333, 30.0, 35);
      light.position.set(0, CORRIDOR_HEIGHT - 1.0, i);
      group.add(light);
    }

    group.position.z = z + SEGMENT_LENGTH / 2;
    engineRef.current.scene.add(group);
    
    return { mesh: group, startZ: z, endZ: z + SEGMENT_LENGTH };
  };

  const createCollapseWall = () => {
    const { wallGroup, wallGrid, wallLight, scene } = engineRef.current;
    const wallGeo = new THREE.PlaneGeometry(16, 20); // Scaled height
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff003c,
      emissiveIntensity: 6.0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const wallPlane = new THREE.Mesh(wallGeo, wallMat);
    wallGroup.add(wallPlane);

    const cylinderMat = new THREE.MeshStandardMaterial({
      color: 0xff003c,
      emissive: 0xff003c,
      emissiveIntensity: 4.0,
      transparent: true,
      opacity: 1.0
    });

    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 16), cylinderMat.clone());
      bar.rotation.z = Math.PI / 2;
      bar.position.y = -10 + i * 2.8;
      wallGrid.add(bar);
    }
    for (let i = 0; i < 7; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 20), cylinderMat.clone());
      bar.position.x = -7 + i * 2.35;
      wallGrid.add(bar);
    }
    wallGroup.add(wallGrid);

    wallLight.angle = Math.PI / 2.5;
    wallLight.penumbra = 0.4;
    wallLight.decay = 1.2;
    wallLight.castShadow = true;
    wallLight.shadow.mapSize.width = 2048;
    wallLight.shadow.mapSize.height = 2048;
    wallLight.position.set(0, 0, 1.5);
    wallLight.target.position.set(0, 0, 30);
    wallGroup.add(wallLight);
    wallGroup.add(wallLight.target);

    scene.add(wallGroup);
  };

  const handleShoot = () => {
    const { raycaster, camera, zombies, weaponGroup, particles, scene, muzzleFlash, muzzleFlashMesh } = engineRef.current;
    const current = stateRef.current;

    if (performance.now() < current.nextShotTime) return;
    
    setGameState(prev => ({ 
      ...prev, 
      nextShotTime: performance.now() + prev.shotCooldown,
      shotsFired: prev.shotsFired + 1
    }));

    playGunshotSound();

    weaponGroup.position.z = -0.9;
    weaponGroup.rotation.x = 0.25; 

    muzzleFlash.intensity = 20.0;
    if (muzzleFlashMesh) {
      muzzleFlashMesh.material.opacity = 1.0;
      muzzleFlashMesh.scale.setScalar(1.8);
    }
    
    setTimeout(() => {
      muzzleFlash.intensity = 0;
      if (muzzleFlashMesh) {
        muzzleFlashMesh.material.opacity = 0;
        muzzleFlashMesh.scale.setScalar(1);
      }
    }, 60);

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const targets = zombies.filter(z => !z.isDead).map(z => z.mesh);
    const intersects = raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      let targetMesh = hit.object;
      while (targetMesh.parent && !(targetMesh instanceof THREE.Group && zombies.some(z => z.mesh === targetMesh))) {
        targetMesh = targetMesh.parent;
      }
      
      const zombie = zombies.find(z => z.mesh === targetMesh);
      if (zombie) {
        zombie.hp -= 1;
        zombie.mesh.position.z += 2.0;

        setGameState(prev => ({ ...prev, shotsHit: prev.shotsHit + 1 }));

        const flashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 10.0 });
        zombie.mesh.traverse(obj => {
          if (obj instanceof THREE.Mesh) obj.material = flashMat;
        });

        setTimeout(() => {
          if (zombie && !zombie.isDead) {
            zombie.mesh.traverse(obj => {
              if (obj instanceof THREE.Mesh) {
                const orig = zombie.originalMaterials.get(obj);
                if (orig) obj.material = orig;
              }
            });
          }
        }, 80);

        for (let i = 0; i < 15; i++) {
          const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
          const pMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true });
          const p = new THREE.Mesh(pGeo, pMat);
          p.position.copy(hit.point);
          scene.add(p);
          particles.push({
            mesh: p,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random()) * 8, (Math.random() - 0.5) * 8),
            life: 1.0
          });
        }

        if (zombie.hp <= 0) {
          zombie.isDead = true;
          setGameState(prev => ({ 
            ...prev, 
            score: prev.score + zombie.scoreValue,
            killsByType: {
              ...prev.killsByType,
              [zombie.type]: (prev.killsByType[zombie.type] || 0) + 1
            }
          }));
          scene.remove(zombie.mesh);
        }
      }
    }
  };

  const handleGameOver = useCallback(() => {
    if (isGameOverTriggered.current) return;
    isGameOverTriggered.current = true;

    if (bgMusicRef.current) bgMusicRef.current.pause();
    
    setTimeout(() => {
      setGameState(prev => ({ ...prev, isGameOver: true, isGameActive: false }));
      try {
        if (document.pointerLockElement) document.exitPointerLock();
      } catch(e) {}
    }, 0);
  }, []);

  const initEngine = () => {
    const { scene, camera, player, weaponGroup, muzzleFlash, segments, renderer: existingRenderer, ambientLight } = engineRef.current;
    if (existingRenderer) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current?.appendChild(renderer.domElement);
    engineRef.current.renderer = renderer;

    scene.background = new THREE.Color(0x0a0505);
    scene.fog = new THREE.FogExp2(0x0a0505, 0.012);

    scene.add(ambientLight);

    player.position.set(0, 4.2, 0); 
    player.rotation.y = Math.PI; // Face corridor (+Z)
    camera.rotation.order = 'YXZ';
    camera.rotation.y = 0; 
    player.add(camera);
    scene.add(player);

    const gun = createWeaponModel('Standard');
    weaponGroup.add(gun);
    muzzleFlash.position.set(0.45, -0.25, -1.4);
    weaponGroup.add(muzzleFlash);

    const mFlashMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 1),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
    );
    mFlashMesh.position.set(0.45, -0.25, -1.5);
    engineRef.current.muzzleFlashMesh = mFlashMesh;
    weaponGroup.add(mFlashMesh);

    camera.add(weaponGroup);

    createCollapseWall();
    for (let i = 0; i < 4; i++) segments.push(createSegment(i * SEGMENT_LENGTH));

    const onKeyDown = (e: KeyboardEvent) => {
      engineRef.current.keysPressed[e.code] = true;
      if (e.code === 'KeyM') toggleMute();
    };
    const onKeyUp = (e: KeyboardEvent) => engineRef.current.keysPressed[e.code] = false;
    const onMouseMove = (e: MouseEvent) => {
      if (!isGameOverTriggered.current) {
        player.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    
    containerRef.current?.addEventListener('mousedown', () => {
      const current = stateRef.current;
      if (!current.isGameActive || current.isGameOver) return;
      if (document.pointerLockElement !== containerRef.current) {
        try { 
          const promise = containerRef.current?.requestPointerLock();
          if (promise && 'catch' in promise) {
            promise.catch(() => {});
          }
        } catch (err) {}
      }
      handleShoot();
    });

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = engineRef.current.clock.getDelta();
      const current = stateRef.current;

      if (!current.isGameActive || current.isGameOver) {
        renderer.render(scene, camera);
        return;
      }

      const newTimeInStage = current.progression.timeInCurrentStage + delta;
      if (newTimeInStage >= current.progression.stageDurationThreshold) {
        const nextStage = current.progression.currentStage + 1;
        const multiplier = 1.0 + (nextStage > 1 ? 0.25 + (nextStage - 2) * 0.25 : 0);
        
        const spawnCap = Math.min(30, current.progression.spawnCap * 2);
        const spawnInterval = Math.max(0.35, 3.0 / multiplier);
        const wallSpeed = current.wallBaseSpeed * multiplier;

        const titles = ['CONTAINMENT BREACH', 'HORDE DETECTED', 'CRITICAL OVERRUN', 'OUTBREAK MAXIMUM', 'SURVIVAL IMPOSSIBLE'];
        const newTitle = titles[Math.min(titles.length - 1, nextStage - 1)];

        let weaponType = current.weaponType;
        let shotCooldown = current.shotCooldown;
        if (nextStage === 3) {
          weaponType = 'AK47';
          shotCooldown = 120;
          const toRemove = weaponGroup.children.filter(child => child instanceof THREE.Group && child !== engineRef.current.muzzleFlashMesh);
          toRemove.forEach(child => weaponGroup.remove(child));
          weaponGroup.add(createWeaponModel('AK47'));
        }

        engineRef.current.ambientLight.intensity *= 0.85;
        if (scene.fog instanceof THREE.FogExp2) scene.fog.density += 0.01;

        setGameState(prev => ({
          ...prev,
          showAlert: true,
          stageTitle: newTitle,
          wallCurrentSpeed: wallSpeed,
          weaponType,
          shotCooldown,
          progression: {
            ...prev.progression,
            currentStage: nextStage,
            timeInCurrentStage: 0,
            globalDifficultyMultiplier: multiplier,
            spawnCap: spawnCap,
            currentSpawnInterval: spawnInterval
          }
        }));
        setTimeout(() => setGameState(prev => ({ ...prev, showAlert: false })), 1500);
      } else {
        setGameState(prev => ({ ...prev, progression: { ...prev.progression, timeInCurrentStage: newTimeInStage } }));
      }

      const moveDir = new THREE.Vector3();
      const keys = engineRef.current.keysPressed;
      
      // Fix reversed WASD by explicitly mapping to world directions
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, player.rotation.y, 0));
      const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, player.rotation.y, 0));

      if (keys['KeyW']) moveDir.add(forward);
      if (keys['KeyS']) moveDir.sub(forward);
      if (keys['KeyA']) moveDir.sub(right);
      if (keys['KeyD']) moveDir.add(right);

      if (moveDir.length() > 0) {
        moveDir.normalize();
        player.position.add(moveDir.multiplyScalar(current.speed * delta));
        engineRef.current.bobTimer += delta * 12.0;
        camera.position.y = 4.2 + Math.sin(engineRef.current.bobTimer) * 0.1;
      } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 4.2, 0.1);
      }

      player.position.x = Math.max(-CORRIDOR_WIDTH / 2 + 1.0, Math.min(CORRIDOR_WIDTH / 2 - 1.0, player.position.x));

      setGameState(prev => {
        let newWallZ = prev.wallZ + prev.wallCurrentSpeed * delta;
        if (player.position.z - newWallZ > prev.wallMaxDistanceBehind) newWallZ = player.position.z - prev.wallMaxDistanceBehind;
        return { ...prev, wallZ: newWallZ };
      });
      setDistToWall(player.position.z - current.wallZ);

      engineRef.current.wallGroup.position.z = current.wallZ;
      const wallPulse = 0.6 + Math.sin(performance.now() * 0.008) * 0.4;
      engineRef.current.wallGrid.children.forEach(child => { if (child instanceof THREE.Mesh) child.material.opacity = wallPulse; });

      if (player.position.z <= current.wallZ) handleGameOver();

      if (player.position.z - engineRef.current.segments[0].endZ > 15) {
        const old = engineRef.current.segments.shift()!;
        scene.remove(old.mesh);
        old.mesh.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); } });
        const last = engineRef.current.segments[engineRef.current.segments.length - 1];
        engineRef.current.segments.push(createSegment(last.endZ));
      }

      if (performance.now() - current.lastSpawnTime > current.progression.currentSpawnInterval * 1000 && engineRef.current.zombies.length < current.progression.spawnCap) {
        spawnZombie();
        setGameState(prev => ({ ...prev, lastSpawnTime: performance.now() }));
      }

      engineRef.current.zombies = engineRef.current.zombies.filter(z => {
        if (z.isDead) return false;
        if (z.mesh.position.z <= current.wallZ) { scene.remove(z.mesh); return false; }
        const toPlayer = new THREE.Vector3().copy(player.position).sub(z.mesh.position);
        toPlayer.y = 0;
        const dist = toPlayer.length();
        toPlayer.normalize();
        z.mesh.position.add(toPlayer.multiplyScalar(z.speed * delta));
        z.mesh.lookAt(player.position.x, 0, player.position.z);
        const armSwing = Math.sin(performance.now() * 0.005 * z.speed) * 0.4;
        z.leftArm.rotation.x = armSwing;
        z.rightArm.rotation.x = -armSwing;
        if (dist < 3.2 && performance.now() - current.lastDamageTime > current.zombieDamageInterval) {
          triggerDamageFlash();
          const newHp = current.hp - 12;
          if (newHp <= 0) handleGameOver(); else setGameState(prev => ({ ...prev, hp: newHp, lastDamageTime: performance.now() }));
        }
        return true;
      });

      engineRef.current.particles = engineRef.current.particles.filter(p => {
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        p.velocity.y -= 9.8 * delta;
        p.life -= delta * 2;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life;
        if (p.life <= 0) { scene.remove(p.mesh); return false; }
        return true;
      });

      weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, -0.6, 0.15); 
      weaponGroup.rotation.x = THREE.MathUtils.lerp(weaponGroup.rotation.x, 0, 0.15);
      setGameState(prev => ({ ...prev, distance: Math.floor(player.position.z) }));
      renderer.render(scene, camera);
    };
    animate();
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('mousemove', onMouseMove); };
  };

  const restartGame = () => {
    const { scene, zombies, particles, segments, player, camera, ambientLight, weaponGroup } = engineRef.current;
    isGameOverTriggered.current = false;
    zombies.forEach(z => scene.remove(z.mesh));
    engineRef.current.zombies = [];
    particles.forEach(p => scene.remove(p.mesh));
    engineRef.current.particles = [];
    segments.forEach(s => { scene.remove(s.mesh); s.mesh.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); } }); });
    engineRef.current.segments = [];
    player.position.set(0, 4.2, 0);
    player.rotation.y = Math.PI; // Correctly face forward (+Z)
    camera.rotation.y = 0;
    
    const toRemove = weaponGroup.children.filter(child => child instanceof THREE.Group && child !== engineRef.current.muzzleFlashMesh);
    toRemove.forEach(child => weaponGroup.remove(child));
    weaponGroup.add(createWeaponModel('Standard'));

    for (let i = 0; i < 4; i++) engineRef.current.segments.push(createSegment(i * SEGMENT_LENGTH));
    ambientLight.intensity = 0.45;
    if (scene.fog instanceof THREE.FogExp2) scene.fog.density = 0.012;
    if (bgMusicRef.current) { 
      bgMusicRef.current.currentTime = 0; 
      bgMusicRef.current.muted = isMutedRef.current;
      bgMusicRef.current.play().catch(() => {}); 
    }
    gunshotPoolRef.current.forEach(a => a.load());
    zombieSoundPoolRef.current.forEach(a => a.load());
    setGameState({ ...INITIAL_GAME_STATE, isGameActive: true, lastSpawnTime: performance.now(), startTime: performance.now() });
  };

  useEffect(() => { initEngine(); }, []);

  return (
    <div id="game-container" className={gameState.isGameActive && !gameState.isGameOver ? 'playing-active' : ''} ref={containerRef}>
      <audio ref={bgMusicRef} src="https://www.myinstants.com/media/sounds/hardcore-trance-8.mp3" loop style={{ display: 'none' }} />
      <div id="damage-flash" ref={flashRef} />
      
      {/* Mute Button HUD */}
      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, pointerEvents: 'auto' }}>
        <button 
          className="btn" 
          onClick={toggleMute} 
          style={{ fontSize: '0.8rem', padding: '5px 15px', minWidth: '120px' }}
        >
          {isMuted ? 'UNMUTE [M]' : 'MUTE [M]'}
        </button>
      </div>

      {!gameState.isGameActive && !gameState.isGameOver && (
        <div id="start-screen">
          <h1>ZOMBIE CORRIDOR</h1>
          <div className="start-subtitle">FACILITY LOCKDOWN V2</div>
          <button className="btn" onClick={restartGame}>ENTER LOCKDOWN ZONE</button>
          <div className="instructions-block">
            <span style={{ color: 'var(--red-emergency)', fontWeight: 'bold' }}>MISSION OBJECTIVE:</span>
            <p style={{ fontSize: '0.85rem', margin: '10px 0' }}>SURVIVE THE HORDES. REACH STAGE 3 FOR AK-47 REINFORCEMENT. AVOID COLLAPSE WALL.</p>
            <table>
              <tbody>
                <tr><td><span className="key-highlight">W, A, S, D</span></td><td>TACTICAL MOVEMENT</td></tr>
                <tr><td><span className="key-highlight">MOUSE</span></td><td>AIMING RETICLE</td></tr>
                <tr><td><span className="key-highlight">LEFT CLICK</span></td><td>ENGAGE FIREARM</td></tr>
                <tr><td><span className="key-highlight">M</span></td><td>TOGGLE AUDIO MUTE</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {gameState.isGameActive && <HUD state={gameState} distToWall={distToWall} />}
      {gameState.showAlert && (
        <div className="stage-alert">
          ALERT: {gameState.stageTitle}
          <div className="stage-multiplier">
            {gameState.weaponType === 'AK47' && <div style={{ color: '#00ff66' }}>AK-47 UNLOCKED</div>}
            MULTIPLIER {gameState.progression.globalDifficultyMultiplier.toFixed(2)}x
          </div>
        </div>
      )}
      {gameState.isGameOver && (
        <GameOver 
          state={gameState} 
          onRestart={restartGame} 
          onQuit={() => { isGameOverTriggered.current = false; setGameState(INITIAL_GAME_STATE); }} 
        />
      )}
    </div>
  );
}
