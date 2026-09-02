'use client';

// Mythic Hero Selection & 5 Territories Lobby Route (Alamat).
// iOS Human Interface Guidelines (HIG) + Google Play Mobile MOBA Standards.

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { HEROES, type Hero, heroHeight } from '@/game/heroes';
import { TERRITORIES, type Territory, DEFAULT_TERRITORY } from '@/game/territories';
import { createActor, type Actor } from '@/game/render3d/actor';
import { sound } from '@/game/audio/synth';
import { loadPlayerProfile, getRankForLevel, type PlayerProfile } from '@/game/progression/profile';
import { android } from '@/game/platform/android';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function HeroSelectionLobby() {
  const [activeTab, setActiveTab] = useState<'heroes' | 'territories'>('heroes');
  const [selectedHero, setSelectedHero] = useState<Hero>(HEROES[0]);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory>(DEFAULT_TERRITORY);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedMode, setSelectedMode] = useState<'classic' | 'duel' | 'raid'>('classic');
  const [activeStoryChapter, setActiveStoryChapter] = useState<number>(1);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [playerProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      } catch {
        setShowInstallGuide(true);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  const playableHeroes = HEROES.filter((h) => h.model);
  const filteredHeroes =
    selectedRole === 'all'
      ? playableHeroes
      : playableHeroes.filter((h) => h.role.toLowerCase() === selectedRole.toLowerCase());

  // Gamepad Navigation in Lobby
  useEffect(() => {
    let gpRaf = 0;
    let lastNav = 0;
    const pollLobbyGamepad = () => {
      gpRaf = requestAnimationFrame(pollLobbyGamepad);
      const gp = android.pollGamepad();
      if (!gp.connected) return;
      const now = performance.now();
      if (now - lastNav < 220) return;

      if (gp.moveX > 0.4 || gp.aimX > 0.4 || gp.pingOmw) {
        lastNav = now;
        setSelectedHero((prev) => {
          const idx = playableHeroes.findIndex((h) => h.id === prev.id);
          const nextIdx = (idx + 1) % playableHeroes.length;
          sound.playPing('select');
          return playableHeroes[nextIdx];
        });
      } else if (gp.moveX < -0.4 || gp.aimX < -0.4 || gp.pingRetreat) {
        lastNav = now;
        setSelectedHero((prev) => {
          const idx = playableHeroes.findIndex((h) => h.id === prev.id);
          const prevIdx = (idx - 1 + playableHeroes.length) % playableHeroes.length;
          sound.playPing('select');
          return playableHeroes[prevIdx];
        });
      }
    };
    gpRaf = requestAnimationFrame(pollLobbyGamepad);
    return () => cancelAnimationFrame(gpRaf);
  }, [playableHeroes]);

  // 3D Turntable Scene with Studio Lighting & Adjusted Framing
  useEffect(() => {
    if (activeTab !== 'heroes') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let actor: Actor | null = null;
    let raf = 0;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    const scene = new THREE.Scene();
    // Optimized camera framing: centers hero torso and head with proper headroom
    const camera = new THREE.PerspectiveCamera(36, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 1.25, 4.3);
    camera.lookAt(0, 0.95, 0);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0x38bdf8, 1.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 3.8);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 4.2);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    const goldLight = new THREE.PointLight(0xffb300, 3.5, 12);
    goldLight.position.set(0, 0.2, 0);
    scene.add(goldLight);

    // Carved Stone Pedestal Disk
    const plinthGeom = new THREE.CylinderGeometry(1.4, 1.6, 0.2, 32);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const plinth = new THREE.Mesh(plinthGeom, plinthMat);
    plinth.position.y = -0.1;
    scene.add(plinth);

    // Glowing Rune Ring on Pedestal
    const ringGeom = new THREE.RingGeometry(1.2, 1.35, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.position.y = 0.01;
    scene.add(ringMesh);

    // Load Skinned Mesh
    if (selectedHero.model) {
      createActor({
        ...selectedHero.model,
        height: heroHeight(selectedHero.build.scale) * 0.54,
      }).then((a) => {
        if (disposed) {
          a.dispose();
          return;
        }
        actor = a;
        a.setPosition(0, 0, 0);
        a.play('idle');
        scene.add(a.object);
      });
    }

    let clock = 0;
    const renderLoop = () => {
      raf = requestAnimationFrame(renderLoop);
      clock += 0.016;

      if (actor) {
        actor.setFacing(clock * 0.4);
        actor.update(0.016);
      }
      ringMesh.rotation.y = -clock * 0.2;
      renderer.render(scene, camera);
    };
    renderLoop();

    const handleResize = () => {
      if (!canvas) return;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      actor?.dispose();
      plinthGeom.dispose();
      plinthMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, [selectedHero, activeTab]);

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  return (
    <div style={lobbyContainer}>
      {/* Sleek Modern Esports Glass Navigation Bar */}
      <header className="lobby-topbar" style={topHeader}>
        {/* Left: Brand Identity */}
        <div style={brandCol}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={brandIconWrap}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFD700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6-6" />
                <path d="M16 16l4 4" />
                <path d="M19 21l2-2" />
                <path d="M14.5 6.5L18 3h3v3l-3.5 3.5" />
                <path d="M5 14l4 4" />
                <path d="M7 17l-4 4" />
                <path d="M3 19l2 2" />
              </svg>
            </div>
            <div>
              <h1 style={brandTitle}>ALAMAT</h1>
              <span className="lobby-tagline" style={brandSubtitle}>MYTHOLOGY MOBA</span>
            </div>
          </div>
        </div>

        {/* Center: Clean Segmented Tab Switcher */}
        <div style={masterSegmentedControl}>
          <button
            style={{
              ...segmentedTabBtn,
              background: activeTab === 'heroes' ? 'rgba(255, 215, 0, 0.16)' : 'transparent',
              color: activeTab === 'heroes' ? '#FFD700' : '#94A3B8',
              borderColor: activeTab === 'heroes' ? 'rgba(255, 215, 0, 0.35)' : 'transparent',
              boxShadow: activeTab === 'heroes' ? '0 2px 10px rgba(0,0,0,0.3), inset 0 0 8px rgba(255,215,0,0.1)' : 'none',
            }}
            onClick={() => {
              setActiveTab('heroes');
              sound.playPing('select');
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>CHAMPIONS</span>
          </button>
          <button
            style={{
              ...segmentedTabBtn,
              background: activeTab === 'territories' ? 'rgba(0, 229, 255, 0.16)' : 'transparent',
              color: activeTab === 'territories' ? '#00E5FF' : '#94A3B8',
              borderColor: activeTab === 'territories' ? 'rgba(0, 229, 255, 0.35)' : 'transparent',
              boxShadow: activeTab === 'territories' ? '0 2px 10px rgba(0,0,0,0.3), inset 0 0 8px rgba(0,229,255,0.1)' : 'none',
            }}
            onClick={() => {
              setActiveTab('territories');
              sound.playPing('onmyway');
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            <span>5 REALMS</span>
          </button>
        </div>

        {/* Right: Uncluttered Profile, Install Icon & Play Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {playerProfile ? (
            <div style={profileCapsule} title={`${playerProfile.name} · ${getRankForLevel(playerProfile.accountLevel).title}`}>
              <div style={profileAvatarCircle}>
                {getRankForLevel(playerProfile.accountLevel).badgeEmoji}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F8FAFC', letterSpacing: 0.2, lineHeight: 1.2 }}>
                    {playerProfile.name}
                  </span>
                  <span style={lvlBadge}>
                    LVL {playerProfile.accountLevel}
                  </span>
                </div>
                <span style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600, letterSpacing: 0.3, lineHeight: 1.1 }}>
                  {getRankForLevel(playerProfile.accountLevel).title}
                </span>
              </div>
            </div>
          ) : null}

          {/* Familiar App Install Icon Button */}
          <button
            className="lobby-install-btn"
            style={pwaInstallIconBtn}
            onClick={handleInstallApp}
            title="Install App (PWA)"
            aria-label="Install App"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span style={pwaDotIndicator} />
          </button>

          {/* Quick Play CTA */}
          <Link
            href={`/play?hero=${selectedHero.id}&territory=${selectedTerritory.id}&mode=${selectedMode}`}
            style={quickPlayHeaderBtn}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>PLAY</span>
            <span style={modePillTag}>{selectedMode.toUpperCase()}</span>
          </Link>
        </div>
      </header>

      {/* VIEW 1: HEROES ROSTER VIEW */}
      {activeTab === 'heroes' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* iOS Role Filters & Realm Bar */}
          <div className="lobby-filters" style={filterSubheader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, paddingRight: 4, letterSpacing: 0.5 }}>ROLE:</span>
              {['all', 'vanguard', 'mystic', 'stalker', 'warden', 'ranger'].map((r) => {
                const isActive = selectedRole === r;
                return (
                  <button
                    key={r}
                    style={{
                      ...roleFilterPill,
                      background: isActive ? 'rgba(255, 215, 0, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                      borderColor: isActive ? '#FFD700' : 'rgba(255, 255, 255, 0.1)',
                      color: isActive ? '#FFD700' : '#CBD5E1',
                      boxShadow: isActive ? '0 0 10px rgba(255, 215, 0, 0.3)' : 'none',
                    }}
                    onClick={() => setSelectedRole(r)}
                  >
                    {r.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: '#00E5FF', fontWeight: 700 }}>REALM:</span>
              <select
                value={selectedTerritory.id}
                onChange={(e) => {
                  const t = TERRITORIES.find((item) => item.id === e.target.value);
                  if (t) setSelectedTerritory(t);
                }}
                style={territoryDropdown}
              >
                {TERRITORIES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <main className="lobby-main-grid" style={mainGrid}>
            {/* 1. Champion Selector Rail (Left / Top) */}
            <section className="lobby-roster" style={rosterSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={sectionTitle}>CHAMPIONS ({filteredHeroes.length})</h2>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Select to preview</span>
              </div>
              <div className="lobby-hero-list" style={heroCardList}>
                {filteredHeroes.map((h) => {
                  const isSelected = h.id === selectedHero.id;
                  const roleColor = getRoleColor(h.role);
                  return (
                    <div
                      key={h.id}
                      className="lobby-hero-card"
                      style={{
                        ...heroCard,
                        borderColor: isSelected ? '#FFD700' : 'rgba(255,255,255,0.1)',
                        background: isSelected
                          ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(15, 23, 42, 0.85))'
                          : 'rgba(15, 23, 42, 0.65)',
                        boxShadow: isSelected ? '0 0 16px rgba(255, 215, 0, 0.35)' : 'none',
                      }}
                      onClick={() => {
                        setSelectedHero(h);
                        sound.playPing('select');
                      }}
                    >
                      {h.portrait ? (
                        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                          <img
                            src={h.portrait}
                            alt={h.name}
                            width={44}
                            height={44}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              objectFit: 'cover',
                              border: `1.5px solid ${isSelected ? '#FFD700' : 'rgba(255,255,255,0.15)'}`,
                              background: 'rgba(255,255,255,0.06)',
                            }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: 30, flexShrink: 0 }}>{h.emoji}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <strong style={{ color: isSelected ? '#FFD700' : '#F8FAFC', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.name}
                          </strong>
                          <span style={{ ...roleBadge, background: roleColor }}>
                            {h.role.toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {h.title || h.origin}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. Center 3D Interactive Turntable Preview */}
            <section className="lobby-turntable" style={previewSection}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              
              {/* Glassmorphic Nameplate & Attribute Gauges Overlay */}
              <div className="lobby-nameplate" style={turntableOverlay}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <span style={heroOriginBadge}>{selectedHero.title || selectedHero.origin}</span>
                    <h2 style={heroDisplayName}>{selectedHero.name.toUpperCase()}</h2>
                  </div>
                  <span style={{ ...roleBadgeLarge, background: getRoleColor(selectedHero.role) }}>
                    {selectedHero.role.toUpperCase()}
                  </span>
                </div>

                {selectedHero.quote && (
                  <p className="lobby-quote" style={heroQuoteText}>
                    &ldquo;{selectedHero.quote}&rdquo;
                  </p>
                )}

                {/* Visual Power Attribute Gauges */}
                <div style={statGaugesContainer}>
                  {/* Health Gauge */}
                  <div style={statGaugeItem}>
                    <div style={statGaugeLabelRow}>
                      <span style={{ color: '#4ADE80', fontSize: 10.5, fontWeight: 700 }}>❤️ HP</span>
                      <span style={{ color: '#F8FAFC', fontSize: 10.5, fontWeight: 800 }}>{selectedHero.health}</span>
                    </div>
                    <div style={statTrack}>
                      <div style={{ ...statFill, width: `${Math.min(100, (selectedHero.health / 1200) * 100)}%`, background: 'linear-gradient(90deg, #10B981, #4ADE80)' }} />
                    </div>
                  </div>

                  {/* Attack Gauge */}
                  <div style={statGaugeItem}>
                    <div style={statGaugeLabelRow}>
                      <span style={{ color: '#F87171', fontSize: 10.5, fontWeight: 700 }}>⚔️ ATK</span>
                      <span style={{ color: '#F8FAFC', fontSize: 10.5, fontWeight: 800 }}>{selectedHero.attack}</span>
                    </div>
                    <div style={statTrack}>
                      <div style={{ ...statFill, width: `${Math.min(100, (selectedHero.attack / 80) * 100)}%`, background: 'linear-gradient(90deg, #EF4444, #F87171)' }} />
                    </div>
                  </div>

                  {/* Speed Gauge */}
                  <div style={statGaugeItem}>
                    <div style={statGaugeLabelRow}>
                      <span style={{ color: '#38BDF8', fontSize: 10.5, fontWeight: 700 }}>💨 SPD</span>
                      <span style={{ color: '#F8FAFC', fontSize: 10.5, fontWeight: 800 }}>{selectedHero.speed}</span>
                    </div>
                    <div style={statTrack}>
                      <div style={{ ...statFill, width: `${Math.min(100, (selectedHero.speed / 8.0) * 100)}%`, background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }} />
                    </div>
                  </div>

                  {/* Range Gauge */}
                  <div style={statGaugeItem}>
                    <div style={statGaugeLabelRow}>
                      <span style={{ color: '#C084FC', fontSize: 10.5, fontWeight: 700 }}>🎯 REACH</span>
                      <span style={{ color: '#F8FAFC', fontSize: 10.5, fontWeight: 800 }}>{selectedHero.attackRange}u</span>
                    </div>
                    <div style={statTrack}>
                      <div style={{ ...statFill, width: `${Math.min(100, (selectedHero.attackRange / 10.0) * 100)}%`, background: 'linear-gradient(90deg, #9333EA, #C084FC)' }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Hero Dossier & Abilities Showcase (Right / Bottom) */}
            <section className="lobby-dossier" style={dossierSection}>
              {/* Folklore Lore Card */}
              <div style={loreBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h3 style={loreHeader}>📜 FOLKLORE DOSSIER</h3>
                  <span style={{ fontSize: 11, color: '#FFD700', fontStyle: 'italic' }}>
                    {selectedHero.baybayin || ''}
                  </span>
                </div>
                <p style={loreText}>{selectedHero.lore}</p>
              </div>

              {/* Skillshot & Passive Arsenal */}
              <div style={abilitiesBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={loreHeader}>⚡ ABILITY ARSENAL</h3>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Aimed Combat Kit</span>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {/* Innate Mythic Passive Card */}
                  {selectedHero.passive && (
                    <div style={{ ...abilityCard, borderColor: 'rgba(0, 229, 255, 0.35)', background: 'rgba(6, 78, 59, 0.35)' }}>
                      <div style={abilityIconWrapper}>
                        <span style={{ fontSize: 22 }}>{selectedHero.passive.emoji}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#5EEAD4', fontSize: 13 }}>
                            {selectedHero.passive.name}
                          </strong>
                          <span style={{ ...abilityShapeTag, background: '#0D9488', color: '#FFF' }}>PASSIVE</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#CCFBF1', margin: '3px 0 0', lineHeight: 1.4 }}>
                          {selectedHero.passive.blurb}
                        </p>
                        <div style={{ marginTop: 4, fontSize: 10, color: '#5EEAD4', fontWeight: 700 }}>
                          ⚡ {selectedHero.passive.effect}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Skill 1, 2, 3 */}
                  {selectedHero.abilities.map((ab, idx) => (
                    <div key={ab.id} style={abilityCard}>
                      <div style={abilityIconWrapper}>
                        <span style={{ fontSize: 20 }}>{ab.emoji}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#F1F5F9', fontSize: 13 }}>
                            Skill {idx + 1}: {ab.name}
                          </strong>
                          <span style={abilityShapeTag}>{ab.shape.toUpperCase()}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '3px 0 0', lineHeight: 1.4 }}>
                          {ab.blurb}
                        </p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: '#CBD5E1' }}>
                          <span style={statBadgeSmall}>💥 {ab.damage} Dmg</span>
                          <span style={statBadgeSmall}>⏳ {ab.cooldown}s CD</span>
                          <span style={statBadgeSmall}>📏 {ab.range}u Range</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Ultimate Showcase */}
                  <div style={{ ...abilityCard, borderColor: 'rgba(255, 215, 0, 0.45)', background: 'linear-gradient(135deg, rgba(120, 53, 15, 0.35), rgba(15, 23, 42, 0.7))' }}>
                    <div style={{ ...abilityIconWrapper, borderColor: 'rgba(255, 215, 0, 0.6)', background: 'rgba(217, 119, 6, 0.3)' }}>
                      <span style={{ fontSize: 24 }}>{selectedHero.ultimate.emoji}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#FFD700', fontSize: 13.5 }}>
                          ULTIMATE: {selectedHero.ultimate.name}
                        </strong>
                        <span style={{ ...abilityShapeTag, background: '#D97706', color: '#FFF' }}>
                          {selectedHero.ultimate.shape.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#FEF08A', margin: '3px 0 0', lineHeight: 1.4 }}>
                        {selectedHero.ultimate.blurb}
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: '#FDE68A' }}>
                        <span style={{ ...statBadgeSmall, borderColor: 'rgba(255, 215, 0, 0.3)' }}>💥 {selectedHero.ultimate.damage} Dmg</span>
                        <span style={{ ...statBadgeSmall, borderColor: 'rgba(255, 215, 0, 0.3)' }}>⏳ {selectedHero.ultimate.cooldown}s CD</span>
                        <span style={{ ...statBadgeSmall, borderColor: 'rgba(255, 215, 0, 0.3)' }}>📏 {selectedHero.ultimate.range}u Range</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Game Mode Selection Switcher */}
              <div style={{ marginTop: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.5 }}>
                    🎮 URI NG LABANAN (GAME MODE):
                  </span>
                  <span style={{ fontSize: 10, color: '#FFD700', fontWeight: 700 }}>
                    {selectedMode === 'classic' ? '5v5 Classic MOBA' : selectedMode === 'duel' ? '1v1 Ancestral Duel' : 'PvE Monster Raid'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'classic', icon: '⚔️', label: '5v5 CLASSIC', sub: '3-Lane Conquest' },
                    { id: 'duel', icon: '🤺', label: '1v1 DUEL', sub: 'Mid Ancestral Duel' },
                    { id: 'raid', icon: '🐉', label: 'MONSTER RAID', sub: '5-Wave Survival' },
                  ].map((m) => {
                    const isSelected = selectedMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedMode(m.id as 'classic' | 'duel' | 'raid');
                          sound.playPing('select');
                        }}
                        style={{
                          padding: '8px 6px',
                          borderRadius: 10,
                          border: isSelected ? '1.5px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.12)',
                          background: isSelected ? 'rgba(255, 215, 0, 0.2)' : 'rgba(15, 23, 42, 0.7)',
                          color: isSelected ? '#FFD700' : '#CBD5E1',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                          transition: 'all 120ms ease',
                          boxShadow: isSelected ? '0 0 12px rgba(255, 215, 0, 0.25)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{m.icon}</span>
                        <strong style={{ fontSize: 10.5, letterSpacing: 0.5 }}>{m.label}</strong>
                        <span style={{ fontSize: 8.5, color: isSelected ? '#FEF08A' : '#64748B' }}>{m.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Fixed Launch Button */}
              <Link
                href={`/play?hero=${selectedHero.id}&territory=${selectedTerritory.id}&mode=${selectedMode}`}
                style={launchPlayBtn}
              >
                <span>⚔️ DEPLOY TO {selectedTerritory.name.toUpperCase()} · {selectedMode.toUpperCase()}</span>
              </Link>
            </section>
          </main>
        </div>
      )}

      {/* VIEW 2: 5 TERRITORIES & CULTURES SHOWCASE VIEW */}
      {activeTab === 'territories' && (
        <div style={territoriesViewContainer}>
          {/* Territory Selector Cards Bar */}
          <div className="lobby-territory-picker" style={territoryCardsBar}>
            {TERRITORIES.map((t) => {
              const isSelected = t.id === selectedTerritory.id;
              return (
                <div
                  key={t.id}
                  style={{
                    ...territorySelectorCard,
                    borderColor: isSelected ? t.atmosphere.primaryColor : 'rgba(255,255,255,0.12)',
                    boxShadow: isSelected ? `0 0 20px ${t.atmosphere.accentGlow}` : 'none',
                    background: isSelected
                      ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))'
                      : 'rgba(15, 23, 42, 0.65)',
                  }}
                  onClick={() => {
                    setSelectedTerritory(t);
                    setActiveStoryChapter(1);
                    sound.playPing('select');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: t.atmosphere.primaryColor, letterSpacing: 3 }}>
                    </span>
                    <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>
                      {t.media.cinematicDuration}s 4K
                    </span>
                  </div>
                  <strong style={{ fontSize: 15, color: '#FFF', display: 'block', marginTop: 4 }}>
                    {t.name}
                  </strong>
                  <span style={{ fontSize: 10.5, color: '#94A3B8', display: 'block', marginTop: 2 }}>
                    {t.region.split('/')[0]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Territory Deep Dive Grid */}
          <div className="lobby-territory-grid" style={territoryDetailGrid}>
            {/* Left: Cinematic Video Player & Media Preview */}
            <div style={videoPlayerContainer}>
              <div style={videoWrapper}>
                <video
                  ref={videoRef}
                  src={selectedTerritory.media.videoUrl}
                  poster={selectedTerritory.media.imageUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={videoElement}
                />
                <div style={videoOverlayControls}>
                  <button onClick={toggleVideoPlayback} style={videoControlBtn}>
                    {isVideoPlaying ? '⏸️ PAUSE' : '▶️ PLAY TRAILER'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#FFD700', fontWeight: 700 }}>
                      ✨ HIGGSFIELD CINEMA 4K
                    </span>
                  </div>
                </div>
              </div>

              {/* Territory Banner Info */}
              <div style={territoryHeaderCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={territoryBigTitle}>{selectedTerritory.name.toUpperCase()}</h2>
                    <span style={{ fontSize: 12, color: '#00E5FF', fontWeight: 600 }}>
                      {selectedTerritory.title}
                    </span>
                  </div>
                  <span style={{ ...atmosphereBadge, borderColor: selectedTerritory.atmosphere.primaryColor }}>
                    {selectedTerritory.atmosphere.weatherEffect}
                  </span>
                </div>

                <p style={territoryQuote}>&ldquo;{selectedTerritory.quote}&rdquo;</p>
                <p style={territoryLoreParagraph}>{selectedTerritory.lore}</p>

                {/* Blessing Card */}
                <div style={{ ...blessingBox, borderColor: selectedTerritory.atmosphere.primaryColor }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>🌟</span>
                    <strong style={{ color: selectedTerritory.atmosphere.primaryColor, fontSize: 13 }}>
                      TERRITORY BLESSING: {selectedTerritory.blessingName.toUpperCase()}
                    </strong>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#E2E8F0', margin: '4px 0 0' }}>
                    {selectedTerritory.blessingEffect}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Cultural Lore, Story Beats, & Sacred Artifacts */}
            <div style={cultureColumn}>
              {/* Story Chapters Breakdown */}
              <div style={storySectionCard}>
                <h3 style={cultureSectionTitle}>📜 MYTHOLOGICAL STORY CHAPTERS</h3>
                <div style={storyChapterTabs}>
                  {selectedTerritory.storyBeats.map((beat) => (
                    <button
                      key={beat.chapter}
                      style={{
                        ...storyChapterBtn,
                        background: activeStoryChapter === beat.chapter ? 'rgba(255, 215, 0, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                        borderColor: activeStoryChapter === beat.chapter ? '#FFD700' : 'rgba(255,255,255,0.1)',
                        color: activeStoryChapter === beat.chapter ? '#FFD700' : '#94A3B8',
                      }}
                      onClick={() => setActiveStoryChapter(beat.chapter)}
                    >
                      CHAPTER {beat.chapter}
                    </button>
                  ))}
                </div>

                {selectedTerritory.storyBeats.find((b) => b.chapter === activeStoryChapter) && (
                  <div style={activeStoryContent}>
                    <strong style={{ color: '#F1F5F9', fontSize: 14 }}>
                      {selectedTerritory.storyBeats.find((b) => b.chapter === activeStoryChapter)?.title}
                    </strong>
                    <p style={{ fontSize: 12.5, color: '#CBD5E1', lineHeight: 1.6, marginTop: 6 }}>
                      {selectedTerritory.storyBeats.find((b) => b.chapter === activeStoryChapter)?.narrative}
                    </p>
                  </div>
                )}
              </div>

              {/* Cultural Traditions & Beliefs */}
              <div style={cultureSectionCard}>
                <h3 style={cultureSectionTitle}>🏛️ PRE-COLONIAL CULTURAL HERITAGE</h3>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <div style={cultureFactBox}>
                    <strong style={{ color: '#00E5FF', fontSize: 12 }}>🎭 Sacred Traditions & Rituals:</strong>
                    <p style={{ fontSize: 11.5, color: '#CBD5E1', margin: '2px 0 0', lineHeight: 1.4 }}>
                      {selectedTerritory.culture.traditions}
                    </p>
                  </div>

                  <div style={cultureFactBox}>
                    <strong style={{ color: '#5EEAD4', fontSize: 12 }}>✨ Spiritual Beliefs & Deities:</strong>
                    <p style={{ fontSize: 11.5, color: '#CBD5E1', margin: '2px 0 0', lineHeight: 1.4 }}>
                      {selectedTerritory.culture.spiritualBeliefs}
                    </p>
                  </div>

                  <div style={cultureFactBox}>
                    <strong style={{ color: '#FDE68A', fontSize: 12 }}>🌏 Regional Lineage:</strong>
                    <p style={{ fontSize: 11.5, color: '#CBD5E1', margin: '2px 0 0', lineHeight: 1.4 }}>
                      {selectedTerritory.culture.regionalInfluence}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sacred Artifacts of this Realm */}
              <div style={cultureSectionCard}>
                <h3 style={cultureSectionTitle}>🗡️ SACRED REALM ARTIFACTS</h3>
                <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                  {selectedTerritory.culture.sacredArtifacts.map((art, idx) => (
                    <div key={idx} style={artifactItem}>
                      <span style={{ fontSize: 16 }}>🛡️</span>
                      <span style={{ fontSize: 12, color: '#F8FAFC', fontWeight: 600 }}>{art}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Associated Champions */}
              <div style={cultureSectionCard}>
                <h3 style={cultureSectionTitle}>👥 ASSOCIATED CHAMPIONS</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {selectedTerritory.associatedHeroIds.map((hId) => {
                    const heroObj = HEROES.find((h) => h.id === hId);
                    if (!heroObj) return null;
                    return (
                      <button
                        key={hId}
                        style={{
                          ...associatedHeroTag,
                          borderColor: selectedHero.id === hId ? '#FFD700' : 'rgba(255,255,255,0.15)',
                        }}
                        onClick={() => {
                          setSelectedHero(heroObj);
                          setActiveTab('heroes');
                          sound.playPing('select');
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{heroObj.emoji}</span>
                        <span style={{ fontSize: 12, color: '#FFF', fontWeight: 700 }}>{heroObj.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Launch Arena in this Territory */}
              <Link
                href={`/play?hero=${selectedHero.id}&territory=${selectedTerritory.id}&mode=${selectedMode}`}
                style={{
                  ...launchPlayBtn,
                  background: `linear-gradient(135deg, ${selectedTerritory.atmosphere.primaryColor}, #B45309)`,
                }}
              >
                <span>⚔️ DEPLOY {selectedHero.name.toUpperCase()} TO {selectedTerritory.name.toUpperCase()} ({selectedMode.toUpperCase()})</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* iOS / Mobile Installation Guide Modal */}
      {showInstallGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1E293B, #0F172A)',
              border: '1.5px solid rgba(255, 215, 0, 0.45)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 460,
              width: '100%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 22 }}>📱</span>
                <strong style={{ fontSize: 17, color: '#FFD700' }}>Install Alamat Mobile App</strong>
              </div>
              <button
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#CBD5E1',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
                onClick={() => setShowInstallGuide(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.75)', borderRadius: 14, padding: 14, border: '1px solid rgba(0, 229, 255, 0.3)' }}>
                <strong style={{ color: '#00E5FF', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🍏</span> Apple iOS (Safari):
                </strong>
                <ol style={{ fontSize: 12, color: '#CBD5E1', paddingLeft: 20, marginTop: 8, lineHeight: 1.6 }}>
                  <li>Tap the <strong>Share icon (⎋ / 🔲⬆)</strong> at bottom/top.</li>
                  <li>Scroll and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</li>
                  <li>Tap <strong>&ldquo;Add&rdquo;</strong> to launch with native fullscreen performance.</li>
                </ol>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.75)', borderRadius: 14, padding: 14, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <strong style={{ color: '#10B981', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🤖</span> Android (Google Play / Chrome):
                </strong>
                <p style={{ fontSize: 12, color: '#CBD5E1', marginTop: 6, lineHeight: 1.5 }}>
                  Open Chrome options (⋮) and tap <strong>&ldquo;Install App&rdquo;</strong> for zero-latency 60FPS esports gameplay.
                </p>
              </div>

              <button
                style={{
                  background: 'linear-gradient(135deg, #D97706, #B45309)',
                  border: '1.5px solid #FDE68A',
                  color: '#FFF',
                  padding: '12px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  marginTop: 6,
                  boxShadow: '0 4px 16px rgba(217, 119, 6, 0.5)',
                }}
                onClick={() => setShowInstallGuide(false)}
              >
                Proceed to Arena ⚔️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRoleColor(role: string): string {
  switch (role.toLowerCase()) {
    case 'vanguard':
      return '#D97706';
    case 'mystic':
      return '#8B5CF6';
    case 'stalker':
      return '#EF4444';
    case 'warden':
      return '#10B981';
    case 'ranger':
      return '#0284C7';
    default:
      return '#64748B';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CSS IN JS STYLING (iOS HIG + MOBA LOBBY UI)
// ══════════════════════════════════════════════════════════════════════════════

const lobbyContainer: React.CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: 'radial-gradient(ellipse at 50% 20%, #1E293B 0%, #0B1120 60%, #020617 100%)',
  color: '#F8FAFC',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-system)',
  overflowX: 'hidden',
};

const topHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: 'calc(var(--safe-top) + 54px)',
  padding: 'var(--safe-top) 24px 0 24px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  background: 'rgba(11, 17, 32, 0.88)',
  backdropFilter: 'blur(20px) saturate(180%)',
  zIndex: 20,
};

const brandCol: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const brandIconWrap: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(245, 158, 11, 0.05))',
  border: '1px solid rgba(255, 215, 0, 0.3)',
  display: 'grid',
  placeItems: 'center',
  boxShadow: '0 0 10px rgba(255, 215, 0, 0.15)',
};

const brandTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: 1.8,
  margin: 0,
  lineHeight: 1,
  color: '#FFF',
  textShadow: '0 0 12px rgba(255, 215, 0, 0.4)',
};

const brandSubtitle: React.CSSProperties = {
  fontSize: 8,
  color: '#64748B',
  letterSpacing: 1.2,
  fontWeight: 700,
  lineHeight: 1,
  marginTop: 2,
};

const masterSegmentedControl: React.CSSProperties = {
  display: 'flex',
  background: 'rgba(15, 23, 42, 0.65)',
  padding: 3,
  borderRadius: 999,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  gap: 2,
};

const segmentedTabBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 14px',
  borderRadius: 999,
  border: '1px solid transparent',
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

const profileCapsule: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(30, 41, 59, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 999,
  height: 36,
  padding: '0 12px 0 4px',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
};

const profileAvatarCircle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 13,
  boxShadow: '0 0 10px rgba(245, 158, 11, 0.25)',
};

const lvlBadge: React.CSSProperties = {
  fontSize: 8.5,
  background: 'rgba(2, 132, 199, 0.25)',
  border: '1px solid rgba(56, 189, 248, 0.35)',
  color: '#38BDF8',
  padding: '1px 5px',
  borderRadius: 4,
  fontWeight: 800,
  lineHeight: 1.2,
};

const pwaInstallIconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'rgba(30, 41, 59, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#CBD5E1',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  position: 'relative',
  transition: 'all 140ms ease',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
};

const pwaDotIndicator: React.CSSProperties = {
  position: 'absolute',
  top: 7,
  right: 7,
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: '#10B981',
  boxShadow: '0 0 6px #10B981',
};

const quickPlayHeaderBtn: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  border: '1px solid rgba(253, 230, 138, 0.5)',
  color: '#FFF',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.5,
  textAlign: 'center',
  textDecoration: 'none',
  boxShadow: '0 2px 12px rgba(217, 119, 6, 0.35)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  transition: 'all 140ms ease',
};

const modePillTag: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.25)',
  padding: '2px 6px',
  borderRadius: 999,
  fontSize: 9.5,
  fontWeight: 800,
  color: '#FEF08A',
  letterSpacing: 0.3,
};

const filterSubheader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 24px',
  background: 'rgba(15, 23, 42, 0.6)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  gap: 12,
};

const roleFilterPill: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'all 140ms ease',
  whiteSpace: 'nowrap',
};

const territoryDropdown: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.85)',
  color: '#00E5FF',
  border: '1px solid rgba(0, 229, 255, 0.4)',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 11.5,
  fontWeight: 700,
  cursor: 'pointer',
};

const mainGrid: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '280px 1fr 340px',
  gap: 16,
  padding: '16px 24px',
  minHeight: 0,
};

const rosterSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#FFD700',
  letterSpacing: 1.2,
  margin: 0,
};

const heroCardList: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  overflowY: 'auto',
  flex: 1,
  paddingRight: 2,
};

const heroCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 12,
  border: '1px solid',
  cursor: 'pointer',
  transition: 'transform 100ms ease, background 100ms ease',
};

const roleBadge: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 800,
  color: '#FFF',
  padding: '1px 5px',
  borderRadius: 4,
};

const roleBadgeLarge: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  color: '#FFF',
  padding: '2px 8px',
  borderRadius: 6,
};

const previewSection: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle at 50% 40%, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.9) 100%)',
  borderRadius: 18,
  border: '1px solid rgba(255, 215, 0, 0.25)',
  overflow: 'hidden',
};

const turntableOverlay: React.CSSProperties = {
  position: 'absolute',
  bottom: 12,
  left: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  background: 'rgba(15, 23, 42, 0.82)',
  backdropFilter: 'blur(16px) saturate(180%)',
  border: '1px solid rgba(255, 215, 0, 0.25)',
  borderRadius: 16,
  padding: '10px 14px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  pointerEvents: 'none',
};

const heroOriginBadge: React.CSSProperties = {
  fontSize: 10.5,
  color: '#00E5FF',
  fontWeight: 700,
  letterSpacing: 0.5,
};

const heroDisplayName: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: '#FFF',
  letterSpacing: 1.5,
  textShadow: '0 0 16px rgba(255, 215, 0, 0.5)',
  margin: '1px 0 0',
};

const heroQuoteText: React.CSSProperties = {
  fontSize: 11,
  color: '#FDE68A',
  fontStyle: 'italic',
  margin: '2px 0 4px',
  lineHeight: 1.3,
};

const statGaugesContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  marginTop: 4,
};

const statGaugeItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  background: 'rgba(30, 41, 59, 0.55)',
  padding: '4px 6px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};

const statGaugeLabelRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const statTrack: React.CSSProperties = {
  width: '100%',
  height: 4,
  background: 'rgba(0, 0, 0, 0.5)',
  borderRadius: 999,
  overflow: 'hidden',
};

const statFill: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  transition: 'width 200ms ease-out',
};

const dossierSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  overflowY: 'auto',
  minHeight: 0,
};

const loreBox: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 14,
  padding: 12,
};

const loreHeader: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#FFD700',
  letterSpacing: 1,
  margin: 0,
};

const loreText: React.CSSProperties = {
  fontSize: 11.5,
  color: '#CBD5E1',
  lineHeight: 1.45,
  margin: 0,
};

const abilitiesBox: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 14,
  padding: 12,
  flex: 1,
};

const abilityCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  background: 'rgba(30, 41, 59, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 10,
  padding: '8px 10px',
};

const abilityIconWrapper: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  background: 'rgba(15, 23, 42, 0.7)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const abilityShapeTag: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 800,
  background: 'rgba(51, 65, 85, 0.8)',
  color: '#94A3B8',
  padding: '1px 5px',
  borderRadius: 4,
};

const statBadgeSmall: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  padding: '1px 6px',
  borderRadius: 4,
  fontWeight: 600,
};

const launchPlayBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  border: '1.5px solid #FDE68A',
  color: '#FFF',
  padding: '12px',
  borderRadius: 14,
  fontSize: 13.5,
  fontWeight: 900,
  textAlign: 'center',
  textDecoration: 'none',
  boxShadow: '0 6px 20px rgba(217, 119, 6, 0.45)',
  display: 'block',
  marginTop: 4,
};

// ── TERRITORIES VIEW STYLING ────────────────────────────────────────────────
const territoriesViewContainer: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '14px 24px',
  gap: 14,
  minHeight: 0,
};

const territoryCardsBar: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 10,
};

const territorySelectorCard: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1.5px solid',
  cursor: 'pointer',
  transition: 'all 120ms ease',
};

const territoryDetailGrid: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr',
  gap: 16,
  minHeight: 0,
};

const videoPlayerContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const videoWrapper: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  borderRadius: 16,
  overflow: 'hidden',
  border: '1.5px solid rgba(255, 215, 0, 0.3)',
  boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
  background: '#000',
};

const videoElement: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const videoOverlayControls: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  right: 10,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: 10,
  background: 'rgba(15, 23, 42, 0.82)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.15)',
};

const videoControlBtn: React.CSSProperties = {
  background: 'rgba(255, 215, 0, 0.2)',
  border: '1px solid #FFD700',
  color: '#FFD700',
  padding: '3px 10px',
  borderRadius: 6,
  fontSize: 10.5,
  fontWeight: 800,
  cursor: 'pointer',
};

const territoryHeaderCard: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  padding: 14,
};

const territoryBigTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: '#FFF',
  letterSpacing: 1.5,
  margin: '1px 0 0',
};

const atmosphereBadge: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: '#FFF',
  background: 'rgba(30, 41, 59, 0.8)',
  border: '1px solid',
  padding: '3px 8px',
  borderRadius: 999,
};

const territoryQuote: React.CSSProperties = {
  fontSize: 11.5,
  color: '#FDE68A',
  fontStyle: 'italic',
  margin: '6px 0 3px',
};

const territoryLoreParagraph: React.CSSProperties = {
  fontSize: 11.5,
  color: '#CBD5E1',
  lineHeight: 1.45,
  margin: '3px 0 8px',
};

const blessingBox: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.6)',
  border: '1.5px solid',
  borderRadius: 10,
  padding: '8px 12px',
};

const cultureColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  overflowY: 'auto',
  minHeight: 0,
};

const cultureSectionCard: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 12,
};

const storySectionCard: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255, 215, 0, 0.25)',
  borderRadius: 12,
  padding: 12,
};

const cultureSectionTitle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: '#FFD700',
  letterSpacing: 1,
  margin: 0,
};

const storyChapterTabs: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 8,
};

const storyChapterBtn: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid',
  fontSize: 10.5,
  fontWeight: 800,
  cursor: 'pointer',
};

const activeStoryContent: React.CSSProperties = {
  marginTop: 8,
  background: 'rgba(30, 41, 59, 0.5)',
  padding: 10,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};

const cultureFactBox: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.4)',
  borderRadius: 8,
  padding: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};

const artifactItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(30, 41, 59, 0.5)',
  padding: '5px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.06)',
};

const associatedHeroTag: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: 'rgba(30, 41, 59, 0.75)',
  border: '1.5px solid',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
};

