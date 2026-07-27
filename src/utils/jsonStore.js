/* =========================================================================
   jsonStore.js
   Tiny helper around the filesystem so controllers don't repeat
   read/parse/stringify/write boilerplate. This is the entire "storage
   layer" for this project — no database, just JSON files on disk.
   ========================================================================= */

const fs = require('fs/promises');

/**
 * Reads and parses a JSON file. If the file doesn't exist yet, returns
 * `fallback` instead of throwing (so a fresh checkout with empty data
 * files still works on first run).
 */
async function readJSON(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/** Writes a JS value back to disk as pretty-printed JSON. */
async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

module.exports = { readJSON, writeJSON };
