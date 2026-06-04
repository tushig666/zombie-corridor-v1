
"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameState, INITIAL_GAME_STATE, ZombieType, ZOMBIE_DATA } from '@/lib/game-types';
import { zombieDifficultyScaler } from '@/ai/flows/zombie-difficulty-scaler';
import { postGamePerformanceReview, PostGamePerformanceReviewOutput } from '@/ai/flows/post-game-performance-review-flow';
import HUD from './HUD';
import GameOver from './GameOver';

const CORRIDOR_WIDTH = 6;
const CORRIDOR_HEIGHT = 4;
const SEGMENT_LENGTH = 10;
const COLLAPSE_WALL_SPEED = 1.8;
const SPAWN_DISTANCE = 40;
const DESPAWN_DISTANCE = 15;

export default function GameScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [gameStarted, setGameStarted] = useState(false);
  const [review, setReview] = useState<PostGamePerformanceReviewOutput | null>(null);
  
  // Refs for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const zombiesRef = useRef<Set<ZombieInstance>>(new Set());
  const bulletsRef = useRef<Set<BulletInstance>>(new Set());
  const corridorSegmentsRef = useRef<THREE.Mesh[]>([]);
  const collapseWallRef = useRef<THREE.Mesh | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const keysRef = useRef<Record<string, boolean>>({});
  const lastShotTimeRef = useRef(0);
  const statsRef = useRef({
    zombiesKilled: {} as Record<string, number>,
    totalDamageTaken: 0,
    shotsFired: 0,
    shotsHit: 0,
  });

  interface ZombieInstance {
    mesh: THREE.Group;
    hp: number;
    maxHp: number;
    speed: number;
    type: ZombieType;
    scoreReward: number;
    isDead: boolean;
  }

  interface BulletInstance {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    createdAt: number;
  }

  const resetGame = () => {
    setGameState({ ...INITIAL_GAME_STATE, startTime: Date.now() });
    setGameStarted(true);
    setReview(null);
    statsRef.current = {
      zombiesKilled: {},
      totalDamageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
    };
    
    if (sceneRef.current) {
      zombiesRef.current.forEach(z => sceneRef.current?.remove(z.mesh));
      zombiesRef.current.clear();
      bulletsRef.current.forEach(b => sceneRef.current?.remove(b.mesh));
      bulletsRef.current.clear();
      
      if (playerRef.current) {
        playerRef.current.position.set(0, 1.6, 0);
      }
      if (collapseWallRef.current) {
        collapseWallRef.current.position.z = -10;
      }
    }
  };

  const handleDifficultyScaling = async (current: GameState) => {
    const elapsed = (Date.now() - current.lastDifficultyAdjustment) / 1000;
    if (elapsed < 30) return; // Scale every 30 seconds

    try {
      const result = await zombieDifficultyScaler({
        distanceTraveled: current.distance,
        zombieKillCount: Object.values(statsRef.current.zombiesKilled).reduce((a, b) => a + b, 0),
        totalDamageTaken: statsRef.current.totalDamageTaken,
        timeSinceLastAdjustment: elapsed,
        lastSpawnRateModifier: current.difficultyModifiers.spawnRate,
        lastZombieSpeedModifier: current.difficultyModifiers.zombieSpeed,
        lastEliteChanceIncrease: current.difficultyModifiers.eliteChance
      });

      setGameState(prev => ({
        ...prev,
        level: prev.level + 1,
        lastDifficultyAdjustment: Date.now(),
        difficultyModifiers: {
          spawnRate: prev.difficultyModifiers.spawnRate * result.spawnRateModifierAdjustment,
          zombieSpeed: prev.difficultyModifiers.zombieSpeed * result.zombieSpeedModifierAdjustment,
          eliteChance: Math.min(0.5, prev.difficultyModifiers.eliteChance + result.eliteZombieChanceIncreaseAdjustment)
        }
      }));
    } catch (e) {
      console.error("Difficulty scaling failed", e);
    }
  };

  const createZombie = (zType: ZombieType, zPos: number) => {
    const stats = ZOMBIE_DATA[zType];
    const group = new THREE.Group();
    
    // Low-poly body
    const bodyGeo = new THREE.BoxGeometry(0.6, stats.height, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: stats.color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = stats.height / 2;
    group.add(body);

    // Head with features
    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshStandardMaterial({ color: '#ddaa88' });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = stats.height + 0.1;
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff0000' });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, stats.height + 0.15, 0.21);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.1, stats.height + 0.15, 0.21);
    group.add(eyeL, eyeR);

    // Mouth
    const mouthGeo = new THREE.BoxGeometry(0.2, 0.05, 0.05);
    const mouthMat = new THREE.MeshBasicMaterial({ color: '#330000' });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, stats.height + 0.05, 0.21);
    group.add(mouth);

    group.position.set((Math.random() - 0.5) * (CORRIDOR_WIDTH - 1.5), 0, zPos);
    
    const instance: ZombieInstance = {
      mesh: group,
      hp: stats.maxHealth,
      maxHp: stats.maxHealth,
      speed: stats.speed,
      type: zType,
      scoreReward: stats.scoreReward,
      isDead: false
    };

    sceneRef.current?.add(group);
    zombiesRef.current.add(instance);
  };

  const shoot = () => {
    if (!playerRef.current || !cameraRef.current || !sceneRef.current) return;
    
    const now = Date.now();
    if (now - lastShotTimeRef.current < 250) return;
    lastShotTimeRef.current = now;
    statsRef.current.shotsFired++;

    const bulletGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const bulletMat = new THREE.MeshBasicMaterial({ color: '#ffff00' });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(cameraRef.current.quaternion);
    
    bullet.position.copy(playerRef.current.position);
    bullet.position.y -= 0.2; // Offset from camera center to feel like a gun position

    bulletsRef.current.add({
      mesh: bullet,
      velocity: direction.multiplyScalar(50),
      createdAt: now
    });
    sceneRef.current.add(bullet);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialization
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0505);
    scene.fog = new THREE.FogExp2(0x0a0505, 0.035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    const player = new THREE.Group();
    player.add(camera);
    player.position.set(0, 1.6, 0);
    scene.add(player);
    playerRef.current = player;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xff0000, 0.2);
    scene.add(ambientLight);

    // Initial Corridor
    const createSegment = (z: number) => {
      const group = new THREE.Group();
      
      const floorGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, SEGMENT_LENGTH);
      const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      group.add(floor);

      const wallGeo = new THREE.PlaneGeometry(SEGMENT_LENGTH, CORRIDOR_HEIGHT);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a1a1a });
      
      const leftWall = new THREE.Mesh(wallGeo, wallMat);
      leftWall.position.set(-CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, 0);
      leftWall.rotation.y = Math.PI / 2;
      group.add(leftWall);

      const rightWall = new THREE.Mesh(wallGeo, wallMat);
      rightWall.position.set(CORRIDOR_WIDTH / 2, CORRIDOR_HEIGHT / 2, 0);
      rightWall.rotation.y = -Math.PI / 2;
      group.add(rightWall);

      const ceilingGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, SEGMENT_LENGTH);
      const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x110505 });
      const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
      ceiling.position.y = CORRIDOR_HEIGHT;
      ceiling.rotation.x = Math.PI / 2;
      group.add(ceiling);

      // Emergency LEDs
      const ledGeo = new THREE.BoxGeometry(0.1, 0.02, SEGMENT_LENGTH);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      
      const ledTL = new THREE.Mesh(ledGeo, ledMat);
      ledTL.position.set(-CORRIDOR_WIDTH/2 + 0.1, CORRIDOR_HEIGHT - 0.1, 0);
      group.add(ledTL);

      const ledTR = new THREE.Mesh(ledGeo, ledMat);
      ledTR.position.set(CORRIDOR_WIDTH/2 - 0.1, CORRIDOR_HEIGHT - 0.1, 0);
      group.add(ledTR);

      // Emergency Light Mesh
      const lightFixGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3);
      const lightFixMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const lightBulbMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      
      const fixture = new THREE.Mesh(lightFixGeo, lightFixMat);
      fixture.position.set(0, CORRIDOR_HEIGHT - 0.1, 0);
      fixture.rotation.z = Math.PI/2;
      group.add(fixture);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1), lightBulbMat);
      bulb.position.set(0, CORRIDOR_HEIGHT - 0.15, 0);
      group.add(bulb);

      const pointLight = new THREE.PointLight(0xff0000, 1.5, 8);
      pointLight.position.set(0, CORRIDOR_HEIGHT - 0.5, 0);
      group.add(pointLight);

      group.position.z = z;
      scene.add(group);
      return group as unknown as THREE.Mesh;
    };

    for (let i = 0; i < 10; i++) {
      corridorSegmentsRef.current.push(createSegment(i * SEGMENT_LENGTH));
    }

    // Collapse Wall
    const collapseWallGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, CORRIDOR_HEIGHT);
    const collapseWallMat = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      transparent: true, 
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const collapseWall = new THREE.Mesh(collapseWallGeo, collapseWallMat);
    collapseWall.position.set(0, CORRIDOR_HEIGHT / 2, -10);
    scene.add(collapseWall);
    collapseWallRef.current = collapseWall;

    // Input
    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse Look
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === containerRef.current && playerRef.current && cameraRef.current) {
        playerRef.current.rotation.y -= e.movementX * 0.002;
        cameraRef.current.rotation.x -= e.movementY * 0.002;
        cameraRef.current.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRef.current.rotation.x));
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    
    const onMouseDown = () => {
      if (document.pointerLockElement !== containerRef.current) {
        containerRef.current?.requestPointerLock();
      } else {
        shoot();
      }
    };
    containerRef.current.addEventListener('mousedown', onMouseDown);

    // Animation Loop
    let lastSpawnTime = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();

      if (!gameStarted || gameState.isGameOver) {
        renderer.render(scene, camera);
        return;
      }

      // Player Movement
      const moveSpeed = 5 * delta;
      const direction = new THREE.Vector3();
      if (keysRef.current['KeyW']) direction.z -= 1;
      if (keysRef.current['KeyS']) direction.z += 1;
      if (keysRef.current['KeyA']) direction.x -= 1;
      if (keysRef.current['KeyD']) direction.x += 1;
      
      direction.normalize().applyEuler(playerRef.current!.rotation);
      playerRef.current!.position.add(direction.multiplyScalar(moveSpeed));

      // Constrain player
      playerRef.current!.position.x = Math.max(-CORRIDOR_WIDTH/2 + 0.5, Math.min(CORRIDOR_WIDTH/2 - 0.5, playerRef.current!.position.x));
      
      // Collapse Wall Advance
      collapseWallRef.current!.position.z += COLLAPSE_WALL_SPEED * delta;
      
      // Check Collapse Damage
      const distToWall = playerRef.current!.position.z - collapseWallRef.current!.position.z;
      if (distToWall < 1.0) {
        setGameState(prev => ({ ...prev, hp: prev.hp - 100 * delta }));
      }

      // Zombie Spawning
      if (time - lastSpawnTime > 3 / gameState.difficultyModifiers.spawnRate) {
        lastSpawnTime = time;
        const zType = Math.random() < gameState.difficultyModifiers.eliteChance ? 'ELITE' : 
                      Math.random() < 0.1 ? 'TANK' : 
                      Math.random() < 0.3 ? 'RUNNER' : 'WALKER';
        createZombie(zType, playerRef.current!.position.z + SPAWN_DISTANCE);
      }

      // Zombie Logic
      zombiesRef.current.forEach(z => {
        if (z.isDead) return;
        
        // Move toward player
        const toPlayer = new THREE.Vector3().copy(playerRef.current!.position).sub(z.mesh.position);
        toPlayer.y = 0;
        toPlayer.normalize();
        z.mesh.position.add(toPlayer.multiplyScalar(z.speed * gameState.difficultyModifiers.zombieSpeed * delta));
        z.mesh.lookAt(playerRef.current!.position.x, 0, playerRef.current!.position.z);

        // Distance check
        const d = z.mesh.position.distanceTo(playerRef.current!.position);
        if (d < 1.2) {
          setGameState(prev => {
            const newHp = prev.hp - 20 * delta;
            statsRef.current.totalDamageTaken += 20 * delta;
            return { ...prev, hp: newHp };
          });
        }

        // Despawn
        if (z.mesh.position.z < playerRef.current!.position.z - DESPAWN_DISTANCE) {
          scene.remove(z.mesh);
          zombiesRef.current.delete(z);
        }
      });

      // Bullet Logic
      bulletsRef.current.forEach(b => {
        b.mesh.position.add(new THREE.Vector3().copy(b.velocity).multiplyScalar(delta));
        
        // Collision
        zombiesRef.current.forEach(z => {
          if (!z.isDead && b.mesh.position.distanceTo(z.mesh.position.clone().add(new THREE.Vector3(0, z.speed > 3 ? 0.8 : 1.0, 0))) < 1.0) {
            z.hp--;
            statsRef.current.shotsHit++;
            scene.remove(b.mesh);
            bulletsRef.current.delete(b);
            
            if (z.hp <= 0) {
              z.isDead = true;
              statsRef.current.zombiesKilled[z.type] = (statsRef.current.zombiesKilled[z.type] || 0) + 1;
              setGameState(prev => ({ ...prev, score: prev.score + z.scoreReward }));
              scene.remove(z.mesh);
              zombiesRef.current.delete(z);
            }
          }
        });

        if (Date.now() - b.createdAt > 2000) {
          scene.remove(b.mesh);
          bulletsRef.current.delete(b);
        }
      });

      // Corridor recycling
      corridorSegmentsRef.current.forEach(seg => {
        if (seg.position.z < playerRef.current!.position.z - SEGMENT_LENGTH * 2) {
          seg.position.z += corridorSegmentsRef.current.length * SEGMENT_LENGTH;
        }
      });

      // Update HUD state
      setGameState(prev => ({
        ...prev,
        distance: Math.floor(playerRef.current!.position.z)
      }));

      // Check Game Over
      if (gameState.hp <= 0 && !gameState.isGameOver) {
        setGameState(prev => ({ ...prev, isGameOver: true }));
        document.exitPointerLock();
        
        // Generate AI Review
        postGamePerformanceReview({
          zombiesKilled: statsRef.current.zombiesKilled,
          accuracy: (statsRef.current.shotsHit / (statsRef.current.shotsFired || 1)) * 100,
          distanceTraveled: Math.floor(playerRef.current!.position.z),
          survivalTime: Math.floor((Date.now() - gameState.startTime) / 1000),
          highestScore: gameState.score
        }).then(setReview);
      }

      handleDifficultyScaling(gameState);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      containerRef.current?.removeEventListener('mousedown', onMouseDown);
      renderer.dispose();
    };
  }, [gameStarted]);

  return (
    <div className="relative w-full h-screen overflow-hidden cursor-crosshair" ref={containerRef}>
      {!gameStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 z-50 text-center p-4">
          <h1 className="text-6xl font-bold text-primary mb-4 tracking-tighter">ZOMBIE CORRIDOR</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            Emergency lockdown in effect. Survive the endless facility. Don't let the collapse wall catch you.
          </p>
          <div className="flex flex-col gap-2 mb-8 text-left text-sm opacity-80 border-l-2 border-primary pl-4">
            <p>W, A, S, D — Move</p>
            <p>MOUSE — Look</p>
            <p>LEFT CLICK — Shoot</p>
          </div>
          <button 
            onClick={resetGame}
            className="px-8 py-3 bg-primary text-white font-bold rounded-sm hover:bg-accent transition-colors"
          >
            INITIALIZE SURVIVAL PROTOCOL
          </button>
        </div>
      )}

      {gameStarted && <HUD state={gameState} />}
      <div id="crosshair"></div>

      {gameState.isGameOver && (
        <GameOver 
          state={gameState} 
          review={review} 
          onRestart={resetGame} 
          onQuit={() => setGameStarted(false)} 
        />
      )}
      
      {/* Red Pulse Overlay when HP is low */}
      {gameStarted && gameState.hp < 30 && (
        <div className="absolute inset-0 pointer-events-none animate-pulse-red bg-primary/20 mix-blend-multiply z-10" />
      )}
    </div>
  );
}
