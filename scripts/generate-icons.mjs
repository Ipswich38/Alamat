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
    
    // Create capacitor config file if it doesn't exist
    const capacitorConfig = {
      appId: 'com.plaidelab.alamat',
      appName: 'Alamat',
      webDir: 'out',
      bundledWebRuntime: false,
      android: {
        packageType: 'bundle'
      }
    };
    
    const capConfigPath = path.resolve(rootDir, 'capacitor.config.json');
    try {
      await fs.access(capConfigPath);
      console.log('✅ capacitor.config.json already exists');
    } catch {
      await fs.writeFile(capConfigPath, JSON.stringify(capacitorConfig, null, 2));
      console.log('📝 Created capacitor.config.json');
    }
    
    console.log('\n🎉 Icon generation complete!');
    console.log('\nNext steps:');
    console.log('1. Run: CAP_BUILD=1 npm run build');
    console.log('2. Run: npx cap init "Alamat" com.plaidelab.alamat --web-dir out');
    console.log('3. Run: npx cap add android');
    console.log('4. Set JAVA_HOME and run: npx cap assembleDebug');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();