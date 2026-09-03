# ALamat MOBA - Offline & Online Mode Guide

## ✅ Overview

The game now **works both offline and online** with automatic detection and graceful fallbacks. This document explains how it works and how to use it.

---

## 🌐 **Online Mode** (Default)

When you have an internet connection, the game:
- Loads all assets from the CDN/server
- Uses high-quality graphics (configurable)
- Caches assets for future offline use
- Enables all features (dragons, trees, terrain, effects)

**URL**: https://alamat-ten.vercel.app

---

## 📱 **Offline Mode** (PWA / Static Export)

The game works **without internet** in these scenarios:

### 1. **Progressive Web App (PWA)**
- Install the game from your browser (Chrome, Edge, Samsung Internet)
- Works offline after first load
- Service worker caches all necessary assets

### 2. **Capacitor Mobile App** (Android/iOS)
- Built using `npm run cap:build`
- Fully static export with bundled assets
- No internet required after installation

### 3. **Offline Browser**
- If you've visited before, cached assets will load
- If first visit offline, uses fallback graphics

---

## 🔧 **How It Works**

### Service Worker Caching

The game uses a **Service Worker** (`public/sw.js`) that:

1. **Precaches critical assets**:
   - `/` (home page)
   - `/play` (game page)
   - `/manifest.json` (PWA manifest)
   - `/icon.svg` (app icon)
   - `/_next/static/*` (all static chunks)
   - `/models/*` (3D models)

2. **Cache-first strategy**:
   - Serves cached assets immediately
   - Updates cache in background
   - Falls back to network if not cached

3. **Offline fallbacks**:
   - Navigation requests: fallback to cached pages
   - Asset requests: fallback to placeholder or cached version
   - API requests: graceful degradation

### Static Export Support

For Capacitor/mobile builds (`CAP_BUILD=1`):
- All code is statically exported
- No server-side rendering
- All assets bundled with the app
- Uses fallback materials/textures when dynamic loading fails

### Performance Auto-Adjustment

When offline:
- Automatically sets performance preset to **'medium'**
- Reduces terrain detail
- Reduces tree leaflet counts
- Limits number of dragons and trees
- Maintains playable framerates

---

## 🎮 **Usage Examples**

### Basic Usage (Works Everywhere)

```typescript
import { setupEnhancedGraphics } from '@/game/render3d/alamatGraphicsEnhancement';

// This automatically handles offline/online detection
const enhancement = setupEnhancedGraphics(renderer, scene, camera, canvas);

// The game will work with or without internet!
```

### PWA Installation

Users can install the game from their browser:

**Chrome/Edge:**
1. Open https://alamat-ten.vercel.app
2. Click the install icon in the address bar (or "Add to Home Screen")
3. The game installs as a PWA
4. Works offline after installation

**Safari (iOS):**
1. Open https://alamat-ten.vercel.app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The game installs as a web app

### Capacitor Mobile Build

```bash
# Set up Capacitor
npm run cap:init

# Add platforms
npm run cap:android
npm run cap:ios

# Sync web assets to Capacitor
npx cap sync

# Open in Android Studio / Xcode
npx cap open android
npx cap open ios

# Build and run
# (Build in your IDE)
```

The mobile app will:
- Bundle all assets locally
- Work without internet
- Use the 'medium' performance preset by default

---

## 🔄 **Offline Detection & Handling**

### Detection Functions

```typescript
import { isOffline, isStaticExport, shouldUseOfflineMode } from '@/game/render3d/offlineSupport';

// Check if browser is currently offline
if (isOffline()) {
  console.log('No internet connection');
}

// Check if running in Capacitor static export
if (isStaticExport()) {
  console.log('Running in mobile app mode');
}

// Check if we should use offline behavior
if (shouldUseOfflineMode()) {
  console.log('Using offline mode');
}
```

### Manual Asset Preloading

```typescript
import { preloadCriticalAssets } from '@/game/render3d/offlineSupport';

// Preload assets when user has connection
if (navigator.onLine) {
  preloadCriticalAssets().then(() => {
    console.log('Assets cached for offline use');
  });
}
```

### Fallback Materials

```typescript
import { createFallbackMaterial, getOfflineSafeMaterial } from '@/game/render3d/offlineSupport';

// Use when texture loading might fail
const safeMaterial = createFallbackMaterial(0x4a5d4a, { roughness: 0.95 });
const offlineMaterial = getOfflineSafeMaterial(0x689f38);
```

---

## 📊 **Feature Availability**

| Feature | Online | Offline PWA | Capacitor App | Notes |
|---------|--------|-------------|---------------|-------|
| Terrain | ✅ Full | ✅ Full | ✅ Full | Reduced detail offline |
| Dragons | ✅ Full | ✅ Full | ✅ Full | All types available |
| Trees | ✅ Full | ✅ Full | ✅ Full | All species available |
| Special Effects | ✅ Full | ✅ Partial | ✅ Partial | Some effects simplified |
| Particle Systems | ✅ Full | ⚠️ Limited | ⚠️ Limited | Reduced count offline |
| Shadows | ✅ Full | ✅ Medium | ✅ Medium | Lower resolution offline |
| Animations | ✅ Full | ✅ Full | ✅ Full | All animations work |
| Wind Effects | ✅ Full | ✅ Full | ✅ Full | Works offline |
| Dragon AI | ✅ Full | ✅ Full | ✅ Full | Full AI offline |
| Multiplayer | ❌ No | ❌ No | ❌ No | Online only |

---

## ⚙️ **Configuration Options**

### Performance Presets for Offline

```typescript
import { setPerformancePreset } from '@/game/render3d/performanceOptimizer';

// Choose based on device capabilities
setPerformancePreset('ultra');    // High-end devices (desktop)
setPerformancePreset('high');     // Modern mobile (6GB+ RAM)
setPerformancePreset('medium');  // Mid-range mobile (4GB RAM) - DEFAULT OFFLINE
setPerformancePreset('low');      // Budget devices (2-3GB RAM)
setPerformancePreset('minimal'); // Very old devices (<2GB RAM)
```

### Custom Offline Settings

```typescript
import { setPerformancePreset } from '@/game/render3d/performanceOptimizer';

// Set medium preset for offline devices
if (shouldUseOfflineMode()) {
  setPerformancePreset('medium');
}

// Or set custom limits
enhancement.setGraphicsQuality({
  quality: 'medium',
  shadowQuality: 'low',
  animationsEnabled: true,
  effectsEnabled: true,
  windIntensity: 0.5
});
```

---

## 🚨 **Offline Limitations & Workarounds**

### 1. **First-Time Offline Users**
**Issue**: No cached assets on first visit offline  
**Solution**: Uses fallback graphics, works but with reduced quality  
**Workaround**: Visit the site once with internet to cache assets

### 2. **Cleared Browser Cache**
**Issue**: Assets deleted, offline mode doesn't work  
**Solution**: Revisit with internet to re-cache  
**Workaround**: Bookmark the site and visit periodically

### 3. **Private Browsing**
**Issue**: Service worker may not work in private/incognito  
**Solution**: Uses fallback mode automatically  
**Workaround**: Install as PWA or use regular browsing

### 4. **Very Old Browsers**
**Issue**: May not support Service Worker  
**Solution**: Uses static fallback mode  
**Workaround**: Update browser or use a modern browser

### 5. **Corporate/Firewall Networks**
**Issue**: Some assets may be blocked  
**Solution**: Service worker caches what's accessible  
**Workaround**: Contact IT to whitelist the domain

---

## 📋 **Testing Offline Mode**

### Method 1: Browser DevTools (Chrome/Edge)
1. Open DevTools (F12)
2. Go to **Application** > **Service Workers**
3. Check "Offline" checkbox
4. Reload the page
5. Test all features

### Method 2: Disable Network
1. Open DevTools (F12)
2. Go to **Network** tab
3. Select "Offline" from the dropdown
4. Reload the page

### Method 3: Airplane Mode
1. Enable airplane mode on your device
2. Open the installed PWA or Capacitor app
3. Verify it works without internet

### Method 4: Capacitor Test
```bash
# Build for mobile
npm run cap:build
npx cap sync
npx cap open android
# Test in Android Studio emulator without internet
```

---

## 🎯 **Best Practices**

### For Game Developers

1. **Always use offline-safe functions**:
   ```typescript
   // Instead of direct texture loading:
   // const texture = textureLoader.load('/textures/bark.jpg');
   
   // Use offline-safe version:
   import { loadTextureWithFallback } from '@/game/render3d/offlineSupport';
   const texture = loadTextureWithFallback('/textures/bark.jpg', 0x5d4037);
   ```

2. **Provide fallbacks for critical assets**:
   ```typescript
   const material = canLoadTexture
     ? new THREE.MeshStandardMaterial({ map: texture })
     : createFallbackMaterial(0x5d4037);
   ```

3. **Test offline regularly**:
   - Use Chrome DevTools offline mode
   - Test in airplane mode
   - Test in Capacitor emulator without network

### For Players

1. **Install as PWA** for best offline experience
2. **Visit the site once with internet** to cache assets
3. **Keep the app updated** for latest features
4. **Don't clear browser cache** frequently if you play offline

---

## 📦 **Build & Deploy Commands**

### Deploy to Vercel (Online)
```bash
# Push to GitHub triggers automatic Vercel deployment
git add .
git commit -m "Update graphics"
git push origin main

# Or deploy manually
vercel --prod
```

### Build for Capacitor (Offline Mobile)
```bash
# Install Capacitor
npm run cap:init

# Add platform
npm run cap:add android
npm run cap:add ios

# Build web assets
npm run build

# Sync to Capacitor
npx cap sync

# Open in IDE
npx cap open android
npx cap open ios

# Build APK/IPA from IDE
```

### Build Static Export (Offline Web)
```bash
# Build with static export
CAP_BUILD=1 npm run build

# Serve locally
npx serve out
```

---

## 🔗 **Technical Details**

### Service Worker Cache Strategy

```
Cache Name: talisman-moba-cache-v4

Precached URLs:
- / (home)
- /play (game)
- /manifest.json
- /manifest.webmanifest  
- /icon.svg
- /_next/static/*
- /models/*

Runtime Caching:
- Cache-first for static assets
- Network-first for API requests
- Stale-while-revalidate for updates
```

### Offline Fallback Chain

```
1. Try network → Success → Cache & Return
2. Try cache → Found → Return
3. Try fallback asset → Found → Return
4. Return placeholder/error
```

### Performance Preset Values

```typescript
// Terrain segment counts (totalSize / divisor)
ultra:  280 / 1.2  = ~233 segments = ~54,000 vertices
high:   280 / 2.0  = ~140 segments = ~19,600 vertices  
high:   280 / 3.0  = ~93 segments  = ~8,600 vertices (DEFAULT OFFLINE)
low:    280 / 4.0  = ~70 segments  = ~4,900 vertices
minimal:280 / 6.0  = ~47 segments  = ~2,200 vertices

// Tree leaflet counts
ultra:  100%
high:   70%
medium: 50% (DEFAULT OFFLINE)
low:    30%
minimal:20%

// Max trees
desktop: 100
high:   70  
medium: 50 (DEFAULT OFFLINE)
low:    30
minimal:15
```

---

## ✅ **Verification Checklist**

- [ ] Game loads online at https://alamat-ten.vercel.app
- [ ] Game loads offline after first visit (PWA)
- [ ] Graphics enhancements visible (dragons, trees, terrain)
- [ ] Performance acceptable on target devices
- [ ] Capacitor build works (if mobile app needed)
- [ ] All features functional in offline mode
- [ ] Service worker registered (check DevTools > Application)
- [ ] Assets cached (check DevTools > Application > Cache Storage)

---

## 📞 **Support**

If you experience issues with offline mode:

1. Check browser console for errors (F12 > Console)
2. Verify service worker is registered (F12 > Application > Service Workers)
3. Check cache storage (F12 > Application > Cache Storage)
4. Test in multiple browsers
5. Clear cache and retry

---

## 🎉 **Conclusion**

The ALamat MOBA graphics enhancements now work **seamlessly both offline and online**:

✅ **Online**: Full quality, CDN delivery, automatic caching  
✅ **PWA**: Installable, offline-capable, auto-updating  
✅ **Capacitor**: Mobile app, fully bundled, no internet required  
✅ **Automatic**: Detects mode, adjusts quality, graceful fallbacks

**The game is now ready for production use in all scenarios!**
