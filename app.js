/**
 * Simple IPTV Web Player
 * A single-file Node.js app using Express and the public iptv-org M3U playlist.
 * node.exe D:\Automation\niptv\app.js -- 
 */

const express = require('express');
const https = require('https');
const app = express();
const PORT = 3000;
const IPTV_API = 'https://iptv-org.github.io/api';

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                fetchJson(response.headers.location).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error('Request failed with status ' + response.statusCode));
                return;
            }

            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => { body += chunk; });
            response.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
}

// Proxy the public iptv-org M3U list through the Node backend 
// to avoid any client-side CORS restrictions and streamline delivery.
app.get('/api/channels', (req, res) => {
    const m3uUrl = 'https://iptv-org.github.io/iptv/index.m3u';
    
    const request = https.get(m3uUrl, (response) => {
        // Handle potential redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            https.get(response.headers.location, (redirectRes) => {
                res.header('Content-Type', 'text/plain');
                redirectRes.pipe(res);
            });
        } else {
            res.header('Content-Type', 'text/plain');
            response.pipe(res);
        }
    }).on('error', (err) => {
        console.error('Proxy error:', err);
        res.status(500).send('Error fetching channels');
    });
});

const HTML_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>NIPTV Web Player</title>
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.css" integrity="sha512-x9WwyMYBnlXMNQ6kQ/Lyzu1NqIhLQKL5Oq6xByfXuRj7s9CskyCbLv/1IjqzJmXwFXWr0ov6jBV7Qbc0hh9nHg==" crossorigin="anonymous" referrerpolicy="no-referrer">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Encode+Sans+Condensed:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/shaka-player@4.15.5/dist/controls.css">
    <script src="https://unpkg.com/shaka-player@4.15.5/dist/shaka-player.ui.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        :root { --player-aspect-ratio: 16 / 9; }
        html, body { height: 100%; }
        body { font-family: 'Encode Sans Condensed', sans-serif; overscroll-behavior: none; }
        button, input, select, textarea { font: inherit; }
        /* Slim scrollbars for the channel list */
        .thin-scroll::-webkit-scrollbar { width: 6px; }
        .thin-scroll::-webkit-scrollbar-track { background: transparent; }
        .thin-scroll::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 999px; }
        .shaka-video-container { aspect-ratio: var(--player-aspect-ratio, 16 / 9); }
        #menu-toggle { display: none; }
        .menu-btn { position: fixed; top: 22px; right: 22px; z-index: 50; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background-color: rgba(30, 41, 59, 0.4); border-radius: 12px; cursor: pointer; transition: background-color 0.3s ease-in-out; opacity: 0.5; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);}
        .menu-btn:hover { background-color: rgba(51, 65, 85, 0.6); opacity: 1; }
        .menu-btn i { position: absolute; font-size: 18px; color: #f8fafc; transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out; }
        .menu-btn .fa-bars { transform: rotate(0deg); opacity: 0; }
        .menu-btn .fa-xmark { transform: rotate(90deg); opacity: 1; }
        #menu-toggle:checked ~ #sidebar { display: none; }
        #menu-toggle:checked + .menu-btn .fa-xmark { transform: rotate(0deg); opacity: 0; }
        #menu-toggle:checked + .menu-btn .fa-bars { transform: rotate(0deg); opacity: 1; }
        @media (max-width: 768px) { #menu-toggle, .menu-btn { display: none; }}
        .shaka-video-container.aspect-16-9 video { aspect-ratio: 16 / 9; width: 100%; height: auto; }
        .shaka-video-container.aspect-fill video { width: 100%; height: 100%; object-fit: cover; }

    </style>
</head>
<body class="h-dvh w-full flex flex-col md:flex-row bg-slate-950 text-slate-50 overflow-hidden">

    <!-- Mobile top bar -->
    <div class="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div class="flex items-center gap-2 font-bold text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20" class="text-blue-500 flex-shrink-0">
                <path fill="currentColor" d="M64 64C28.7 64 0 92.7 0 128L0 352c0 35.3 28.7 64 64 64l112 0-10.7 32L128 448c-17.7 0-32 14.3-32 32s14.3 32 32 32l256 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-37.3 0L336 416l112 0c35.3 0 64-28.7 64-64l0-224c0-35.3-28.7-64-64-64L64 64zm0 64l384 0 0 224L64 288l0-160z"/>
            </svg>
            <span>NIPTV Player</span>
        </div>
        <button type="button" id="openSidebarBtn" class="p-2.5 rounded-xl bg-slate-800 active:bg-slate-700" aria-label="Browse channels">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="18" height="18">
                <path fill="white" d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/>
            </svg>
        </button>
    </div>

    <!-- Sidebar backdrop (mobile only) -->
    <div id="sidebarBackdrop" class="fixed inset-0 bg-black/60 z-30 opacity-0 pointer-events-none transition-opacity duration-300 md:hidden"></div>

    <!-- Sidebar toggle -->
    <input type="checkbox" id="menu-toggle"> 
    <label for="menu-toggle" class="menu-btn">
        <i class="fa-solid fa-bars"></i>
        <i class="fa-solid fa-xmark"></i>
    </label>

    <!-- Sidebar / channel browser -->
    <aside id="sidebar" class="fixed md:static inset-y-0 left-0 z-40 w-[86vw] max-w-sm md:w-[360px] md:max-w-none h-full md:h-auto bg-slate-900 md:border-r border-slate-800 flex flex-col -translate-x-full md:translate-x-0 transition-transform duration-300 ease-out">
        <div class="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-800 flex-shrink-0 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <h1 class="m-0 text-xl font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20" class="text-blue-500 hidden md:block flex-shrink-0">
                    <path fill="currentColor" d="M64 64C28.7 64 0 92.7 0 128L0 352c0 35.3 28.7 64 64 64l112 0-10.7 32L128 448c-17.7 0-32 14.3-32 32s14.3 32 32 32l256 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-37.3 0L336 416l112 0c35.3 0 64-28.7 64-64l0-224c0-35.3-28.7-64-64-64L64 64zm0 64l384 0 0 224L64 288l0-160z"/>
                </svg>
                <span>NIPTV Player</span>
            </h1>
            <button type="button" id="closeSidebarBtn" class="md:hidden p-2 rounded-lg hover:bg-slate-800 active:bg-slate-800" aria-label="Close channel list">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="16" height="16">
                    <path fill="white" d="M242.7 256l100.1-100.1c12.3-12.3 12.3-32.2 0-44.5-12.3-12.3-32.2-12.3-44.5 0L198.2 211.5 98.1 111.4c-12.3-12.3-32.2-12.3-44.5 0-12.3 12.3-12.3 32.2 0 44.5l100.1 100.1L53.6 356.1c-12.3 12.3-12.3 32.2 0 44.5 12.3 12.3 32.2 12.3 44.5 0l100.1-100.1 100.1 100.1c12.3 12.3 32.2 12.3 44.5 0 12.3-12.3 12.3-32.2 0-44.5L242.7 256z"/>
                </svg>
            </button>
        </div>

        <div class="px-4 py-4 border-b border-slate-800 flex-shrink-0 space-y-2.5">
            <div class="relative">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="15" height="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <path fill="currentColor" d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
                </svg>
                <input type="text" id="searchInput" class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm placeholder:text-slate-500 transition-colors" placeholder="Search channels (e.g., News, BBC)...">
            </div>
            <div class="flex gap-2">
                <select id="countryFilter" class="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none text-sm py-2.5 px-2.5" aria-label="Filter by country">
                    <option value="">All countries</option>
                </select>
                <select id="categoryFilter" class="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 focus:border-blue-500 outline-none text-sm py-2.5 px-2.5" aria-label="Filter by category">
                    <option value="">All categories</option>
                </select>
                <button type="button" id="resetButton" class="flex-shrink-0 rounded-xl bg-slate-800 hover:bg-blue-600 active:bg-blue-600 transition-colors p-2.5" aria-label="Reset filters">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16">
                        <path fill="white" d="M48.5 224L40 224c-13.3 0-24-10.7-24-24L16 72c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2L98.6 96.6c87.6-86.5 228.7-86.2 315.8 1c87.5 87.5 87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3c-62.2-62.2-162.7-62.5-225.3-1L185 183c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8L48.5 224z"/>
                    </svg>
                </button>
            </div>
        </div>

        <ul id="channelList" class="thin-scroll flex-1 min-h-0 overflow-y-auto list-none m-0 py-2">
            <div class="status-msg px-5 py-10 text-center text-slate-400 text-sm" id="loadingMsg">Loading channels&hellip;</div>
        </ul>

        <div class="pagination flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-800 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]" id="pagination" hidden>
            <button type="button" id="previousPage" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Previous Page">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="18" height="18">
                <path fill="white" d="M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160zm352-160l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L301.3 256 438.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0z"/>
                </svg>
            </button>

            <span class="page-info text-xs text-slate-400 whitespace-nowrap" id="pageInfo"></span>

            <button type="button" id="nextPage" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Next Page">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="18" height="18">
                <path fill="white" d="M470.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 256 265.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160zm-352 160l160-160c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L210.7 256 73.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z"/>
                </svg>
            </button>
        </div>
    </aside>

    <!-- Main player area -->
    <main class="flex-1 min-w-0 min-h-0 flex flex-col">
        <div class="relative flex-shrink-0 md:flex-1 md:min-h-0 bg-black flex items-center justify-center">
            <div class="shaka-video-container w-full md:max-h-full" data-shaka-player-container>
                <video id="video" data-shaka-player autoplay class="w-full h-full object-contain md:object-fill"></video>
            </div>
        </div>
        <div class="now-playing flex items-center gap-4 px-4 md:px-6 py-3 md:py-4 bg-slate-900 border-t border-slate-800 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4">
            <img id="npLogo" class="np-logo hidden w-11 h-11 md:w-14 md:h-14 object-contain rounded-lg bg-white/5 ring-1 ring-slate-800 flex-shrink-0" src="" alt="Logo">
            <div class="np-details min-w-0 flex-1">
                <h2 id="npTitle" class="m-0 text-base md:text-xl font-bold truncate">Select a channel to play</h2>
                <p id="npSchedule" class="m-0 text-xs md:text-sm text-slate-400 truncate">Live Stream</p>
            </div>
            <label class="player-options hidden sm:flex items-center gap-2 text-xs text-slate-400 flex-shrink-0">
                Aspect
                <select id="aspectRatioSelect" class="aspect-select rounded-lg bg-slate-950 border border-slate-800 text-xs py-1.5 px-2 text-slate-200" aria-label="Player aspect ratio">
                    <option value="16 / 9" selected>16:9</option>
                    <option value="4 / 3">4:3</option>
                    <option value="21 / 9">21:9</option>
                    <option value="1 / 1">1:1</option>
                    <option value="9 / 16">9:16</option>
                </select>
            </label>
        </div>
    </main>

    <script>
        let allChannels = [];
        let player = null;
        let currentPage = 1;
        let activeChannelUrl = null;
        let channelMetadata = new Map();
        let countryMetadata = new Map();
        let categoryMetadata = new Map();
        const pageSize = 50;
        const video = document.getElementById('video');
        const mobileMediaQuery = window.matchMedia('(max-width: 767px)');

        async function initializePlayer() {
            shaka.polyfill.installAll();

            if (!shaka.Player.isBrowserSupported()) {
                document.getElementById('npSchedule').innerText = 'This browser does not support video playback.';
                return;
            }

            player = new shaka.Player(video);
            player.addEventListener('error', function(event) {
                console.error('Shaka Player error:', event.detail);
            });

            const ui = new shaka.ui.Overlay(
                player,
                document.querySelector('.shaka-video-container'),
                video
            );

            const controls = ui.getControls();

            // Register custom aspect ratio button
            controls.addButton('aspect', () => {
                // Create button element
                const button = document.createElement('button');
                button.classList.add('shaka-aspect-button');
                button.textContent = 'Aspect';

                // Toggle aspect ratio on click
                button.addEventListener('click', () => {
                const container = document.querySelector('.shaka-video-container');
                container.classList.toggle('aspect-16-9');
                container.classList.toggle('aspect-fill');
                });

                return button;
            });
        }

        async function fetchChannels() {
            try {
                const [playlistResponse, metadataResponse] = await Promise.all([
                    fetch('/api/channels'),
                    fetch('/api/metadata')
                ]);
                const playlist = await playlistResponse.text();
                const metadata = await metadataResponse.json();

                channelMetadata = new Map(metadata.channels.map(function(channel) {
                    return [channel.id, channel];
                }));
                countryMetadata = new Map(metadata.countries.map(function(country) {
                    return [country.code, country.name];
                }));
                categoryMetadata = new Map(metadata.categories.map(function(category) {
                    return [category.id, category.name];
                }));
                parseM3U(playlist);
                
                document.getElementById('loadingMsg').style.display = 'none';
                populateFilters();
                renderChannels();
            } catch (error) {
                document.getElementById('channelList').innerHTML = '<div class="status-msg px-5 py-10 text-center text-slate-400 text-sm">Failed to load channels.</div>';
                console.error(error);
            }
        }

        // Lightweight client-side M3U Parser
        function parseM3U(m3uData) {
            const lines = m3uData.split('\\n');
            let currentChannel = null;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                
                if (line.startsWith('#EXTINF:')) {
                    const idMatch = line.match(/tvg-id="([^"]*)"/);
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    const countryMatch = line.match(/tvg-country="([^"]*)"/);
                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    const rawName = splitExtinfLabel(line);
                    const qualityInfo = extractQualityFromName(rawName);
                    const baseName = qualityInfo.name;
                    const playlistId = idMatch ? idMatch[1] : '';
                    const channelId = playlistId.replace(/@[^@]+$/, '');
                    const metadata = channelMetadata.get(channelId) || channelMetadata.get(playlistId);
                    const idCountryMatch = channelId.match(/\.([a-z]{2})$/i);
                    const countryCode = metadata && metadata.country
                        ? metadata.country
                        : countryMatch && countryMatch[1]
                            ? countryMatch[1]
                            : idCountryMatch && idCountryMatch[1].toUpperCase();
                    const rawGroups = metadata && metadata.categories ? metadata.categories : groupMatch && groupMatch[1];
                    const groups = (Array.isArray(rawGroups) ? rawGroups : String(rawGroups || 'Uncategorized').split(/[;,]/))
                        .map(function(category) { return categoryMetadata.get(category) || category; })
                        .map(function(category) { return category.replace(/^\\s*-\\s*/, '').trim(); })
                        .filter(Boolean);
                    const metadataName = metadata && metadata.name ? cleanChannelName(metadata.name) : '';
                    const parsedName = cleanChannelName(baseName);
                    const fallbackName = cleanChannelName(channelId.replace(/\.[a-z]{2}$/i, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2'));
                    const displayName = metadataName || parsedName || fallbackName || 'Unknown channel';
                    
                    currentChannel = {
                        name: displayName,
                        quality: qualityInfo.qualityBadge,
                        logo: (logoMatch && logoMatch[1]) ? logoMatch[1] : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlIi8+PC9zdmc+',
                        country: countryMetadata.get(countryCode) || countryCode || 'Unknown',
                        categories: groups,
                        group: groups.join(' • ')
                    };
                } else if (line.startsWith('http') && currentChannel) {
                    currentChannel.url = line;
                    allChannels.push(currentChannel);
                    currentChannel = null;
                }
            }
        }

        function splitExtinfLabel(line) {
            let inQuotes = false;
            let quoteChar = '';

            for (let index = 0; index < line.length; index++) {
                const char = line[index];

                if ((char === '"' || char === "'") && (quoteChar === '' || char === quoteChar)) {
                    inQuotes = !inQuotes;
                    quoteChar = inQuotes ? char : '';
                    continue;
                }

                if (char === ',' && !inQuotes) {
                    return line.slice(index + 1).replace(/\s+/g, ' ').trim();
                }
            }

            return '';
        }

        function extractQualityFromName(name) {
            const normalizedName = String(name || '').replace(/\s+/g, ' ').trim();
            const qualityMatch = normalizedName.match(/\((\d{3,4}[pi])\)/i);

            if (!qualityMatch) {
                return { name: cleanChannelName(normalizedName), qualityBadge: '' };
            }

            const quality = qualityMatch[1].toLowerCase();
            const qualityBadge = /1080p/i.test(quality)
                ? 'FHD'
                : /720p/i.test(quality)
                    ? 'HD'
                    : /(576p|576i|540p|504p|480p|360p|270p|240p)/i.test(quality)
                        ? 'SD'
                        : quality.toUpperCase();
            const baseName = cleanChannelName(normalizedName.replace(new RegExp('\\s*\\(' + qualityMatch[1] + '\\)', 'i'), ''));

            return { name: baseName, qualityBadge: qualityBadge };
        }

        function stripTrailingMetadata(name) {
            return name
                .replace(/\(\s*\)/g, '')
                .replace(/\s*(?:\[[^\]]+\]|\((?:HEVC|H265|H264|AVC|VP9|AV1|SDR|HDR|UHD|4K|\d{3,4}[pi])\))\s*$/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function cleanChannelName(name) {
            return stripTrailingMetadata(String(name))
                .replace(/\(\s*\)/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function populateFilters() {
            const countries = Array.from(new Set(allChannels.map(function(channel) { return channel.country; }))).filter(Boolean).sort();
            const categories = Array.from(new Set(allChannels.reduce(function(values, channel) {
                return values.concat(channel.categories);
            }, []))).filter(Boolean).sort();
            const countryFilter = document.getElementById('countryFilter');
            const categoryFilter = document.getElementById('categoryFilter');

            countries.forEach(function(country) {
                countryFilter.appendChild(new Option(country, country));
            });
            categories.forEach(function(category) {
                categoryFilter.appendChild(new Option(category, category));
            });
        }

        function getFilteredChannels() {
            const term = document.getElementById('searchInput').value.toLowerCase().trim();
            const country = document.getElementById('countryFilter').value;
            const category = document.getElementById('categoryFilter').value;

            return allChannels.filter(function(channel) {
                const matchesSearch = !term || channel.name.toLowerCase().includes(term) || channel.group.toLowerCase().includes(term);
                const matchesCountry = !country || channel.country === country;
                const matchesCategory = !category || channel.categories.includes(category);
                return matchesSearch && matchesCountry && matchesCategory;
            });
        }

        function setChannelItemActive(el, isActive) {
            el.classList.toggle('active', isActive);
            el.classList.toggle('bg-slate-800', isActive);
            el.classList.toggle('ring-1', isActive);
            el.classList.toggle('ring-inset', isActive);
            el.classList.toggle('ring-blue-500/60', isActive);
            el.classList.toggle('hover:bg-slate-800/60', !isActive);
        }

        function renderChannels() {
            const channels = getFilteredChannels();
            const list = document.getElementById('channelList');
            list.innerHTML = '';

            const totalPages = Math.max(1, Math.ceil(channels.length / pageSize));
            currentPage = Math.min(currentPage, totalPages);
            const pageStart = (currentPage - 1) * pageSize;
            const pageChannels = channels.slice(pageStart, pageStart + pageSize);

            if (channels.length === 0) {
                list.innerHTML = '<div class="status-msg px-5 py-10 text-center text-slate-400 text-sm">No channels found</div>';
            } else {
                pageChannels.forEach(function(channel) {
                    const isActive = channel.url === activeChannelUrl;
                    const li = document.createElement('li');
                    li.className = 'channel-item flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-xl cursor-pointer transition-colors' + (isActive ? ' active bg-slate-800 ring-1 ring-inset ring-blue-500/60' : ' hover:bg-slate-800/60');

                    const logo = document.createElement('img');
                    logo.className = 'channel-logo w-11 h-11 md:w-12 md:h-12 flex-shrink-0 object-contain bg-black rounded-lg p-1 ring-1 ring-slate-800';
                    logo.src = channel.logo;
                    logo.alt = 'logo';
                    logo.onerror = function() {
                        this.onerror = null;
                        this.src = 'https://placehold.co/96x96/1e293b/64748b?text=TV';
                    };

                    const info = document.createElement('div');
                    info.className = 'channel-info min-w-0 flex-1';

                    const name = document.createElement('div');
                    name.className = 'channel-name flex items-center gap-2 text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis mb-0.5';

                    const nameText = document.createElement('span');
                    nameText.className = 'overflow-hidden text-ellipsis';
                    nameText.textContent = channel.name || 'Unknown channel';
                    name.appendChild(nameText);

                    if (channel.quality) {
                        const quality = document.createElement('span');
                        quality.className = 'quality-badge flex-shrink-0 px-1.5 py-0.5 rounded-full border border-blue-500 bg-blue-500/15 text-blue-300 text-[10px] font-bold leading-tight';
                        quality.textContent = channel.quality;
                        name.appendChild(quality);
                    }

                    const group = document.createElement('div');
                    group.className = 'channel-group text-xs text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis';
                    group.textContent = channel.group;

                    info.appendChild(name);
                    info.appendChild(group);
                    li.appendChild(logo);
                    li.appendChild(info);
                    
                    li.onclick = function() { playChannel(channel, li); };
                    list.appendChild(li);
                });
            }
            updatePagination(channels.length, totalPages);
        }

        function updatePagination(totalChannels, totalPages) {
            const pagination = document.getElementById('pagination');
            pagination.hidden = totalChannels === 0;
            document.getElementById('pageInfo').innerText = 'Page ' + currentPage + ' of ' + totalPages;
            document.getElementById('previousPage').disabled = currentPage === 1;
            document.getElementById('nextPage').disabled = currentPage === totalPages;
        }

        function playChannel(channel, element) {
            // UI Updates
            document.querySelectorAll('.channel-item.active').forEach(function(el) { setChannelItemActive(el, false); });
            if (element) setChannelItemActive(element, true);
            activeChannelUrl = channel.url;

            document.getElementById('npTitle').innerText = channel.name;
            
            /* 
             * Note on EPG (Guide) Data: 
             * True EPG support requires parsing heavy XMLTV files in a database backend 
             * as parsing 100MB+ of iptv-org XMLTV data client-side is too slow for a browser.
             * Here, we display the category as a graceful fallback.
             */
            document.getElementById('npSchedule').innerText = channel.group + ' • Now Playing';
            
            const npLogo = document.getElementById('npLogo');
            npLogo.src = channel.logo;
            npLogo.classList.remove('hidden');
            npLogo.onerror = function() {
                this.onerror = null;
                this.src = 'https://placehold.co/112x112/1e293b/64748b?text=TV';
            };

            if (mobileMediaQuery.matches) {
                closeSidebar();
            }

            if (!player) return;

            player.load(channel.url).then(function() {
                video.play().catch(function() { console.log('Autoplay requires interaction'); });
            }).catch(function(error) {
                console.error('Unable to load stream:', error);
                document.getElementById('npSchedule').innerText = 'Unable to play this stream.';
            });
        }

        function resetFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('countryFilter').value = '';
            document.getElementById('categoryFilter').value = '';
            currentPage = 1;
            renderChannels();
        }

        function setPlayerAspectRatio(ratio) {
            document.querySelector('.shaka-video-container').style.setProperty('--player-aspect-ratio', ratio);
        }

        function openSidebar() {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('opacity-0', 'pointer-events-none');
        }

        function closeSidebar() {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('opacity-0', 'pointer-events-none');
        }

        document.getElementById('openSidebarBtn').addEventListener('click', openSidebar);
        document.getElementById('closeSidebarBtn').addEventListener('click', closeSidebar);
        document.getElementById('sidebarBackdrop').addEventListener('click', closeSidebar);
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') closeSidebar();
        });
        mobileMediaQuery.addEventListener('change', function(event) {
            if (!event.matches) closeSidebar();
        });

        document.getElementById('searchInput').addEventListener('input', function() {
            currentPage = 1;
            renderChannels();
        });
        document.getElementById('countryFilter').addEventListener('change', function() {
            currentPage = 1;
            renderChannels();
        });
        document.getElementById('categoryFilter').addEventListener('change', function() {
            currentPage = 1;
            renderChannels();
        });
        document.getElementById('resetButton').addEventListener('click', resetFilters);
        document.getElementById('aspectRatioSelect').addEventListener('change', function(event) {
            setPlayerAspectRatio(event.target.value);
        });
        document.getElementById('previousPage').addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderChannels();
            }
        });
        document.getElementById('nextPage').addEventListener('click', function() {
            const totalPages = Math.max(1, Math.ceil(getFilteredChannels().length / pageSize));
            if (currentPage < totalPages) {
                currentPage++;
                renderChannels();
            }
        });

        initializePlayer();
        fetchChannels();
    </script>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(HTML_UI);
});

app.listen(PORT, () => {
    console.log('NIPTV Player running at http://localhost:' + PORT);
});

app.get('/api/metadata', async (req, res) => {
    try {
        const [channels, countries, categories] = await Promise.all([
            fetchJson(IPTV_API + '/channels.json'),
            fetchJson(IPTV_API + '/countries.json'),
            fetchJson(IPTV_API + '/categories.json')
        ]);
        res.json({ channels, countries, categories });
    } catch (error) {
        console.error('Metadata error:', error);
        res.status(500).send('Error fetching channel metadata');
    }
});