
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, INITIAL_GAME_STATE, ZOMBIE_CLASSES, ZombieType } from '@/lib/game-types';
import HUD from './HUD';
import GameOver from './GameOver';

// Constants
const SEGMENT_LENGTH = 30;
const CORRIDOR_WIDTH = 8;
const CORRIDOR_HEIGHT = 5.5;

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
  const isGameOverTriggered = useRef(false);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [distToWall, setDistToWall] = useState(20);
  
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
    muzzleFlash: new THREE.PointLight(0xffaa00, 0, 5),
    bobTimer: 0,
    raycaster: new THREE.Raycaster(),
    // Collapse Wall components
    wallGroup: new THREE.Group(),
    wallGrid: new THREE.Group(),
    wallLight: new THREE.SpotLight(0xff003c, 5.0, 45),
    ambientLight: new THREE.AmbientLight(0xffffff, 0.4), // Low light for horror feel
  });

  const stateRef = useRef<GameState>(INITIAL_GAME_STATE);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const triggerDamageFlash = () => {
    if (flashRef.current) {
      flashRef.current.style.backgroundColor = 'rgba(255, 0, 60, 0.4)';
      setTimeout(() => {
        if (flashRef.current) flashRef.current.style.backgroundColor = 'rgba(255, 0, 60, 0)';
      }, 100);
    }
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
    } else if (stage === 4) {
      if (rand < 0.15) type = 'Walker';
      else if (rand < 0.65) type = 'Runner';
      else if (rand < 0.85) type = 'Tank';
      else type = 'Elite';
    } else {
      if (rand < 0.4) type = 'Runner';
      else if (rand < 0.7) type = 'Tank';
      else type = 'Elite';
    }

    const stats = ZOMBIE_CLASSES[type];
    const multiplier = current.progression.globalDifficultyMultiplier;

    const speed = stats.baseSpeed * multiplier;
    const hp = Math.round(stats.baseHp * multiplier);
    const scoreValue = Math.round(stats.scoreValue * multiplier);

    const group = new THREE.Group();
    
    // SCARY CREEPY DESIGN: Desaturated sickly palette
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9, metalness: 0.05 }); 
    const clothingMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 1.0 }); 
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const goreMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 }); 

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), skinMat);
    head.position.y = 1.45;
    head.rotation.z = (Math.random() - 0.5) * 0.4;
    group.add(head);

    const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), eyeMat);
    lEye.position.set(-0.12, 1.55, 0.22);
    group.add(lEye);
    const rEye = lEye.clone();
    rEye.position.x = 0.12;
    group.add(rEye);

    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.04), mouthMat);
    mouth.position.set(0, 1.32, 0.22);
    group.add(mouth);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), clothingMat);
    torso.position.y = 0.9;
    group.add(torso);

    const wound = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.05), goreMat);
    wound.position.set(0, 0.9, 0.16);
    group.add(wound);

    // Asymmetric unsettling limbs
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.75), skinMat);
    leftArm.position.set(-0.35, 1.15, 0.3);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.95), skinMat); 
    rightArm.position.set(0.35, 1.1, 0.4);
    group.add(rightArm);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), clothingMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    group.add(leftLeg);
    
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    group.add(rightLeg);

    group.scale.setScalar(stats.scale);
    group.position.set(
      (Math.random() - 0.5) * (CORRIDOR_WIDTH - 2.5),
      0,
      player.position.z + 35 + Math.random() * 40
    );

    const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
    group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        originalMaterials.set(obj, obj.material);
        obj.castShadow = true;
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
    rWall.receiveShadow = true;
    group.add(rWall);

    for (let i = -SEGMENT_LENGTH / 2 + 3; i < SEGMENT_LENGTH / 2; i += 6) {
      const lPillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, CORRIDOR_HEIGHT, 0.6), beamMat);
      lPillar.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, i);
      lPillar.receiveShadow = true;
      group.add(lPillar);

      const rPillar = lPillar.clone();
      rPillar.position.x = CORRIDOR_WIDTH / 2;
      rPillar.receiveShadow = true;
      group.add(rPillar);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(CORRIDOR_WIDTH - 0.4, 0.3, 0.6), beamMat);
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
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, SEGMENT_LENGTH), ledMat);
      rail.position.set(pos.x, pos.y, 0);
      group.add(rail);
    });

    for (let i = -SEGMENT_LENGTH / 2 + 5; i < SEGMENT_LENGTH / 2; i += 10) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), new THREE.MeshBasicMaterial({ color: 0xff0022 }));
      lamp.position.set(0, CORRIDOR_HEIGHT - 0.05, i);
      group.add(lamp);

      const light = new THREE.PointLight(0xff3333, 15.0, 25);
      light.position.set(0, CORRIDOR_HEIGHT - 0.5, i);
      group.add(light);
    }

    group.position.z = z + SEGMENT_LENGTH / 2;
    engineRef.current.scene.add(group);
    
    return { mesh: group, startZ: z, endZ: z + SEGMENT_LENGTH };
  };

  const createCollapseWall = () => {
    const { wallGroup, wallGrid, wallLight, scene } = engineRef.current;
    const wallGeo = new THREE.PlaneGeometry(12, 8);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff003c,
      emissiveIntensity: 5.0,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const wallPlane = new THREE.Mesh(wallGeo, wallMat);
    wallGroup.add(wallPlane);

    const cylinderMat = new THREE.MeshStandardMaterial({
      color: 0xff003c,
      emissive: 0xff003c,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 1.0
    });

    for (let i = 0; i < 8; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 12), cylinderMat.clone());
      bar.rotation.z = Math.PI / 2;
      bar.position.y = -4 + i * 1.15;
      wallGrid.add(bar);
    }
    for (let i = 0; i < 7; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 8), cylinderMat.clone());
      bar.position.x = -5 + i * 1.7;
      wallGrid.add(bar);
    }
    wallGroup.add(wallGrid);

    wallLight.angle = Math.PI / 3;
    wallLight.penumbra = 0.5;
    wallLight.decay = 1.5;
    wallLight.castShadow = true;
    wallLight.shadow.mapSize.width = 1024;
    wallLight.shadow.mapSize.height = 1024;
    wallLight.position.set(0, 0, 1);
    wallLight.target.position.set(0, 0, 20);
    wallGroup.add(wallLight);
    wallGroup.add(wallLight.target);

    scene.add(wallGroup);
  };

  const handleShoot = () => {
    const { raycaster, camera, zombies, weaponGroup, particles, scene } = engineRef.current;
    const current = stateRef.current;

    if (performance.now() < current.nextShotTime) return;
    
    setGameState(prev => ({ 
      ...prev, 
      nextShotTime: performance.now() + prev.shotCooldown,
      shotsFired: prev.shotsFired + 1
    }));

    // Visual Recoil
    weaponGroup.position.z = -0.35; 
    weaponGroup.rotation.x = 0.2; 

    engineRef.current.muzzleFlash.intensity = 5.5;
    setTimeout(() => {
      engineRef.current.muzzleFlash.intensity = 0;
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
        zombie.mesh.position.z += 1.5;

        setGameState(prev => ({ ...prev, shotsHit: prev.shotsHit + 1 }));

        // Hit flash logic
        const flashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 8.0 });
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
          const pGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
          const pMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
          const p = new THREE.Mesh(pGeo, pMat);
          p.position.copy(hit.point);
          scene.add(p);
          particles.push({
            mesh: p,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random()) * 5, (Math.random() - 0.5) * 5),
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

    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
    }
    
    setTimeout(() => {
      setGameState(prev => ({ ...prev, isGameOver: true, isGameActive: false }));
      try {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
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
    containerRef.current?.appendChild(renderer.domElement);
    engineRef.current.renderer = renderer;

    scene.background = new THREE.Color(0x0a0505);
    scene.fog = new THREE.FogExp2(0x0a0505, 0.01);

    scene.add(ambientLight);

    player.position.set(0, 1.8, 0);
    player.rotation.y = Math.PI; // Correct starting orientation: face +Z forward
    player.add(camera);
    scene.add(player);

    // Redesigned Tactical Sci-Fi Gun
    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.1 })
    );
    const barrel1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1.0, roughness: 0.2 })
    );
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(0.03, 0.04, 0.35);
    
    const barrel2 = barrel1.clone();
    barrel2.position.x = -0.03;

    const glowRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.01, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xff003c, emissive: 0xff003c, emissiveIntensity: 2.0 })
    );
    glowRail.position.set(0, 0.08, 0.1);

    const gun = new THREE.Group();
    gun.add(gunBody, barrel1, barrel2, glowRail);
    gun.position.set(0.35, -0.25, -0.5); 
    gun.castShadow = true;
    
    weaponGroup.add(gun);
    muzzleFlash.position.set(0.35, -0.2, -0.9);
    weaponGroup.add(muzzleFlash);
    camera.add(weaponGroup);

    createCollapseWall();
    for (let i = 0; i < 4; i++) {
      segments.push(createSegment(i * SEGMENT_LENGTH));
    }

    const onKeyDown = (e: KeyboardEvent) => engineRef.current.keysPressed[e.code] = true;
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
    
    containerRef.current?.addEventListener('mousedown', (e) => {
      const current = stateRef.current;
      if (!current.isGameActive || current.isGameOver) return;
      
      if (document.pointerLockElement !== containerRef.current) {
        try {
          const lockPromise = containerRef.current?.requestPointerLock() as any;
          if (lockPromise && typeof lockPromise.catch === 'function') {
            lockPromise.catch(() => {});
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

      // Progression Engine
      const newTimeInStage = current.progression.timeInCurrentStage + delta;
      if (newTimeInStage >= current.progression.stageDurationThreshold) {
        const nextStage = current.progression.currentStage + 1;
        const multiplier = Math.pow(1.5, nextStage - 1);
        const spawnCap = Math.min(30, Math.round(6 * multiplier));
        const spawnInterval = Math.max(0.35, 3.0 / multiplier);
        const wallSpeed = 2.5 * Math.pow(1.5, nextStage - 1);

        const titles = [
          'CONTAINMENT BREACH',
          'HORDE DETECTED',
          'CRITICAL OVERRUN',
          'OUTBREAK MAXIMUM',
          'SURVIVAL IMPOSSIBLE'
        ];
        const newTitle = titles[Math.min(titles.length - 1, nextStage - 1)];

        engineRef.current.ambientLight.intensity *= 0.85;
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.density += 0.005;
        }

        setGameState(prev => ({
          ...prev,
          showAlert: true,
          stageTitle: newTitle,
          wallBaseSpeed: wallSpeed,
          progression: {
            ...prev.progression,
            currentStage: nextStage,
            timeInCurrentStage: 0,
            globalDifficultyMultiplier: multiplier,
            spawnCap: spawnCap,
            currentSpawnInterval: spawnInterval
          }
        }));

        setTimeout(() => {
          setGameState(prev => ({ ...prev, showAlert: false }));
        }, 1500);

      } else {
        setGameState(prev => ({
          ...prev,
          progression: {
            ...prev.progression,
            timeInCurrentStage: newTimeInStage
          }
        }));
      }

      const moveDir = new THREE.Vector3();
      const keys = engineRef.current.keysPressed;
      if (keys['KeyW']) moveDir.z -= 1; 
      if (keys['KeyS']) moveDir.z += 1; 
      if (keys['KeyA']) moveDir.x -= 1; 
      if (keys['KeyD']) moveDir.x += 1; 

      if (moveDir.length() > 0) {
        moveDir.normalize().applyEuler(new THREE.Euler(0, player.rotation.y, 0));
        player.position.add(moveDir.multiplyScalar(current.speed * delta));
        engineRef.current.bobTimer += delta * 12.0;
        camera.position.y = 1.8 + Math.sin(engineRef.current.bobTimer) * 0.08;
      } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.8, 0.1);
      }

      player.position.x = Math.max(-3.7, Math.min(3.7, player.position.x));

      // Collapse wall logic
      const currentWallSpeed = current.wallBaseSpeed;
      setGameState(prev => {
        let newWallZ = prev.wallZ + currentWallSpeed * delta;
        if (player.position.z - newWallZ > prev.wallMaxDistanceBehind) {
          newWallZ = player.position.z - prev.wallMaxDistanceBehind;
        }
        return { ...prev, wallZ: newWallZ, wallCurrentSpeed: currentWallSpeed };
      });
      setDistToWall(player.position.z - current.wallZ);

      engineRef.current.wallGroup.position.z = current.wallZ;
      const wallPulse = 0.6 + Math.sin(performance.now() * 0.008) * 0.4;
      engineRef.current.wallGrid.children.forEach(child => {
        if (child instanceof THREE.Mesh) child.material.opacity = wallPulse;
      });

      if (player.position.z <= current.wallZ) handleGameOver();

      // Environment recycling
      if (player.position.z - engineRef.current.segments[0].endZ > 15) {
        const old = engineRef.current.segments.shift()!;
        scene.remove(old.mesh);
        old.mesh.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
        const last = engineRef.current.segments[engineRef.current.segments.length - 1];
        engineRef.current.segments.push(createSegment(last.endZ));
      }

      // Zombie Spawning
      if (performance.now() - current.lastSpawnTime > current.progression.currentSpawnInterval * 1000 && engineRef.current.zombies.length < current.progression.spawnCap) {
        spawnZombie();
        setGameState(prev => ({ ...prev, lastSpawnTime: performance.now() }));
      }

      // Zombie AI
      engineRef.current.zombies = engineRef.current.zombies.filter(z => {
        if (z.isDead) return false;
        if (z.mesh.position.z <= current.wallZ) {
          scene.remove(z.mesh);
          return false;
        }

        const toPlayer = new THREE.Vector3().copy(player.position).sub(z.mesh.position);
        toPlayer.y = 0;
        const dist = toPlayer.length();
        toPlayer.normalize();
        
        z.mesh.position.add(toPlayer.multiplyScalar(z.speed * delta));
        z.mesh.lookAt(player.position.x, 0, player.position.z);

        const armSwing = Math.sin(performance.now() * 0.005 * z.speed) * 0.4;
        z.leftArm.rotation.x = armSwing;
        z.rightArm.rotation.x = -armSwing;

        if (dist < 1.6 && performance.now() - current.lastDamageTime > current.zombieDamageInterval) {
          triggerDamageFlash();
          const newHp = current.hp - 12;
          if (newHp <= 0) {
            handleGameOver();
          } else {
            setGameState(prev => ({
              ...prev,
              hp: newHp,
              lastDamageTime: performance.now()
            }));
          }
        }
        return true;
      });

      // Particle update
      engineRef.current.particles = engineRef.current.particles.filter(p => {
        p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
        p.velocity.y -= 9.8 * delta;
        p.life -= delta * 2;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          return false;
        }
        return true;
      });

      // Viewmodel recoil interp
      weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, -0.5, 0.15); 
      weaponGroup.rotation.x = THREE.MathUtils.lerp(weaponGroup.rotation.x, 0, 0.15);

      setGameState(prev => ({ ...prev, distance: Math.floor(player.position.z) }));
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  };

  const restartGame = () => {
    const { scene, zombies, particles, segments, player, ambientLight } = engineRef.current;
    isGameOverTriggered.current = false;
    zombies.forEach(z => scene.remove(z.mesh));
    engineRef.current.zombies = [];
    particles.forEach(p => scene.remove(p.mesh));
    engineRef.current.particles = [];
    segments.forEach(s => {
      scene.remove(s.mesh);
      s.mesh.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    engineRef.current.segments = [];
    
    player.position.set(0, 1.8, 0);
    player.rotation.y = Math.PI; 
    for (let i = 0; i < 4; i++) {
      engineRef.current.segments.push(createSegment(i * SEGMENT_LENGTH));
    }

    ambientLight.intensity = 0.4;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.01;
    }

    if (bgMusicRef.current) {
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.play().catch(() => {});
    }

    setGameState({ 
      ...INITIAL_GAME_STATE, 
      isGameActive: true, 
      lastSpawnTime: performance.now(),
      startTime: performance.now()
    });
  };

  useEffect(() => {
    initEngine();
  }, []);

  return (
    <div id="game-container" className={gameState.isGameActive && !gameState.isGameOver ? 'playing-active' : ''} ref={containerRef}>
      <audio 
        ref={bgMusicRef} 
        src="https://www.myinstants.com/media/sounds/hardcore-trance-8.mp3" 
        loop 
        style={{ display: 'none' }} 
      />
      
      <div id="damage-flash" ref={flashRef} />
      
      {!gameState.isGameActive && !gameState.isGameOver && (
        <div id="start-screen">
          <h1>ZOMBIE CORRIDOR</h1>
          <div className="start-subtitle">FACILITY CONTAINMENT REBUILD V2</div>
          <button className="btn" onClick={restartGame}>ENTER LOCKDOWN ZONE</button>
          
          <div className="instructions-block">
            <span style={{ color: 'var(--red-emergency)', fontWeight: 'bold' }}>MISSION OBJECTIVE:</span>
            <p style={{ fontSize: '0.85rem', margin: '10px 0' }}>SURVIVE THE ENDLESS CORRIDOR. NEUTRALIZE BIO-HAZARDS. AVOID THERMAL COLLAPSE WALL.</p>
            <table>
              <tbody>
                <tr><td><span className="key-highlight">W, A, S, D</span></td><td>TACTICAL MOVEMENT</td></tr>
                <tr><td><span className="key-highlight">MOUSE</span></td><td>AIMING RETICLE</td></tr>
                <tr><td><span className="key-highlight">LEFT CLICK</span></td><td>ENGAGE FIREARM</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gameState.isGameActive && <HUD state={gameState} distToWall={distToWall} />}

      {gameState.showAlert && (
        <div className="stage-alert">
          ALERT: {gameState.stageTitle}
          <div className="stage-multiplier">MULTIPLIER {gameState.progression.globalDifficultyMultiplier.toFixed(2)}x</div>
        </div>
      )}

      {gameState.isGameOver && (
        <GameOver 
          state={gameState} 
          onRestart={restartGame} 
          onQuit={() => {
            isGameOverTriggered.current = false;
            setGameState(INITIAL_GAME_STATE);
          }} 
        />
      )}

      {gameState.isGameActive && !gameState.isGameOver && (
        <div id="mobile-controls">
          <div id="mobile-dpad">
            <div className="mobile-btn" style={{ gridColumn: '2', gridRow: '1' }} onTouchStart={() => engineRef.current.keysPressed['KeyW'] = true} onTouchEnd={() => engineRef.current.keysPressed['KeyW'] = false}>W</div>
            <div className="mobile-btn" style={{ gridColumn: '1', gridRow: '2' }} onTouchStart={() => engineRef.current.keysPressed['KeyA'] = true} onTouchEnd={() => engineRef.current.keysPressed['KeyA'] = false}>A</div>
            <div className="mobile-btn" style={{ gridColumn: '2', gridRow: '2' }} onTouchStart={() => engineRef.current.keysPressed['KeyS'] = true} onTouchEnd={() => engineRef.current.keysPressed['KeyS'] = false}>S</div>
            <div className="mobile-btn" style={{ gridColumn: '3', gridRow: '2' }} onTouchStart={() => engineRef.current.keysPressed['KeyD'] = true} onTouchEnd={() => engineRef.current.keysPressed['KeyD'] = false}>D</div>
          </div>
          <div id="mobile-fire" onTouchStart={handleShoot}>FIRE</div>
        </div>
      )}
    </div>
  );
}

