import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/*
 * The one GLTF loader.
 *
 * There were three, constructed separately in actor.ts, models.ts and
 * backdrop.ts, which is the same "one behaviour, several implementations"
 * pattern that AGENTS.md now forbids. It mattered here: the shipped models are
 * meshopt compressed, and a loader without the decoder installed fails on them.
 * Three loaders meant three places to forget.
 *
 * Meshopt rather than Draco on purpose. The decoder is a module three.js already
 * ships, so it bundles with the app; Draco needs its wasm and js decoder files
 * hosted and fetched separately, which is one more thing to get wrong in an
 * offline Android build.
 *
 * Compress with: node scripts/compress-models.mjs --meshopt --write
 */
export const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
