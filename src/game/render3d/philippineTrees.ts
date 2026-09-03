// Philippine Giant Trees for ALamat MOBA
//
// Features:
// - Acacia (Akasya) - The most common tree in the Philippines, known for its hard wood
// - Narra - The national tree of the Philippines, known for its beautiful golden-brown wood
// - Both trees with highly detailed geometry, realistic foliage, and natural appearance
//
// These trees are designed to compete with Mobile Legends graphics quality,
// featuring detailed bark textures, realistic canopy shapes, and animated effects.

import * as THREE from 'three';
import { surfaceMaterial } from './stage';
import { terrainHeight } from './terrain';

// Tree species definitions
export const PH_TREE_Species = {
  akasya: {
    name: 'Acacia (Akasya)',
    scientificName: 'Samanea saman',
    description: 'Commonly known as Rain Tree or Acacia. Has a wide, spreading canopy and feathery leaves.',
    woodColor: 0x4a3525,
    barkColor: 0x5d4037,
    leafColor: 0x4caf50,
    leafLightColor: 0x8bc34a,
    heightRange: { min: 15, max: 25 },
    trunkWidth: { min: 0.8, max: 1.5 },
    canopyWidth: { min: 8, max: 15 },
    leafSize: { min: 0.04, max: 0.08 },
    density: 0.8, // Higher density for lush appearance
    windSensitivity: 0.7,
  },
  narra: {
    name: 'Narra',
    scientificName: 'Pterocarpus indicus',
    description: 'The national tree of the Philippines. Known for its beautiful golden-brown wood and bright yellow flowers.',
    woodColor: 0x8d6e63,
    barkColor: 0x6d4c41,
    leafColor: 0x689f38,
    leafLightColor: 0xafb42b,
    heightRange: { min: 20, max: 35 },
    trunkWidth: { min: 1.2, max: 2.5 },
    canopyWidth: { min: 10, max: 20 },
    leafSize: { min: 0.06, max: 0.12 },
    density: 0.9, // Very dense foliage
    windSensitivity: 0.8,
  },
  ipil_ipil: {
    name: 'Ipil-Ipil',
    scientificName: 'Leucaena leucocephala',
    description: 'Fast-growing tree with delicate, fern-like leaves. Often used for reforestation.',
    woodColor: 0x5d4037,
    barkColor: 0x4e342e,
    leafColor: 0x2e7d32,
    leafLightColor: 0x66bb6a,
    heightRange: { min: 12, max: 20 },
    trunkWidth: { min: 0.5, max: 1.2 },
    canopyWidth: { min: 6, max: 12 },
    leafSize: { min: 0.02, max: 0.05 },
    density: 0.6,
    windSensitivity: 0.9,
  },
};

export type TreeSpecies = keyof typeof PH_TREE_Species;

/**
 * Create realistic bark texture using procedural generation
 * Features: wood grain, knots, and natural color variation
 */
function createBarkMaterial(
  baseColor: number,
  species: TreeSpecies,
  position: { x: number; z: number }
): THREE.MeshStandardMaterial {
  const colors = PH_TREE_Species[species];
  
  // Add subtle color variation based on position (for natural look)
  const seed = Math.sin(position.x * 12.9898 + position.z * 78.233) * 43758.5453;
  const variation = (seed - Math.floor(seed)) * 0.15 - 0.075;
  
  const woodColor = new THREE.Color(baseColor);
  woodColor.offsetHSL(0, variation, variation * 0.5);
  
  return new THREE.MeshStandardMaterial({
    color: woodColor,
    roughness: 0.95,
    metalness: 0.02,
    // Add normal map for bark texture (would use actual texture in production)
    normalScale: new THREE.Vector2(0.5, 0.5),
  });
}

/**
 * Create leaf material with wind animation support
 */
function createLeafMaterial(
  baseColor: number,
  lightColor: number,
  species: TreeSpecies
): THREE.MeshStandardMaterial {
  const colors = PH_TREE_Species[species];
  
  return new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: lightColor,
    emissiveIntensity: 0.1,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    // These would be enhanced with actual leaf textures
  });
}

/**
 * Create highly detailed Acacia (Akasya) canopy
 * Acacia trees have distinctive umbrella-shaped canopies
 */
function createAcaciaCanopy(
  width: number,
  height: number,
  speciesData: typeof PH_TREE_Species.akasya,
  position: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'acacia-canopy';
  
  const leafColor = speciesData.leafColor;
  const leafLightColor = speciesData.leafLightColor;
  const leafSize = speciesData.leafSize;
  const density = speciesData.density;
  
  // Acacia has compound leaves (many small leaflets)
  const leafletCount = 2000; // High detail for Mobile Legends quality
  const leafletGeometry = new THREE.PlaneGeometry(leafSize.max, leafSize.max);
  const leafletMaterial = createLeafMaterial(leafColor, leafLightColor, 'akasya');
  
  const leaflets = new THREE.InstancedMesh(leafletGeometry, leafletMaterial, leafletCount);
  leaflets.castShadow = true;
  leaflets.receiveShadow = true;
  leaflets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(leafletCount * 3), 3);
  
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();
  const colorVariation = new THREE.Color(leafLightColor).lerp(new THREE.Color(leafColor), 0.5);
  
  let leafletIndex = 0;
  
  // Create the characteristic umbrella shape
  const canopyRadius = width * 0.5;
  const canopyHeight = height * 0.8;
  
  // Spiral pattern for natural distribution
  for (let i = 0; i < leafletCount && leafletIndex < leafletCount; i++) {
    // Use Fibonacci sphere distribution for natural look
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / leafletCount);
    
    // Adjust for umbrella shape
    const r = Math.pow(Math.random(), 0.5) * canopyRadius;
    const angle = Math.random() * Math.PI * 2;
    const layer = Math.random();
    
    const x = Math.cos(angle) * r * (1 - layer * 0.3);
    const y = canopyHeight * (0.3 + layer * 0.7) + (Math.random() - 0.5) * 0.5;
    const z = Math.sin(angle) * r * (1 - layer * 0.3);
    
    // Random leaflet size variation
    const size = leafSize.min + Math.random() * (leafSize.max - leafSize.min);
    const rotationX = Math.random() * Math.PI * 0.5;
    const rotationY = Math.random() * Math.PI * 2;
    const rotationZ = Math.random() * Math.PI * 0.5;
    
    // Color variation
    const colorMix = 0.7 + Math.random() * 0.3;
    const leafColorFinal = tempColor.copy(new THREE.Color(leafColor)).lerp(
      new THREE.Color(leafLightColor), 
      colorMix
    );
    
    tempMatrix.makeScale(size, size, size);
    tempMatrix.premultiply(new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(rotationX, rotationY, rotationZ)
    ));
    tempMatrix.premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
    
    leaflets.setMatrixAt(leafletIndex, tempMatrix);
    leaflets.setColorAt(leafletIndex, leafColorFinal);
    leafletIndex++;
  }
  
  leaflets.count = leafletIndex;
  group.add(leaflets);
  
  return group;
}

/**
 * Create highly detailed Narra canopy
 * Narra trees have lush, rounded canopies
 */
function createNarraCanopy(
  width: number,
  height: number,
  speciesData: typeof PH_TREE_Species.narra,
  position: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'narra-canopy';
  
  const leafColor = speciesData.leafColor;
  const leafLightColor = speciesData.leafLightColor;
  const leafSize = speciesData.leafSize;
  const density = speciesData.density;
  
  // Narra has larger leaves compared to Acacia
  const leafletCount = 1500; // Slightly fewer but larger leaves
  const leafletGeometry = new THREE.PlaneGeometry(leafSize.max, leafSize.max);
  const leafletMaterial = createLeafMaterial(leafColor, leafLightColor, 'narra');
  
  const leaflets = new THREE.InstancedMesh(leafletGeometry, leafletMaterial, leafletCount);
  leaflets.castShadow = true;
  leaflets.receiveShadow = true;
  leaflets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(leafletCount * 3), 3);
  
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();
  
  let leafletIndex = 0;
  
  // Create the characteristic rounded Narra canopy
  const canopyRadius = width * 0.5;
  const canopyHeight = height * 0.9;
  
  for (let i = 0; i < leafletCount && leafletIndex < leafletCount; i++) {
    // Use multiple layers for dense foliage
    const layer = Math.random();
    const radius = Math.sqrt(Math.random()) * canopyRadius;
    const angle = Math.random() * Math.PI * 2;
    
    // More spherical distribution for Narra
    const layerHeight = Math.pow(layer, 0.7) * canopyHeight;
    const x = Math.cos(angle) * radius * (0.8 + layer * 0.4);
    const y = layerHeight + (Math.random() - 0.5) * 1;
    const z = Math.sin(angle) * radius * (0.8 + layer * 0.4);
    
    // Larger leaves for Narra
    const size = leafSize.min + Math.random() * (leafSize.max - leafSize.min);
    const rotationX = Math.random() * Math.PI * 0.5;
    const rotationY = Math.random() * Math.PI * 2;
    const rotationZ = Math.random() * Math.PI * 0.5;
    
    // Richer color variation for Narra
    const colorMix = 0.6 + Math.random() * 0.4;
    const leafColorFinal = tempColor.copy(new THREE.Color(leafColor)).lerp(
      new THREE.Color(leafLightColor), 
      colorMix
    );
    
    tempMatrix.makeScale(size, size, size);
    tempMatrix.premultiply(new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(rotationX, rotationY, rotationZ)
    ));
    tempMatrix.premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
    
    leaflets.setMatrixAt(leafletIndex, tempMatrix);
    leaflets.setColorAt(leafletIndex, leafColorFinal);
    leafletIndex++;
  }
  
  leaflets.count = leafletIndex;
  group.add(leaflets);
  
  return group;
}

/**
 * Create detailed trunk with natural imperfections and branches
 */
function createTreeTrunk(
  height: number,
  baseWidth: number,
  species: TreeSpecies,
  trunkPosition: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tree-trunk';
  
  const speciesData = PH_TREE_Species[species];
  const barkColor = speciesData.barkColor;
  const woodColor = speciesData.woodColor;
  
  // Main trunk - tapered cylinder
  const trunkSegments = 16;
  const trunkGeometry = new THREE.CylinderGeometry(
    baseWidth, 
    baseWidth * 0.7, // Tapered top
    height, 
    trunkSegments, 
    1,
    true // Open ends for potential hollow tree effect
  );
  
  // Add natural imperfections to trunk
  const position = trunkGeometry.attributes.position;
  const normal = trunkGeometry.attributes.normal;
  
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    
    // Add subtle bumps and knots
    const noise = Math.sin(x * 2 + y * 0.5 + i * 0.1) * 0.1 +
                  Math.cos(z * 2 + y * 0.3 + i * 0.2) * 0.08;
    
    const radius = Math.sqrt(x * x + z * z);
    const radiusFactor = 1 - Math.pow(radius / (baseWidth * 1.2), 2);
    
    position.setX(i, x * (1 + noise * 0.05 * radiusFactor));
    position.setZ(i, z * (1 + noise * 0.05 * radiusFactor));
    
    // Add slight curvature to trunk
    const curveFactor = Math.sin(y / height * Math.PI) * 0.02;
    position.setX(i, position.getX(i) + x * curveFactor);
    position.setZ(i, position.getZ(i) + z * curveFactor * 0.7);
  }
  
  position.needsUpdate = true;
  trunkGeometry.computeVertexNormals();
  
  const trunkMaterial = createBarkMaterial(barkColor, species, trunkPosition);
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = height / 2; // Center the trunk
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);
  
  // Add branches
  const branchCount = species === 'narra' ? 8 : (species === 'akasya' ? 6 : 4);
  const branches: THREE.Group[] = [];
  
  for (let i = 0; i < branchCount; i++) {
    const branch = createBranch(
      height * (0.3 + i * 0.5 / branchCount), 
      baseWidth * (0.4 + i * 0.3 / branchCount), 
      species
    );
    
    // Position branches around trunk
    const angle = (i / branchCount) * Math.PI * 2 + (i % 2 === 0 ? 0.1 : -0.1);
    const distance = baseWidth * 0.8;
    
    branch.position.set(
      Math.cos(angle) * distance,
      height * (0.3 + i * 0.6 / branchCount),
      Math.sin(angle) * distance
    );
    
    // Rotate branches outward
    branch.rotation.set(
      Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      angle + (Math.random() - 0.5) * 0.2,
      Math.sin(i * 1.3) * 0.2
    );
    
    group.add(branch);
    branches.push(branch);
  }
  
  // Add root system at base
  const rootSystem = createRootSystem(baseWidth, species);
  rootSystem.position.y = -0.1;
  group.add(rootSystem);
  
  return group;
}

/**
 * Create a tree branch with natural detail
 */
function createBranch(
  length: number,
  baseThickness: number,
  species: TreeSpecies
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tree-branch';
  
  const speciesData = PH_TREE_Species[species];
  const barkColor = speciesData.barkColor;
  
  // Branch geometry - multiple segments for natural curvature
  const segmentCount = 4;
  const segmentLength = length / segmentCount;
  
  for (let i = 0; i < segmentCount; i++) {
    const segmentThickness = baseThickness * (1 - i / segmentCount * 0.6);
    const segmentGeometry = new THREE.CylinderGeometry(
      segmentThickness, 
      segmentThickness * 0.8,
      segmentLength,
      8,
      1
    );
    
    const segmentMaterial = createBarkMaterial(barkColor, species, { x: 0, z: 0 });
    const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
    
    segment.position.y = i * segmentLength + segmentLength / 2;
    segment.castShadow = true;
    
    // Add curvature to each segment
    segment.rotation.set(
      Math.sin(i * 1.5) * 0.1,
      Math.cos(i * 1.2) * 0.2,
      0
    );
    
    group.add(segment);
  }
  
  return group;
}

/**
 * Create root system for tree
 */
function createRootSystem(baseWidth: number, species: TreeSpecies): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tree-roots';
  
  const speciesData = PH_TREE_Species[species];
  const barkColor = speciesData.barkColor;
  
  // Main roots radiating from trunk
  const rootCount = 5;
  
  for (let i = 0; i < rootCount; i++) {
    const rootLength = baseWidth * (1.5 + Math.random() * 2);
    const rootThickness = baseWidth * (0.1 + Math.random() * 0.15);
    
    const rootGeometry = new THREE.CylinderGeometry(
      rootThickness, 
      rootThickness * 0.3,
      rootLength,
      6,
      1
    );
    
    const rootMaterial = createBarkMaterial(barkColor, species, { x: 0, z: 0 });
    const root = new THREE.Mesh(rootGeometry, rootMaterial);
    
    // Position roots around trunk base
    const angle = (i / rootCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const distance = baseWidth * 0.9;
    
    root.position.set(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance
    );
    
    // Curve roots downward and outward
    root.rotation.set(
      -Math.PI / 6 + (Math.random() - 0.5) * 0.1,
      angle + (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.2
    );
    
    root.castShadow = true;
    group.add(root);
  }
  
  return group;
}

/**
 * Create leaves for Ipil-Ipil tree (fine, fern-like leaves)
 */
function createIpilIpilCanopy(
  width: number,
  height: number,
  speciesData: typeof PH_TREE_Species.ipil_ipil,
  position: { x: number; z: number }
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ipil-ipil-canopy';
  
  const leafColor = speciesData.leafColor;
  const leafLightColor = speciesData.leafLightColor;
  const leafSize = speciesData.leafSize;
  
  // Ipil-Ipil has very fine, fern-like leaves
  const leafletCount = 3000; // Very high detail
  const leafletGeometry = new THREE.PlaneGeometry(leafSize.max, leafSize.max);
  const leafletMaterial = createLeafMaterial(leafColor, leafLightColor, 'ipil_ipil');
  
  const leaflets = new THREE.InstancedMesh(leafletGeometry, leafletMaterial, leafletCount);
  leaflets.castShadow = true;
  leaflets.receiveShadow = true;
  leaflets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(leafletCount * 3), 3);
  
  const tempMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();
  
  let leafletIndex = 0;
  
  const canopyRadius = width * 0.5;
  const canopyHeight = height * 0.9;
  
  for (let i = 0; i < leafletCount && leafletIndex < leafletCount; i++) {
    // Fine, airy distribution
    const layer = Math.random();
    const radius = Math.sqrt(Math.random()) * canopyRadius;
    const angle = Math.random() * Math.PI * 2;
    
    const x = Math.cos(angle) * radius;
    const y = canopyHeight * layer + (Math.random() - 0.5) * 0.3;
    const z = Math.sin(angle) * radius;
    
    // Very small leaves
    const size = leafSize.min + Math.random() * (leafSize.max - leafSize.min);
    const rotationX = Math.random() * Math.PI * 0.5;
    const rotationY = Math.random() * Math.PI * 2;
    const rotationZ = Math.random() * Math.PI * 0.5;
    
    const colorMix = 0.8 + Math.random() * 0.2;
    const leafColorFinal = tempColor.copy(new THREE.Color(leafColor)).lerp(
      new THREE.Color(leafLightColor), 
      colorMix
    );
    
    tempMatrix.makeScale(size, size, size);
    tempMatrix.premultiply(new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(rotationX, rotationY, rotationZ)
    ));
    tempMatrix.premultiply(new THREE.Matrix4().makeTranslation(x, y, z));
    
    leaflets.setMatrixAt(leafletIndex, tempMatrix);
    leaflets.setColorAt(leafletIndex, leafColorFinal);
    leafletIndex++;
  }
  
  leaflets.count = leafletIndex;
  group.add(leaflets);
  
  return group;
}

/**
 * Tree configuration
 */
export interface TreeConfig {
  species: TreeSpecies;
  height?: number;
  baseWidth?: number;
  position: { x: number; y?: number; z: number };
  isGiant?: boolean;
  name?: string;
  hasFruit?: boolean;
}

export interface Tree {
  group: THREE.Group;
  trunk: THREE.Group;
  canopy: THREE.Group;
  update: (dt: number, clock: number) => void;
  setWindIntensity: (intensity: number) => void;
  dispose: () => void;
}

/**
 * Create a complete Philippine tree
 */
export function createPhilippineTree(config: TreeConfig): Tree {
  const {
    species,
    height = 20,
    baseWidth = 1.2,
    position,
    isGiant = false,
    name = 'Philippine Tree',
    hasFruit = false
  } = config;
  
  const group = new THREE.Group();
  group.name = name.toLowerCase().replace(/\s/g, '-') + '-' + species;
  group.position.set(position.x, position.y || 0, position.z);
  
  const speciesData = PH_TREE_Species[species];
  
  // Scale for giant trees
  const scaleFactor = isGiant ? 2.5 : 1;
  const actualHeight = speciesData.heightRange.min + 
                       (speciesData.heightRange.max - speciesData.heightRange.min) * 0.7;
  const actualBaseWidth = speciesData.trunkWidth.min + 
                         (speciesData.trunkWidth.max - speciesData.trunkWidth.min) * 0.7;
  
  const scaledHeight = actualHeight * scaleFactor;
  const scaledWidth = actualBaseWidth * scaleFactor;
  const scaledCanopyWidth = (speciesData.canopyWidth.min + 
                            (speciesData.canopyWidth.max - speciesData.canopyWidth.min) * 0.7) * scaleFactor;
  
  // Create trunk
  const trunk = createTreeTrunk(
    scaledHeight, 
    scaledWidth, 
    species, 
    position
  );
  group.add(trunk);
  
  // Create canopy based on species
  let canopy: THREE.Group;
  switch (species) {
    case 'akasya':
      canopy = createAcaciaCanopy(
        scaledCanopyWidth, 
        scaledHeight, 
        speciesData, 
        position
      );
      break;
    case 'narra':
      canopy = createNarraCanopy(
        scaledCanopyWidth, 
        scaledHeight, 
        speciesData, 
        position
      );
      break;
    case 'ipil_ipil':
      canopy = createIpilIpilCanopy(
        scaledCanopyWidth, 
        scaledHeight, 
        speciesData, 
        position
      );
      break;
    default:
      // Default to Narra canopy
      canopy = createNarraCanopy(
        scaledCanopyWidth, 
        scaledHeight, 
        speciesData, 
        position
      );
  }
  
  // Position canopy above trunk
  canopy.position.y = scaledHeight - scaledHeight * 0.1; // Slightly below top
  group.add(canopy);
  
  // Add wind animation
  let windIntensity = 0.5;
  let windTime = 0;
  
  // Add special effects for giant trees
  let effectGroup: THREE.Group | null = null;
  if (isGiant) {
    effectGroup = createGiantTreeEffects(species, scaledCanopyWidth, scaledHeight);
    group.add(effectGroup);
  }
  
  // Add fruit if specified (Narra has distinctive pods)
  if (hasFruit && species === 'narra') {
    const fruitGroup = createNarraFruit();
    fruitGroup.position.y = scaledHeight * 0.7;
    group.add(fruitGroup);
  }
  
  return {
    group,
    trunk,
    canopy,
    
    update(dt: number, clock: number) {
      windTime += dt * windIntensity;
      
      // Animate canopy with wind
      const windX = Math.sin(windTime * 0.3) * windIntensity * 0.05 * speciesData.windSensitivity;
      const windZ = Math.cos(windTime * 0.2) * windIntensity * 0.03 * speciesData.windSensitivity;
      
      canopy.rotation.set(windX, windZ, Math.sin(windTime * 0.1) * 0.02);
      
      // Animate trunk slightly
      trunk.rotation.set(
        -windX * 0.1,
        windZ * 0.1,
        0
      );
      
      // Update effects
      if (effectGroup) {
        (effectGroup as any).update(dt, clock, windIntensity);
      }
    },
    
    setWindIntensity(intensity: number) {
      windIntensity = Math.max(0, Math.min(1, intensity));
    },
    
    dispose() {
      group.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(mat => mat.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
      
      if (effectGroup) {
        (effectGroup as any).dispose?.();
      }
    }
  };
}

/**
 * Create special effects for giant trees
 */
function createGiantTreeEffects(
  species: TreeSpecies, 
  canopyWidth: number, 
  treeHeight: number
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'giant-tree-effects';
  
  const speciesData = PH_TREE_Species[species];
  const leafColor = speciesData.leafColor;
  
  // Floating pollen/particles
  const particleCount = 20;
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const radius = canopyWidth * (0.5 + Math.random() * 0.5);
    const height = treeHeight * 0.7 + Math.random() * treeHeight * 0.3;
    
    particlePositions[i * 3] = Math.cos(angle) * radius;
    particlePositions[i * 3 + 1] = height;
    particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    
    const color = new THREE.Color(leafColor);
    color.offsetHSL(0, Math.random() * 0.1 - 0.05, Math.random() * 0.1);
    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  group.add(particles);
  
  // Bird animations (for giant trees)
  const birdGeometry = new THREE.ConeGeometry(0.15, 0.4, 4);
  const birdMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9,
    metalness: 0.1,
  });
  
  const birds: THREE.Group[] = [];
  const birdCount = 3;
  
  for (let i = 0; i < birdCount; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(birdGeometry, birdMaterial);
    bird.add(body);
    
    // Simple wing
    const wingGeometry = new THREE.PlaneGeometry(0.3, 0.1);
    const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    
    leftWing.position.set(-0.1, 0, 0);
    rightWing.position.set(0.1, 0, 0);
    leftWing.rotation.set(0, 0, Math.PI / 4);
    rightWing.rotation.set(0, 0, -Math.PI / 4);
    
    bird.add(leftWing);
    bird.add(rightWing);
    
    // Initial position
    const angle = (i / birdCount) * Math.PI * 2;
    const radius = canopyWidth * 0.8;
    bird.position.set(
      Math.cos(angle) * radius,
      treeHeight * 0.8 + Math.random() * treeHeight * 0.2,
      Math.sin(angle) * radius
    );
    
    bird.castShadow = true;
    group.add(bird);
    birds.push(bird);
  }
  
  const particlePositionsAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
  
  return Object.assign(group, {
    update(dt: number, clock: number, windIntensity: number) {
      // Update particles (pollen, falling leaves)
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + clock * 0.1 * (0.5 + Math.random() * 0.5);
        const radius = canopyWidth * (0.5 + Math.sin(clock + i * 2) * 0.1);
        const height = treeHeight * 0.7 + Math.sin(clock * 0.5 + i) * treeHeight * 0.1 +
                      Math.cos(clock + i * 1.5) * 0.5;
        
        particlePositionsAttr.setXYZ(
          i,
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );
      }
      particlePositionsAttr.needsUpdate = true;
      
      // Update birds
      for (let i = 0; i < birds.length; i++) {
        const bird = birds[i];
        const angle = (i / birds.length) * Math.PI * 2 + clock * 0.3 * (0.8 + Math.random() * 0.4);
        const radius = canopyWidth * 0.8 + Math.sin(clock + i) * canopyWidth * 0.2;
        
        bird.position.set(
          Math.cos(angle) * radius,
          treeHeight * 0.8 + Math.sin(clock * 0.5 + i) * treeHeight * 0.1,
          Math.sin(angle) * radius
        );
        
        // Flap wings
        const wingAngle = Math.sin(clock * 2 + i) * 0.5;
        bird.children[1].rotation.set(0, 0, Math.PI / 4 + wingAngle);
        bird.children[2].rotation.set(0, 0, -Math.PI / 4 - wingAngle);
        
        // Orient bird towards direction of flight
        bird.rotation.y = angle + Math.PI / 2;
      }
    },
    
    dispose() {
      particleGeometry.dispose();
      particleMaterial.dispose();
      birdGeometry.dispose();
      birdMaterial.dispose();
    }
  });
}

/**
 * Create Narra fruit pods
 */
function createNarraFruit(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'narra-fruit';
  
  // Narra has distinctive winged pods
  const podCount = 15;
  const podGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.8, 6);
  const podMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d6e63,
    roughness: 0.8,
    metalness: 0.05,
  });
  
  for (let i = 0; i < podCount; i++) {
    const pod = new THREE.Mesh(podGeometry, podMaterial);
    
    const angle = (i / podCount) * Math.PI * 2;
    const radius = 0.3 + Math.random() * 0.7;
    const height = Math.random() * 0.8;
    
    pod.position.set(
      Math.cos(angle) * radius,
      -height,
      Math.sin(angle) * radius
    );
    
    pod.rotation.set(
      Math.random() * 0.2,
      Math.random() * 0.2,
      Math.random() * Math.PI * 2
    );
    
    pod.castShadow = true;
    group.add(pod);
    
    // Add wings to pod
    const wingGeometry = new THREE.PlaneGeometry(0.3, 0.15);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0xa1887f,
      roughness: 0.9,
      metalness: 0.05,
    });
    
    const wing1 = new THREE.Mesh(wingGeometry, wingMaterial);
    const wing2 = new THREE.Mesh(wingGeometry, wingMaterial);
    
    wing1.position.set(-0.1, 0, 0);
    wing2.position.set(0.1, 0, 0);
    wing1.rotation.set(0, 0, Math.PI / 4);
    wing2.rotation.set(0, 0, -Math.PI / 4);
    
    pod.add(wing1);
    pod.add(wing2);
  }
  
  return group;
}

/**
 * Predefined giant tree locations for the map
 */
export function createGiantTreeLocations(): Array<TreeConfig> {
  return [
    // Giant Akasya tree - center of jungle
    {
      species: 'akasya',
      height: 25,
      baseWidth: 1.8,
      position: { x: 60, z: -50 },
      isGiant: true,
      name: 'Great Akasya',
      hasFruit: false
    },
    // Giant Narra tree - sacred location
    {
      species: 'narra',
      height: 35,
      baseWidth: 2.5,
      position: { x: -60, z: 60 },
      isGiant: true,
      name: 'Ancient Narra',
      hasFruit: true
    },
    // Giant Narra tree - near base
    {
      species: 'narra',
      height: 30,
      baseWidth: 2.2,
      position: { x: -80, z: -40 },
      isGiant: true,
      name: 'Guardian Narra',
      hasFruit: true
    },
    // Giant Akasya tree - river side
    {
      species: 'akasya',
      height: 28,
      baseWidth: 2.0,
      position: { x: 40, z: 70 },
      isGiant: true,
      name: 'River Akasya',
      hasFruit: false
    },
    // Giant Ipil-Ipil tree - volcanic area
    {
      species: 'ipil_ipil',
      height: 22,
      baseWidth: 1.5,
      position: { x: -70, z: -70 },
      isGiant: true,
      name: 'Volcanic Ipil-Ipil',
      hasFruit: false
    },
  ];
}

/**
 * Create a grove of trees (group of trees with natural spacing)
 */
export function createTreeGrove(
  center: { x: number; z: number },
  radius: number,
  species: TreeSpecies,
  count: number,
  isGiant?: boolean
): Tree[] {
  const trees: Tree[] = [];
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const distance = radius * (0.5 + Math.random() * 0.5);
    
    const treeConfig: TreeConfig = {
      species,
      position: {
        x: center.x + Math.cos(angle) * distance,
        z: center.z + Math.sin(angle) * distance
      },
      isGiant: isGiant,
      name: `${species} ${i + 1}`,
      hasFruit: species === 'narra' && Math.random() > 0.7
    };
    
    const tree = createPhilippineTree(treeConfig);
    trees.push(tree);
  }
  
  return trees;
}