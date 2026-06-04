
"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameState, INITIAL_GAME_STATE, ZOMBIE_CLASSES, ZombieType } from '@/lib/game-types';
import HUD from './HUD';
import GameOver from './GameOver';

// Constants
const SEGMENT_LENGTH = 30;
const CORRIDOR_WIDTH = 8;
const CORRIDOR_HEIGHT = 5;

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
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [distToWall, setDistToWall] = useState(20);
  
  // Engine Refs
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

    const pool = ['Walker', 'Walker', 'Walker', 'Runner', 'Runner', 'Tank', 'Elite'];
    const type = pool[Math.floor(Math.random() * pool.length)] as ZombieType;
    const stats = ZOMBIE_CLASSES[type];
    
    const statMultiplier = 1.0 + (current.stage - 1) * 0.19;
    const hp = Math.round(stats.baseHp * (1.0 + (current.stage - 1) * 0.1));
    const speed = stats.baseSpeed * statMultiplier;

    const group = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(0.7, stats.height, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: stats.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = stats.height / 2;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMat = new THREE.MeshStandardMaterial({ color: '#ddaa88' });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = stats.height + 0.1;
    group.add(head);

    const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const armMat = new THREE.MeshStandardMaterial({ color: stats.color });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.45, stats.height - 0.4, 0.3);
    leftArm.rotation.x = -Math.PI / 2;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.45, stats.height - 0.4, 0.3);
    rightArm.rotation.x = -Math.PI / 2;
    group.add(rightArm);

    group.position.set(
      (Math.random() - 0.5) * (CORRIDOR_WIDTH - 2),
      0,
      player.position.z + 28 + Math.random() * 37
    );

    const instance: ZombieInstance = {
      mesh: group,
      hp,
      speed,
      type,
      scoreValue: stats.scoreValue,
      isDead: false,
      lastAttackTime: 0,
      leftArm,
      rightArm
    };

    scene.add(group);
    zombies.push(instance);
  };

  const createSegment = (z: number) => {
    const group = new THREE.Group();
    const floorGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, SEGMENT_LENGTH);
    const wallGeo = new THREE.PlaneGeometry(SEGMENT_LENGTH, CORRIDOR_HEIGHT);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0d11 });

    const floor = new THREE.Mesh(floorGeo, metalMat);
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    const ceiling = new THREE.Mesh(floorGeo, wallMat);
    ceiling.position.y = CORRIDOR_HEIGHT;
    ceiling.rotation.x = Math.PI / 2;
    group.add(ceiling);

    const lWall = new THREE.Mesh(wallGeo, wallMat);
    lWall.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, 0);
    lWall.rotation.y = Math.PI / 2;
    group.add(lWall);

    const rWall = new THREE.Mesh(wallGeo, wallMat);
    rWall.position.set(CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, 0);
    rWall.rotation.y = -Math.PI / 2;
    group.add(rWall);

    const light = new THREE.PointLight(0xff003c, 0.8, 15);
    light.position.set(0, CORRIDOR_HEIGHT - 0.5, 0);
    group.add(light);

    group.position.z = z + SEGMENT_LENGTH / 2;
    engineRef.current.scene.add(group);
    
    return {
      mesh: group,
      startZ: z,
      endZ: z + SEGMENT_LENGTH
    };
  };

  const handleShoot = () => {
    const { raycaster, camera, scene, zombies, muzzleFlash, weaponGroup, particles } = engineRef.current;
    const current = stateRef.current;

    if (performance.now() < current.nextShotTime) return;
    
    setGameState(prev => ({ 
      ...prev, 
      nextShotTime: performance.now() + prev.shotCooldown 
    }));

    // Recoil
    weaponGroup.position.z = 0.15;
    weaponGroup.rotation.x = 0.2;

    // Muzzle Flash
    muzzleFlash.intensity = 3.5;
    setTimeout(() => muzzleFlash.intensity = 0, 60);

    // Hitscan
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const targets = zombies.filter(z => !z.isDead).map(z => z.mesh.children[0]);
    const intersects = raycaster.intersectObjects(targets);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const targetMesh = hit.object.parent as THREE.Group;
      const zombie = zombies.find(z => z.mesh === targetMesh);

      if (zombie) {
        zombie.hp -= 1;
        zombie.mesh.position.z += 1.5;

        // Hit Flash
        const originalMat = (hit.object as THREE.Mesh).material;
        (hit.object as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        setTimeout(() => {
          if (zombie && !zombie.isDead) (hit.object as THREE.Mesh).material = originalMat;
        }, 80);

        // Particles
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
          setGameState(prev => ({ ...prev, score: prev.score + zombie.scoreValue }));
          scene.remove(zombie.mesh);
        }
      }
    }
  };

  const initEngine = () => {
    const { scene, camera, player, weaponGroup, muzzleFlash, segments } = engineRef.current;
    
    if (engineRef.current.renderer) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current?.appendChild(renderer.domElement);
    engineRef.current.renderer = renderer;

    scene.background = new THREE.Color(0x050101);
    scene.fog = new THREE.FogExp2(0x050101, 0.05);

    const ambient = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambient);

    // Player setup
    player.position.set(0, 1.8, 0);
    player.add(camera);
    scene.add(player);

    // Weapon setup
    const gunGeo = new THREE.BoxGeometry(0.1, 0.1, 0.4);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0.3, -0.2, -0.4);
    weaponGroup.add(gun);
    
    muzzleFlash.position.set(0.3, -0.2, -0.6);
    weaponGroup.add(muzzleFlash);
    
    camera.add(weaponGroup);

    // Initial Segments
    for (let i = 0; i < 4; i++) {
      segments.push(createSegment(i * SEGMENT_LENGTH));
    }

    // Input
    window.addEventListener('keydown', (e) => engineRef.current.keysPressed[e.code] = true);
    window.addEventListener('keyup', (e) => engineRef.current.keysPressed[e.code] = false);
    
    containerRef.current?.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== containerRef.current) {
        containerRef.current?.requestPointerLock();
      } else {
        handleShoot();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === containerRef.current) {
        player.rotation.y -= e.movementX * 0.002;
        camera.rotation.x -= e.movementY * 0.002;
        camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
      }
    });

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = engineRef.current.clock.getDelta();
      const current = stateRef.current;

      if (!current.isGameActive || current.isGameOver) {
        renderer.render(scene, camera);
        return;
      }

      // 1. Difficulty Scaling
      if (performance.now() - current.lastStageUpdateTime > current.stageDuration) {
        setGameState(prev => ({
          ...prev,
          stage: prev.stage + 1,
          lastStageUpdateTime: performance.now(),
          currentSpawnInterval: Math.max(prev.minSpawnInterval, prev.baseSpawnInterval - (prev.stage * 250))
        }));
      }

      // 2. Player Movement
      const moveDir = new THREE.Vector3();
      const keys = engineRef.current.keysPressed;
      if (keys['KeyW']) moveDir.z -= 1;
      if (keys['KeyS']) moveDir.z += 1;
      if (keys['KeyA']) moveDir.x -= 1;
      if (keys['KeyD']) moveDir.x += 1;

      if (moveDir.length() > 0) {
        moveDir.normalize().applyEuler(new THREE.Euler(0, player.rotation.y, 0));
        player.position.add(moveDir.multiplyScalar(current.speed * delta));
        
        // Head Bob
        engineRef.current.bobTimer += delta * 12.0;
        camera.position.y = 1.8 + Math.sin(engineRef.current.bobTimer) * 0.08;
      } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.8, 0.1);
      }

      // Boundary Clamping
      player.position.x = Math.max(-3.7, Math.min(3.7, player.position.x));

      // 3. Wall Logic
      const wallSpeed = current.wallBaseSpeed + (current.stage * 0.4);
      setGameState(prev => {
        let newWallZ = prev.wallZ + wallSpeed * delta;
        if (player.position.z - newWallZ > prev.wallMaxDistanceBehind) {
          newWallZ = player.position.z - prev.wallMaxDistanceBehind;
        }
        return { ...prev, wallZ: newWallZ, wallCurrentSpeed: wallSpeed };
      });
      setDistToWall(player.position.z - current.wallZ);

      if (player.position.z <= current.wallZ) {
        setGameState(prev => ({ ...prev, hp: 0, isGameOver: true }));
        document.exitPointerLock();
      }

      // 4. Procedural Corridor
      if (player.position.z - engineRef.current.segments[0].endZ > 15) {
        const old = engineRef.current.segments.shift()!;
        scene.remove(old.mesh);
        old.mesh.traverse(obj => {
          if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
          if ((obj as THREE.Mesh).material) {
            const mat = (obj as THREE.Mesh).material;
            if (Array.isArray(mat)) mat.forEach(m => m.dispose());
            else mat.dispose();
          }
        });
        const last = engineRef.current.segments[engineRef.current.segments.length - 1];
        engineRef.current.segments.push(createSegment(last.endZ));
      }

      // 5. Spawning
      if (performance.now() - current.lastSpawnTime > current.currentSpawnInterval && engineRef.current.zombies.length < current.maxActiveZombies) {
        spawnZombie();
        setGameState(prev => ({ ...prev, lastSpawnTime: performance.now() }));
      }

      // 6. Zombie AI & Combat
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

        // Animation
        const armSwing = Math.sin(performance.now() * 0.005 * z.speed) * 0.4;
        z.leftArm.rotation.x = -Math.PI / 2 + armSwing;
        z.rightArm.rotation.x = -Math.PI / 2 - armSwing;

        // Damage
        if (dist < 1.6 && performance.now() - current.lastDamageTime > current.zombieDamageInterval) {
          triggerDamageFlash();
          setGameState(prev => {
            const newHp = prev.hp - 12;
            if (newHp <= 0) {
              document.exitPointerLock();
              return { ...prev, hp: 0, isGameOver: true, isGameActive: false };
            }
            return { ...prev, hp: newHp, lastDamageTime: performance.now() };
          });
        }
        return true;
      });

      // 7. Particles & Recoil
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

      weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, 0, 0.15);
      weaponGroup.rotation.x = THREE.MathUtils.lerp(weaponGroup.rotation.x, 0, 0.15);

      setGameState(prev => ({ ...prev, distance: Math.floor(player.position.z) }));

      renderer.render(scene, camera);
    };
    animate();
  };

  const restartGame = () => {
    const { scene, zombies, particles, segments, player } = engineRef.current;
    
    zombies.forEach(z => scene.remove(z.mesh));
    engineRef.current.zombies = [];
    
    particles.forEach(p => scene.remove(p.mesh));
    engineRef.current.particles = [];
    
    segments.forEach(s => scene.remove(s.mesh));
    engineRef.current.segments = [];
    
    player.position.set(0, 1.8, 0);
    for (let i = 0; i < 4; i++) {
      engineRef.current.segments.push(createSegment(i * SEGMENT_LENGTH));
    }

    setGameState({ 
      ...INITIAL_GAME_STATE, 
      isGameActive: true, 
      lastStageUpdateTime: performance.now(),
      lastSpawnTime: performance.now()
    });
  };

  useEffect(() => {
    initEngine();
  }, []);

  return (
    <div id="game-container" className={gameState.isGameActive && !gameState.isGameOver ? 'playing-active' : ''} ref={containerRef}>
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

      {gameState.isGameOver && (
        <GameOver 
          state={gameState} 
          review={null} // Analysis logic can be re-added here
          onRestart={restartGame} 
          onQuit={() => setGameState(INITIAL_GAME_STATE)} 
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
