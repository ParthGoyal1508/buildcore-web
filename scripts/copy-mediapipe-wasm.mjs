// Copies the MediaPipe vision WASM runtime from node_modules into public/ (057), so the on-device
// face check is served by this app rather than a CDN. Run on install and before dev/build; the
// copy is gitignored — ~28 MB of binaries belongs to the package, not to this repository.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');

// The two variants `FilesetResolver.forVisionTasks` chooses between: SIMD and its fallback.
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

if (!existsSync(from)) {
  console.warn('copy-mediapipe-wasm: @mediapipe/tasks-vision is not installed; skipped.');
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of FILES) copyFileSync(join(from, file), join(to, file));
console.log(`copy-mediapipe-wasm: ${FILES.length} files → public/mediapipe/wasm`);
