#!/usr/bin/env node

/**
 * Generate Android/iOS icons from SVG source
 * 
 * Required sizes for Capacitor/Android:
 * - 192x192 (mdpi)
 * - 512x512 (hdpi)
 * - 512x512 (maskable for adaptive icons)
 * - 512x512 (store icon)
 * - 1024x500 (feature graphic)
 * 
 * Usage: node scripts/generate-icons.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');

// Icon sizes to generate
const iconSizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'icon-maskable-512x512.png', size: 512 },
  { name: 'icon-store-512x512.png', size: 512 },
];

// Feature graphic
const featureGraphic = {
  name: 'feature-graphic-1024x500.png',
  width: 1024,
  height: 500
};

async function generateIcons() {
  try {
    // Check if source SVG exists
    const svgPath = path.resolve(publicDir, 'icon.svg');
    await fs.access(svgPath);
    
    console.log('🎯 Generating icons from:', svgPath);
    
    // Read SVG content
    const svgContent = await fs.readFile(svgPath, 'utf8');
    
    // Generate square icons
    for (const icon of iconSizes) {
      const outputPath = path.resolve(publicDir, icon.name);
      
      // Create a transparent background
      const svgBuffer = Buffer.from(svgContent);
      
      await sharp(svgBuffer)
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size})`);
    }
    
    // Generate feature graphic (1024x500) - use a background color
    const featurePath = path.resolve(publicDir, featureGraphic.name);
    await sharp(Buffer.from(svgContent))
      .resize(featureGraphic.width, featureGraphic.height, {
        fit: 'contain',
        background: { r: 2, g: 6, b: 23, alpha: 1 } // #020617 - game theme color
      })
      .png()
      .toFile(featurePath);
    
    console.log(`✅ Generated ${featureGraphic.name} (${featureGraphic.width}x${featureGraphic.height})`);
    
    /*
     * This used to write a capacitor.config.json holding appId
     * 'com.plaidelab.alamat'. capacitor.config.ts already defines the app, with
     * a different id, so the two configs disagreed about the one value that can
     * never be changed after the first upload to Play. An icon generator has no
     * business deciding the package name. Removed; capacitor.config.ts is the
     * single source.
     */

    console.log('\n🎉 Icon generation complete!');
    console.log('\nNext steps:');
    console.log('1. Run: CAP_BUILD=1 npm run build');
    console.log('2. Run: npx cap sync android   (appId comes from capacitor.config.ts)');
    console.log('3. cd android && ./gradlew assembleDebug   with JAVA_HOME on JDK 21+');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
/*
 * Android launcher icons.
 *
 * Without this the app ships Capacitor's default blue X, which is what an
 * unfinished port looks like on a home screen. The legacy ic_launcher takes the
 * full square artwork; the adaptive foreground takes the emblem-only variant,
 * because a launcher masks the foreground to a circle or squircle and the title
 * text at the bottom of the square would simply be cropped off.
 */
import { existsSync as _exists, mkdirSync as _mkdir } from 'node:fs';
import path2 from 'node:path';
import sharp2 from 'sharp';

const ANDROID_RES = path2.resolve(process.cwd(), 'android/app/src/main/res');
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
// Adaptive foregrounds are drawn on a 108dp canvas, so they are larger.
const FOREGROUND = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

if (!_exists(ANDROID_RES)) {
  console.log('\nNo android/ project yet, skipping launcher icons.');
} else {
  const square = path2.resolve(process.cwd(), 'public/icon.svg');
  const emblem = path2.resolve(process.cwd(), 'public/icon-foreground.svg');
  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path2.join(ANDROID_RES, `mipmap-${density}`);
    _mkdir(dir, { recursive: true });
    await sharp2(square, { density: 400 }).resize(size, size).png()
      .toFile(path2.join(dir, 'ic_launcher.png'));
    await sharp2(square, { density: 400 }).resize(size, size).png()
      .toFile(path2.join(dir, 'ic_launcher_round.png'));
    await sharp2(emblem, { density: 400 }).resize(FOREGROUND[density], FOREGROUND[density]).png()
      .toFile(path2.join(dir, 'ic_launcher_foreground.png'));
  }
  console.log(`\nAndroid launcher icons written for ${Object.keys(DENSITIES).length} densities.`);
}
