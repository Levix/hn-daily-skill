import { writeFile } from 'node:fs/promises';

export async function writeRunManifest(path, manifest) {
  await writeFile(path, JSON.stringify(manifest, null, 2), 'utf8');
}
