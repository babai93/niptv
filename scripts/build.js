/**
 * Builds the static site for Netlify into dist/:
 * the player UI from app.js plus the icons and web manifest.
 * The /api/* routes are served by Netlify Functions in netlify/functions.
 */

const fs = require('fs');
const path = require('path');
const { HTML_UI } = require('../app.js');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const STATIC_FILES = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'ntv.svg',
    'site.webmanifest'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), HTML_UI.trim() + '\n');
for (const file of STATIC_FILES) {
    fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

console.log('Built static site to dist/');
