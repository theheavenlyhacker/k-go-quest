// Downloads the coach model into assets/models so the build can bundle it. Run once: npm run fetch-model
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

const MODEL_URL = 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf';
const dest = new URL('../assets/models/coach.gguf', import.meta.url);
if (existsSync(dest)) { console.log('coach.gguf already there'); process.exit(0); }
mkdirSync(new URL('../assets/models/', import.meta.url), { recursive: true });
const res = await fetch(MODEL_URL);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
const part = new URL('../assets/models/coach.part', import.meta.url);
await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
renameSync(part, dest); // a half download never counts as the model
console.log('coach.gguf saved');
