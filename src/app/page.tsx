'use client';

// Mythic Hero Selection & 5 Territories Lobby Route (Talisman).
//
// ── FEATURES ────────────────────────────────────────────────────────────────
// 1. Dual Master Navigation: [CHAMPIONS] & [5 TERRITORIES OF THE ARCHIPELAGO]
// 2. Interactive 3D Hero Model Turntable Preview (Three.js canvas)
// 3. Full 5-Territory Mythological Showcase powered by Higgsfield AI media:
//    - High-Definition Looping Video Trailers with Play/Pause & Fullscreen
//    - Multi-Chapter Narrative Story Beats (Origins, Legends, Climax)
//    - Pre-Colonial Cultural Traditions & Sacred Artifacts
//    - Elemental Atmosphere & Regional Territory Blessing
// 4. Role Filter Tabs: All, Vanguard, Mystic, Stalker, Warden, Ranger
// 5. Territory-Bound Deployment directly to /play?hero=[id]&territory=[id]

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { HEROES, type Hero, heroHeight } from '@/game/heroes';
import { TERRITORIES, type Territory, DEFAULT_TERRITORY } from '@/game/territories';
import { createActor, type Actor } from '@/game/render3d/actor';
import { sound } from '@/game/audio/synth';
import { loadPlayerProfile, getRankForLevel, type PlayerProfile } from '@/game/progression/profile';

export default function HeroSelectionLobby() {
  const [activeTab, setActiveTab] = useState<'heroes' | 'territories'>('heroes');
  const [selectedHero, setSelectedHero] = useState<Hero>(HEROES[0]);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory>(DEFAULT_TERRITORY);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [activeStoryChapter, setActiveStoryChapter] = useState<number>(1);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [playerProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
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

  // ── 3D Turntable Scene ───────────────────────────────────────────────────
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
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 1.35, 4.6);
    camera.lookAt(0, 1.05, 0);

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0x38bdf8, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 3.5);
    keyLight.position.set(4, 6, 4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 4.0);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    const goldLight = new THREE.PointLight(0xffb300, 3.0, 10);
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
      opacity: 0.8,
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
        actor.setFacing(clock * 0.45);
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
      {/* Top Navigation Bar */}
      <header className="lobby-topbar" style={topHeader}>
        <div style={brandCol}>
          <h1 style={brandTitle}>TALISMAN</h1>
          <span className="lobby-tagline" style={brandSubtitle}>A 3D ACTION MOBA</span>
        </div>

        {/* Master Navigation View Tabs */}
        <div style={masterNavTabs}>
          <button
            style={{
              ...masterNavBtn,
              background: activeTab === 'heroes' ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.4), rgba(180, 83, 9, 0.4))' : 'rgba(15, 23, 42, 0.6)',
              borderColor: activeTab === 'heroes' ? '#FFD700' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'heroes' ? '#FFD700' : '#94A3B8',
            }}
            onClick={() => {
              setActiveTab('heroes');
              sound.playPing('select');
            }}
          >
            ⚔️ CHAMPIONS ROSTER
          </button>
          <button
            style={{
              ...masterNavBtn,
              background: activeTab === 'territories' ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(124, 58, 237, 0.4))' : 'rgba(15, 23, 42, 0.6)',
              borderColor: activeTab === 'territories' ? '#00E5FF' : 'rgba(255,255,255,0.15)',
              color: activeTab === 'territories' ? '#00E5FF' : '#94A3B8',
            }}
            onClick={() => {
              setActiveTab('territories');
              sound.playPing('onmyway');
            }}
          >
            🗺️ REALMS & TERRITORIES ({TERRITORIES.length})
          </button>
        </div>

        {/* Progressive Profile & Rank Badge */}
        {playerProfile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid rgba(255, 215, 0, 0.4)',
              borderRadius: 24,
              padding: '4px 14px 4px 6px',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 16,
              }}
            >
              {getRankForLevel(playerProfile.accountLevel).badgeEmoji}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 12, color: '#F1F5F9' }}>
                  {playerProfile.name}
                </strong>

                <span style={{ fontSize: 9.5, background: '#0284C7', color: '#FFF', padding: '1px 5px', borderRadius: 6, fontWeight: 800 }}>
                  LVL {playerProfile.accountLevel}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#FFD700' }}>
                {getRankForLevel(playerProfile.accountLevel).title}
              </span>
            </div>
          </div>
        ) : null}

        {/* Progressive App Install & Quick Launch Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
              border: '1.5px solid #10B981',
              color: '#6EE7B7',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={handleInstallApp}
          >
            <span>📱</span>
            <span>INSTALL APP</span>
          </button>

          <Link
            href={`/play?hero=${selectedHero.id}&territory=${selectedTerritory.id}`}
            style={quickPlayHeaderBtn}
          >
            <span>⚔️ ENTER ARENA</span>
            <span style={{ fontSize: 10, opacity: 0.85, display: 'block', fontWeight: 600 }}>
              {selectedHero.name} · {selectedTerritory.name}
            </span>
          </Link>
        </div>
      </header>

      {/* VIEW 1: HEROES ROSTER VIEW */}
      {activeTab === 'heroes' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Role Filters Subheader */}
          <div className="lobby-filters" style={filterSubheader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#FFD700', fontWeight: 800 }}>ROLE FILTER:</span>
              {['all', 'vanguard', 'mystic', 'stalker', 'warden', 'ranger'].map((r) => (
                <button
                  key={r}
                  style={{
                    ...roleFilterBtn,
                    background: selectedRole === r ? 'rgba(255, 215, 0, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    borderColor: selectedRole === r ? '#FFD700' : 'rgba(255,255,255,0.15)',
                    color: selectedRole === r ? '#FFD700' : '#94A3B8',
                  }}
                  onClick={() => setSelectedRole(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#00E5FF', fontWeight: 800 }}>TERRITORY REALM:</span>
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
            {/* 1. Left Hero List */}
            <section className="lobby-roster" style={rosterSection}>
              <h2 style={sectionTitle}>CHOOSE CHAMPION</h2>
              <div className="lobby-hero-list" style={heroCardList}>
                {filteredHeroes.map((h) => {
                  const isSelected = h.id === selectedHero.id;
                  return (
                    <div
                      key={h.id}
                      className="lobby-hero-card"
                      style={{
                        ...heroCard,
                        borderColor: isSelected ? '#FFD700' : 'rgba(255,255,255,0.12)',
                        background: isSelected ? 'rgba(255, 215, 0, 0.15)' : 'rgba(15, 23, 42, 0.75)',
                      }}
                      onClick={() => {
                        setSelectedHero(h);
                        sound.playPing('select');
                      }}
                    >
                      {h.portrait ? (
                        <img
                          src={h.portrait}
                          alt={h.name}
                          width={44}
                          height={44}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            objectFit: 'cover',
                            /* the renders are lit on white, so they need a
                               ground of their own against the dark card */
                            background: 'rgba(255,255,255,0.06)',
                            flex: 'none',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 32 }}>{h.emoji}</span>
                      )}
                      <div style={{ flex: 1, marginLeft: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <strong style={{ color: '#F8FAFC', fontSize: 16 }}>{h.name}</strong>
                          </div>
                          <span style={{ ...roleBadge, background: getRoleColor(h.role) }}>
                            {h.role.toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 11.5, color: '#00E5FF', display: 'block', marginTop: 1 }}>
                          {h.title || h.origin}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. Center 3D Interactive Turntable */}
            <section className="lobby-turntable" style={previewSection}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              <div className="lobby-nameplate" style={turntableOverlay}>
                <span style={heroOriginBadge}>{selectedHero.title || selectedHero.origin}</span>
                <h2 style={heroDisplayName}>{selectedHero.name.toUpperCase()}</h2>
                {selectedHero.quote && <p className="lobby-quote" style={heroQuoteText}>&ldquo;{selectedHero.quote}&rdquo;</p>}
                <div style={heroStatChips}>
                  <span style={statChip}>❤️ {selectedHero.health} HP</span>
                  <span style={statChip}>⚔️ {selectedHero.attack} ATK</span>
                  <span style={statChip}>💨 {selectedHero.speed} SPD</span>
                  <span style={statChip}>🎯 {selectedHero.attackRange}u REACH</span>
                </div>
              </div>
            </section>

            {/* 3. Right Hero Dossier & Abilities Showcase */}
            <section className="lobby-dossier" style={dossierSection}>
              <div style={loreBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={loreHeader}>FOLKLORE DOSSIER</h3>
                </div>
                <p style={loreText}>{selectedHero.lore}</p>
              </div>

              <div style={abilitiesBox}>
                <h3 style={loreHeader}>SKILLSHOT & PASSIVE ARSENAL</h3>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {/* Innate Mythic Passive Card */}
                  {selectedHero.passive && (
                    <div style={{ ...abilityCard, borderColor: 'rgba(0, 229, 255, 0.4)', background: 'rgba(6, 78, 59, 0.25)' }}>
                      <span style={{ fontSize: 24 }}>{selectedHero.passive.emoji}</span>
                      <div style={{ flex: 1, marginLeft: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#5EEAD4', fontSize: 13 }}>
                            [PASSIVE] {selectedHero.passive.name}
                          </strong>
                          <span style={{ ...abilityShapeTag, background: '#0D9488', color: '#FFF' }}>INNATE</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#99F6E4', margin: '2px 0 0' }}>{selectedHero.passive.blurb}</p>
                        <div style={{ marginTop: 3, fontSize: 10, color: '#CCFBF1', fontWeight: 600 }}>
                          ⚡ {selectedHero.passive.effect}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedHero.abilities.map((ab, idx) => (
                    <div key={ab.id} style={abilityCard}>
                      <span style={{ fontSize: 22 }}>{ab.emoji}</span>
                      <div style={{ flex: 1, marginLeft: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#F1F5F9', fontSize: 13 }}>
                            {idx === 0 ? '[Q]' : idx === 1 ? '[W]' : '[E]'} {ab.name}
                          </strong>
                          <span style={abilityShapeTag}>{ab.shape.toUpperCase()}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>{ab.blurb}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: '#CBD5E1' }}>
                          <span>💥 {ab.damage} Dmg</span>
                          <span>⏳ {ab.cooldown}s CD</span>
                          <span>📏 {ab.range}u Range</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Ultimate Showcase */}
                  <div style={{ ...abilityCard, borderColor: 'rgba(255, 215, 0, 0.4)', background: 'rgba(120, 53, 15, 0.25)' }}>
                    <span style={{ fontSize: 26 }}>{selectedHero.ultimate.emoji}</span>
                    <div style={{ flex: 1, marginLeft: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: '#FFD700', fontSize: 13.5 }}>
                          [R] {selectedHero.ultimate.name} (ULTIMATE)
                        </strong>
                        <span style={{ ...abilityShapeTag, background: '#D97706', color: '#FFF' }}>
                          {selectedHero.ultimate.shape.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#FEF08A', margin: '2px 0 0' }}>{selectedHero.ultimate.blurb}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: '#FDE68A' }}>
                        <span>💥 {selectedHero.ultimate.damage} Dmg</span>
                        <span>⏳ {selectedHero.ultimate.cooldown}s CD</span>
                        <span>📏 {selectedHero.ultimate.range}u Range</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href={`/play?hero=${selectedHero.id}&territory=${selectedTerritory.id}`}
                style={launchPlayBtn}
              >
                <span>⚔️ DEPLOY TO {selectedTerritory.name.toUpperCase()}</span>
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
                    <span style={{ fontSize: 16, color: selectedTerritory.atmosphere.primaryColor, letterSpacing: 4 }}>
                    </span>
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
                href={`/play?hero=${selectedHero.id}&territory=${selectedTerritory.id}`}
                style={{
                  ...launchPlayBtn,
                  background: `linear-gradient(135deg, ${selectedTerritory.atmosphere.primaryColor}, #B45309)`,
                }}
              >
                <span>⚔️ DEPLOY {selectedHero.name.toUpperCase()} TO {selectedTerritory.name.toUpperCase()}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari / Web PWA Installation Guide Modal */}
      {showInstallGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(8px)',
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
              border: '1.5px solid rgba(255, 215, 0, 0.4)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <strong style={{ fontSize: 18, color: '#FFD700' }}>📱 I-install ang Talisman App</strong>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
                onClick={() => setShowInstallGuide(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, padding: 14, border: '1px solid rgba(0, 229, 255, 0.3)' }}>
                <strong style={{ color: '#00E5FF', fontSize: 13.5 }}>Para sa iPhone / iPad (iOS Safari):</strong>
                <ol style={{ fontSize: 12, color: '#CBD5E1', paddingLeft: 20, marginTop: 6, lineHeight: 1.6 }}>
                  <li>Tap the <strong>Share button (⎋ / 🔲⬆)</strong> at the bottom of Safari.</li>
                  <li>Choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</li>
                  <li>Tap <strong>&ldquo;Add&rdquo;</strong> to install it as a fullscreen app.</li>
                </ol>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 10, padding: 14, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <strong style={{ color: '#10B981', fontSize: 13.5 }}>Para sa Android (Chrome) / Desktop:</strong>
                <p style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4, lineHeight: 1.5 }}>
                  Open the Chrome menu (⋮) and choose <strong>Install Talisman</strong> to play fullscreen and offline.
                </p>
              </div>

              <button
                style={{
                  background: 'linear-gradient(135deg, #D97706, #B45309)',
                  border: '1.5px solid #FDE68A',
                  color: '#FFF',
                  padding: '10px',
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginTop: 6,
                }}
                onClick={() => setShowInstallGuide(false)}
              >
                Simulan ang Laban ⚔️
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
// CSS IN JS STYLING (MYTHIC LOBBY UI)
// ══════════════════════════════════════════════════════════════════════════════

const lobbyContainer: React.CSSProperties = {
  width: '100%',
  minHeight: '100vh',
  background: 'radial-gradient(ellipse at center, #0F172A 0%, #020617 100%)',
  color: '#F8FAFC',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  overflowX: 'hidden',
};

const topHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 28px',
  borderBottom: '1px solid rgba(255, 215, 0, 0.25)',
  background: 'rgba(15, 23, 42, 0.9)',
  backdropFilter: 'blur(12px)',
};

const brandCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const baybayinGlyph: React.CSSProperties = {
  fontSize: 14,
  color: '#FFD700',
  letterSpacing: 4,
};

const brandTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: 2,
  margin: 0,
  color: '#FFF',
};

const brandSubtitle: React.CSSProperties = {
  fontSize: 9.5,
  color: '#94A3B8',
  letterSpacing: 1.5,
};

const masterNavTabs: React.CSSProperties = {
  display: 'flex',
  gap: 12,
};

const masterNavBtn: React.CSSProperties = {
  padding: '10px 22px',
  borderRadius: 999,
  border: '1.5px solid',
  fontSize: 12.5,
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

const filterSubheader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 28px',
  background: 'rgba(30, 41, 59, 0.4)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const roleFilterBtn: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 120ms ease',
};

const territoryDropdown: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.85)',
  color: '#00E5FF',
  border: '1px solid rgba(0, 229, 255, 0.4)',
  borderRadius: 8,
  padding: '5px 12px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const quickPlayHeaderBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  border: '1.5px solid #FDE68A',
  color: '#FFF',
  padding: '8px 20px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  textAlign: 'center',
  textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(217, 119, 6, 0.4)',
};

const mainGrid: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '320px 1fr 380px',
  gap: 20,
  padding: 20,
};

const rosterSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#FFD700',
  letterSpacing: 1.5,
  marginBottom: 12,
};

const heroCardList: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  maxHeight: 'calc(100vh - 200px)',
  overflowY: 'auto',
};

const heroCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 12,
  borderRadius: 10,
  border: '1.5px solid',
  cursor: 'pointer',
  transition: 'transform 80ms ease, background 80ms ease',
};

const roleBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: '#FFF',
  padding: '1px 6px',
  borderRadius: 4,
};

const previewSection: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
  borderRadius: 16,
  border: '1px solid rgba(255, 215, 0, 0.2)',
  overflow: 'hidden',
};

const turntableOverlay: React.CSSProperties = {
  position: 'absolute',
  bottom: 14,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  background: 'rgba(15, 23, 42, 0.78)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 215, 0, 0.25)',
  borderRadius: 14,
  padding: '8px 18px',
  pointerEvents: 'none',
  maxWidth: '90%',
};

const heroOriginBadge: React.CSSProperties = {
  fontSize: 12,
  color: '#00E5FF',
  fontWeight: 600,
};

const heroDisplayName: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  color: '#FFF',
  letterSpacing: 2,
  textShadow: '0 0 24px rgba(255, 215, 0, 0.6)',
  margin: 0,
};

const heroQuoteText: React.CSSProperties = {
  fontSize: 12,
  color: '#FDE68A',
  fontStyle: 'italic',
  margin: '2px 0 6px',
  textAlign: 'center',
  maxWidth: 420,
};

const heroStatChips: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 4,
};

const statChip: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(255,255,255,0.15)',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
};

const dossierSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const loreBox: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: 14,
};

const loreHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#FFD700',
  letterSpacing: 1,
  margin: '0 0 8px',
};

const loreText: React.CSSProperties = {
  fontSize: 12.5,
  color: '#CBD5E1',
  lineHeight: 1.5,
  margin: 0,
};

const abilitiesBox: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: 14,
  flex: 1,
};

const abilityCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(30, 41, 59, 0.6)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: 10,
};

const abilityShapeTag: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  background: '#334155',
  color: '#94A3B8',
  padding: '1px 5px',
  borderRadius: 4,
};

const launchPlayBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
  border: '2px solid #FDE68A',
  color: '#FFF',
  padding: '14px',
  borderRadius: 12,
  fontSize: 14.5,
  fontWeight: 900,
  textAlign: 'center',
  textDecoration: 'none',
  boxShadow: '0 8px 24px rgba(217, 119, 6, 0.5)',
  transition: 'transform 80ms ease',
  display: 'block',
  marginTop: 8,
};

// ── TERRITORIES VIEW STYLING ────────────────────────────────────────────────
const territoriesViewContainer: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '16px 28px',
  gap: 16,
};

const territoryCardsBar: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 12,
};

const territorySelectorCard: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 12,
  border: '1.5px solid',
  cursor: 'pointer',
  transition: 'all 120ms ease',
};

const territoryDetailGrid: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1.2fr 1fr',
  gap: 20,
};

const videoPlayerContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
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
  bottom: 12,
  left: 12,
  right: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: 10,
  background: 'rgba(15, 23, 42, 0.8)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.15)',
};

const videoControlBtn: React.CSSProperties = {
  background: 'rgba(255, 215, 0, 0.2)',
  border: '1px solid #FFD700',
  color: '#FFD700',
  padding: '4px 12px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};

const territoryHeaderCard: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  padding: 16,
};

const territoryBigTitle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  color: '#FFF',
  letterSpacing: 2,
  margin: '2px 0 0',
};

const atmosphereBadge: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#FFF',
  background: 'rgba(30, 41, 59, 0.8)',
  border: '1px solid',
  padding: '4px 10px',
  borderRadius: 999,
};

const territoryQuote: React.CSSProperties = {
  fontSize: 12.5,
  color: '#FDE68A',
  fontStyle: 'italic',
  margin: '8px 0 4px',
};

const territoryLoreParagraph: React.CSSProperties = {
  fontSize: 12.5,
  color: '#CBD5E1',
  lineHeight: 1.5,
  margin: '4px 0 10px',
};

const blessingBox: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.6)',
  border: '1.5px solid',
  borderRadius: 10,
  padding: '10px 14px',
};

const cultureColumn: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  maxHeight: 'calc(100vh - 200px)',
  overflowY: 'auto',
};

const cultureSectionCard: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: 14,
};

const storySectionCard: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(255, 215, 0, 0.25)',
  borderRadius: 12,
  padding: 14,
};

const cultureSectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#FFD700',
  letterSpacing: 1,
  margin: 0,
};

const storyChapterTabs: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
};

const storyChapterBtn: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};

const activeStoryContent: React.CSSProperties = {
  marginTop: 10,
  background: 'rgba(30, 41, 59, 0.5)',
  padding: 12,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.06)',
};

const cultureFactBox: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.4)',
  borderRadius: 8,
  padding: 10,
  border: '1px solid rgba(255,255,255,0.06)',
};

const artifactItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(30, 41, 59, 0.5)',
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.06)',
};

const associatedHeroTag: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(30, 41, 59, 0.75)',
  border: '1.5px solid',
  borderRadius: 999,
  padding: '6px 12px',
  cursor: 'pointer',
};
