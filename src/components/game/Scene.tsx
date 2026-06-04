
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, INITIAL_GAME_STATE, ZOMBIE_CLASSES, ZombieType } from '@/lib/game-types';
import HUD from './HUD';
import GameOver from './GameOver';

// Constants
const SEGMENT_LENGTH = 40;
const CORRIDOR_WIDTH = 12;
const CORRIDOR_HEIGHT = 13.5; 

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
    wallGroup: new THREE.Group(),
    wallGrid: new THREE.Group(),
    wallLight: new THREE.SpotLight(0xff003c, 8.0, 60),
    ambientLight: new THREE.AmbientLight(0xffffff, 0.45),
  });

  const stateRef = useRef<GameState>(INITIAL_GAME_STATE);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

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

  const createWeaponModel = (type: 'Standard' | 'Shotgun' | 'AK47') => {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.9, roughness: 0.1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    const emissionMat = new THREE.MeshStandardMaterial({ color: 0xff003c, emissive: 0xff003c, emissiveIntensity: 3.0 });

    if (type === 'Standard') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.6), metalMat);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 0.4);
      group.add(body, barrel);
    } else if (type === 'Shotgun') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.7), metalMat);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 0.5);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), metalMat);
      pump.position.set(0, -0.1, 0.4);
      group.add(body, barrel, pump);
    } else if (type === 'AK47') {
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.8), metalMat);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 0.7);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.2), metalMat);
      mag.position.set(0, -0.25, 0.2);
      mag.rotation.x = -0.2;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.5), woodMat);
      stock.position.set(0, -0.05, -0.5);
      group.add(receiver, barrel, mag, stock);
    }

    group.position.set(0.4, -0.3, -0.8);
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
      if (rand < 0.6) type = 'Walker';
      else if (rand < 0.9) type = 'Runner';
      else type = 'Tank';
    } else {
      if (rand < 0.3) type = 'Walker';
      else if (rand < 0.6) type = 'Runner';
      else if (rand < 0.8) type = 'Tank';
      else type = 'Elite';
    }

    const stats = ZOMBIE_CLASSES[type];
    const multiplier = current.progression.globalDifficultyMultiplier;

    const speed = stats.baseSpeed * multiplier;
    const hp = Math.round(stats.baseHp * multiplier);
    const scoreValue = Math.round(stats.scoreValue * multiplier);

    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x6a6c6e }); 
    const clothingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a }); 

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skinMat);
    head.position.y = 1.45;
    group.add(head);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), clothingMat);
    torso.position.y = 0.9;
    group.add(torso);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.8), skinMat);
    leftArm.position.set(-0.35, 1.1, 0.4);
    group.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.35;
    group.add(rightArm);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), clothingMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    group.add(leftLeg);
    
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.18;
    group.add(rightLeg);

    group.scale.setScalar(stats.scale);
    group.position.set(
      (Math.random() - 0.5) * (CORRIDOR_WIDTH - 4.0),
      0,
      player.position.z + 60 + Math.random() * 40
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

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, SEGMENT_LENGTH), ledMat);
    rail.position.set(-CORRIDOR_WIDTH / 2, 0.1, 0);
    group.add(rail);

    const light = new THREE.PointLight(0xff3333, 30.0, 35);
    light.position.set(0, CORRIDOR_HEIGHT - 2.0, 0);
    group.add(light);

    group.position.z = z + SEGMENT_LENGTH / 2;
    engineRef.current.scene.add(group);
    
    return { mesh: group, startZ: z, endZ: z + SEGMENT_LENGTH };
  };

  const createCollapseWall = () => {
    const { wallGroup, scene } = engineRef.current;
    const wallGeo = new THREE.PlaneGeometry(20, 30); 
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff003c,
      emissiveIntensity: 6.0,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const wallPlane = new THREE.Mesh(wallGeo, wallMat);
    wallGroup.add(wallPlane);
    scene.add(wallGroup);
  };

  const handleShoot = () => {
    const { raycaster, camera, zombies, weaponGroup, scene, muzzleFlash, muzzleFlashMesh } = engineRef.current;
    const current = stateRef.current;

    if (performance.now() < current.nextShotTime) return;
    
    setGameState(prev => ({ 
      ...prev, 
      nextShotTime: performance.now() + prev.shotCooldown,
      shotsFired: prev.shotsFired + 1
    }));

    playGunshotSound();

    weaponGroup.position.z = -0.9;
    muzzleFlash.intensity = 20.0;
    if (muzzleFlashMesh) muzzleFlashMesh.material.opacity = 1.0;
    
    setTimeout(() => {
      muzzleFlash.intensity = 0;
      if (muzzleFlashMesh) muzzleFlashMesh.material.opacity = 0;
    }, 50);

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const targets = zombies.filter(z => !z.isDead).map(z => z.mesh);
    const intersects = raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      let targetMesh = intersects[0].object;
      while (targetMesh.parent && !(targetMesh instanceof THREE.Group && zombies.some(z => z.mesh === targetMesh))) {
        targetMesh = targetMesh.parent;
      }
      
      const zombie = zombies.find(z => z.mesh === targetMesh);
      if (zombie) {
        // Shotgun deals massive damage to one-shot Walkers (3.5 > 3.0)
        const damage = current.weaponType === 'Shotgun' ? 3.5 : 1.0;
        zombie.hp -= damage;
        zombie.mesh.position.z += 1.5;

        setGameState(prev => ({ ...prev, shotsHit: prev.shotsHit + 1 }));

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
      if (document.pointerLockElement) document.exitPointerLock();
    }, 0);
  }, []);

  const initEngine = () => {
    const { scene, camera, player, weaponGroup, muzzleFlash, segments, renderer: existingRenderer } = engineRef.current;
    if (existingRenderer) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current?.appendChild(renderer.domElement);
    engineRef.current.renderer = renderer;

    scene.background = new THREE.Color(0x0a0505);
    scene.fog = new THREE.FogExp2(0x0a0505, 0.015);
    scene.add(engineRef.current.ambientLight);

    player.position.set(0, 4.2, 0); 
    player.rotation.y = Math.PI; // Face forward (+Z)
    camera.rotation.order = 'YXZ';
    player.add(camera);
    scene.add(player);

    const gun = createWeaponModel('Standard');
    weaponGroup.add(gun);
    muzzleFlash.position.set(0.4, -0.2, -1.4);
    weaponGroup.add(muzzleFlash);

    const mFlashMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 1),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 })
    );
    mFlashMesh.position.set(0.4, -0.2, -1.5);
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
      if (document.pointerLockElement !== containerRef.current) {
        try {
          containerRef.current?.requestPointerLock();
        } catch (e) {
          // Silently handle cases where pointer lock is restricted (e.g. sandboxed environments)
        }
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
        // 1.25x for stage 2, then +0.25 per stage
        const multiplier = 1.0 + (nextStage > 1 ? 0.25 + (nextStage - 2) * 0.25 : 0);
        const spawnCap = Math.round(INITIAL_GAME_STATE.progression.spawnCap * (1.8 * nextStage));
        const spawnInterval = Math.max(0.3, 3.0 / multiplier);

        let weaponType = current.weaponType;
        let shotCooldown = current.shotCooldown;
        
        if (nextStage === 2) {
          weaponType = 'Shotgun';
          shotCooldown = 600; 
          const toRemove = weaponGroup.children.filter(child => child instanceof THREE.Group);
          toRemove.forEach(child => weaponGroup.remove(child));
          weaponGroup.add(createWeaponModel('Shotgun'));
        } else if (nextStage === 3) {
          weaponType = 'AK47';
          shotCooldown = 120;
          const toRemove = weaponGroup.children.filter(child => child instanceof THREE.Group);
          toRemove.forEach(child => weaponGroup.remove(child));
          weaponGroup.add(createWeaponModel('AK47'));
        }

        setGameState(prev => ({
          ...prev,
          showAlert: true,
          stageTitle: `STAGE ${nextStage} ACTIVATED`,
          weaponType,
          shotCooldown,
          progression: {
            ...prev.progression,
            currentStage: nextStage,
            timeInCurrentStage: 0,
            globalDifficultyMultiplier: multiplier,
            spawnCap,
            currentSpawnInterval: spawnInterval
          }
        }));
        setTimeout(() => setGameState(prev => ({ ...prev, showAlert: false })), 2000);
      } else {
        setGameState(prev => ({ ...prev, progression: { ...prev.progression, timeInCurrentStage: newTimeInStage } }));
      }

      const moveDir = new THREE.Vector3();
      const keys = engineRef.current.keysPressed;
      
      // forward vector points towards zombies (+Z when rotation is PI)
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, player.rotation.y, 0));
      // right vector for strafing
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
      }

      player.position.x = Math.max(-CORRIDOR_WIDTH / 2 + 1.5, Math.min(CORRIDOR_WIDTH / 2 - 1.5, player.position.x));

      setGameState(prev => {
        let newWallZ = prev.wallZ + prev.wallCurrentSpeed * (1 + (prev.progression.currentStage - 1) * 0.25) * delta;
        if (player.position.z - newWallZ > prev.wallMaxDistanceBehind) newWallZ = player.position.z - prev.wallMaxDistanceBehind;
        return { ...prev, wallZ: newWallZ };
      });
      setDistToWall(player.position.z - current.wallZ);

      engineRef.current.wallGroup.position.z = current.wallZ;
      if (player.position.z <= current.wallZ) handleGameOver();

      if (player.position.z - engineRef.current.segments[0].endZ > 10) {
        const old = engineRef.current.segments.shift()!;
        scene.remove(old.mesh);
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
        if (dist < 3.2 && performance.now() - current.lastDamageTime > current.zombieDamageInterval) {
          triggerDamageFlash();
          const newHp = current.hp - 15;
          if (newHp <= 0) handleGameOver(); else setGameState(prev => ({ ...prev, hp: newHp, lastDamageTime: performance.now() }));
        }
        return true;
      });

      weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, -0.6, 0.15); 
      setGameState(prev => ({ ...prev, distance: Math.floor(player.position.z) }));
      renderer.render(scene, camera);
    };
    animate();
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('mousemove', onMouseMove); };
  };

  const restartGame = () => {
    const { scene, zombies, player, camera, weaponGroup } = engineRef.current;
    isGameOverTriggered.current = false;
    zombies.forEach(z => scene.remove(z.mesh));
    engineRef.current.zombies = [];
    player.position.set(0, 4.2, 0);
    player.rotation.y = Math.PI; // Face forward (+Z)
    camera.rotation.x = 0;
    
    const toRemove = weaponGroup.children.filter(child => child instanceof THREE.Group);
    toRemove.forEach(child => weaponGroup.remove(child));
    weaponGroup.add(createWeaponModel('Standard'));

    if (bgMusicRef.current) { 
      bgMusicRef.current.currentTime = 0; 
      bgMusicRef.current.muted = isMutedRef.current;
      bgMusicRef.current.play().catch(() => {}); 
    }
    setGameState({ ...INITIAL_GAME_STATE, isGameActive: true, lastSpawnTime: performance.now() });
  };

  useEffect(() => { initEngine(); }, []);

  return (
    <div id="game-container" className={gameState.isGameActive && !gameState.isGameOver ? 'playing-active' : ''} ref={containerRef}>
      <audio ref={bgMusicRef} src="https://www.myinstants.com/media/sounds/hardcore-trance-8.mp3" loop style={{ display: 'none' }} />
      <div id="damage-flash" ref={flashRef} />
      
      <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
        <button className="btn" onClick={toggleMute} style={{ fontSize: '0.8rem', padding: '5px 15px' }}>
          {isMuted ? 'UNMUTE [M]' : 'MUTE [M]'}
        </button>
      </div>

      {!gameState.isGameActive && !gameState.isGameOver && (
        <div id="start-screen">
          <h1>ZOMBIE CORRIDOR</h1>
          <button className="btn" onClick={restartGame}>ENTER LOCKDOWN ZONE</button>
        </div>
      )}
      {gameState.isGameActive && <HUD state={gameState} distToWall={distToWall} />}
      {gameState.showAlert && (
        <div className="stage-alert">
          ALERT: {gameState.stageTitle}
          {gameState.weaponType !== 'Standard' && <div style={{ color: '#00ff66', fontSize: '1.5rem' }}>{gameState.weaponType.toUpperCase()} UNLOCKED</div>}
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
