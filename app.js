/**
 * Simple IPTV Web Player
 * A single-file Node.js app using Express and the public iptv-org M3U playlist.
 * node D:\Automation\niptv\app.js -- 
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPTV Web Player</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Encode+Sans+Condensed:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/shaka-player@4.15.5/dist/controls.css">
    <script src="https://unpkg.com/shaka-player@4.15.5/dist/shaka-player.ui.js"></script>
    <style>
        :root {
            --bg: #0f1115;
            --surface: #181b21;
            --primary: #3b82f6;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --border: #1e293b;
        }
        body { 
            margin: 0; 
            display: flex; 
            height: 100vh; 
            font-family: 'Encode Sans Condensed', sans-serif; 
            background: var(--bg); 
            color: var(--text); 
        }
        button, input, select, textarea { font: inherit; }
        
        /* Sidebar & Channel List */
        .sidebar { 
            width: 340px; 
            background: var(--surface); 
            display: flex; 
            flex-direction: column; 
            border-right: 1px solid var(--border); 
        }
        .header { 
            padding: 20px; 
            border-bottom: 1px solid var(--border); 
        }
        .header h1 { 
            margin: 0 0 15px 0; 
            font-size: 20px; 
            display: flex; 
            align-items: center; 
            gap: 10px;
        }
        .search-box { 
            width: 100%; 
            padding: 10px 15px; 
            box-sizing: border-box; 
            border-radius: 6px; 
            border: 1px solid var(--border); 
            background: var(--bg); 
            color: var(--text); 
            outline: none;
            transition: border-color 0.2s;
        }
        .search-box:focus { border-color: var(--primary); }
        .filter-row { display: flex; gap: 8px; margin-top: 10px; }
        .filter-select, .reset-button {
            min-width: 0;
            flex: 1;
            padding: 9px 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);
            color: var(--text);
        }
        .reset-button { flex: 0 0 auto; cursor: pointer; }
        .reset-button:hover { border-color: var(--primary); }
        .channel-list { 
            flex: 1; 
            overflow-y: auto; 
            list-style: none; 
            padding: 0; 
            margin: 0; 
        }
        .reset-button svg path { fill: white; }

        .channel-list::-webkit-scrollbar { width: 6px; }
        .channel-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
        .pagination { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
        .pagination button { padding: 7px 10px; border: 1px solid var(--border); border-radius: 5px; background: var(--bg); color: var(--text); cursor: pointer; }
        .pagination button:disabled { cursor: not-allowed; opacity: 0.45; }
        .pagination button svg path { fill: white; }
        .page-info { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
        .channel-item { 
            display: flex; 
            align-items: center; 
            padding: 12px 20px; 
            cursor: pointer; 
            border-bottom: 1px solid var(--bg); 
            transition: background 0.2s;
        }
        .channel-item:hover, .channel-item.active { 
            background: var(--bg); 
            border-left: 4px solid var(--primary);
            padding-left: 16px;
        }
        .channel-logo { 
            width: 48px; 
            height: 48px; 
            object-fit: contain; 
            margin-right: 15px; 
            background: #000; 
            border-radius: 6px; 
            padding: 2px;
        }
        .channel-info { flex: 1; min-width: 0; }
        .channel-name { 
            font-size: 14px; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            margin-bottom: 4px;
        }
        .quality-badge {
            flex: 0 0 auto;
            padding: 2px 6px;
            border: 1px solid var(--primary);
            border-radius: 999px;
            color: #bfdbfe;
            background: rgba(59, 130, 246, 0.18);
            font-size: 10px;
            font-weight: 700;
            line-height: 1.2;
        }
        .channel-group { font-size: 12px; color: var(--text-muted); }
        
        /* Main Player */
        .main-content { flex: 1; display: flex; flex-direction: column; }
        .video-container { 
            flex: 1; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            background: #000;
            overflow: hidden;
        }
        .shaka-video-container {
            width: 100%;
            max-height: 100%;
            aspect-ratio: var(--player-aspect-ratio, 16 / 9);
        }
        video { width: 100%; height: 100%; object-fit: fill; }
        .now-playing { 
            padding: 20px 30px; 
            background: var(--surface); 
            border-top: 1px solid var(--border); 
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .np-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
            /* background: #fff; */
            border-radius: 8px;
            display: none;
        }
        .np-details { flex: 1; }
        .player-options { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 13px; }
        .aspect-select { padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
        #npTitle { margin: 0 0 5px 0; font-size: 22px; }
        #npSchedule { margin: 0; color: var(--text-muted); font-size: 14px; }
        .status-msg { padding: 20px; text-align: center; color: var(--text-muted); }

        /* Responsive UI */
        @media (max-width: 768px) {
            body { flex-direction: column-reverse; } /* Stacks channel list under video */
            .sidebar { width: 100%; flex: 1; border-right: none; }
            .main-content { flex: 0 0 40vh; }
            .now-playing { padding: 15px; }
            #npTitle { font-size: 18px; }
            .np-logo { width: 45px; height: 45px; }
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="header">
            <h1>IPTV Player</h1>
            <input type="text" id="searchInput" class="search-box" placeholder="Search channels (e.g., News, BBC)...">
            <div class="filter-row">
                <select id="countryFilter" class="filter-select" aria-label="Filter by country">
                    <option value="">All countries</option>
                </select>
                <select id="categoryFilter" class="filter-select" aria-label="Filter by category">
                    <option value="">All categories</option>
                </select>
                <button type="button" id="resetButton" class="reset-button">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
    <path fill="white" d="M48.5 224L40 224c-13.3 0-24-10.7-24-24L16 72c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2L98.6 96.6c87.6-86.5 228.7-86.2 315.8 1c87.5 87.5 87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3c-62.2-62.2-162.7-62.5-225.3-1L185 183c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8L48.5 224z"/>
  </svg>
</button>

            </div>
        </div>
        <ul class="channel-list" id="channelList">
            <div class="status-msg" id="loadingMsg">Loading channels...</div>
        </ul>
        <div class="pagination" id="pagination" hidden>
            <button type="button" id="previousPage" aria-label="Previous Page">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
                <path d="M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160zm352-160l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L301.3 256 438.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0z"/>
                </svg>
            </button>

            <span class="page-info" id="pageInfo"></span>

            <button type="button" id="nextPage" aria-label="Next Page">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
                <path d="M470.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 256 265.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160zm-352 160l160-160c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L210.7 256 73.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z"/>
                </svg>
            </button>
        </div>

    </div>
    
    <div class="main-content">
        <div class="video-container">
            <div class="shaka-video-container" data-shaka-player-container>
                <video id="video" data-shaka-player autoplay></video>
            </div>
        </div>
        <div class="now-playing">
            <img id="npLogo" class="np-logo" src="" alt="Logo">
            <div class="np-details">
                <h2 id="npTitle">Select a channel to play</h2>
                <p id="npSchedule">Live Stream</p>
            </div>
            <label class="player-options">
                Aspect
                <select id="aspectRatioSelect" class="aspect-select" aria-label="Player aspect ratio">
                    <option value="16 / 9" selected>16:9</option>
                    <option value="4 / 3">4:3</option>
                    <option value="21 / 9">21:9</option>
                    <option value="1 / 1">1:1</option>
                    <option value="9 / 16">9:16</option>
                </select>
            </label>
        </div>
    </div>

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

            new shaka.ui.Overlay(
                player,
                document.querySelector('.shaka-video-container'),
                video
            );
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
                document.getElementById('channelList').innerHTML = '<div class="status-msg">Failed to load channels.</div>';
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

        function renderChannels() {
            const channels = getFilteredChannels();
            const list = document.getElementById('channelList');
            list.innerHTML = '';

            const totalPages = Math.max(1, Math.ceil(channels.length / pageSize));
            currentPage = Math.min(currentPage, totalPages);
            const pageStart = (currentPage - 1) * pageSize;
            const pageChannels = channels.slice(pageStart, pageStart + pageSize);

            if (channels.length === 0) {
                list.innerHTML = '<div class="status-msg">No channels found</div>';
            } else {
                pageChannels.forEach(function(channel) {
                    const li = document.createElement('li');
                    li.className = 'channel-item' + (channel.url === activeChannelUrl ? ' active' : '');

                    const logo = document.createElement('img');
                    logo.className = 'channel-logo';
                    logo.src = channel.logo;
                    logo.alt = 'logo';
                    logo.onerror = function() { this.style.display = 'none'; };

                    const info = document.createElement('div');
                    info.className = 'channel-info';

                    const name = document.createElement('div');
                    name.className = 'channel-name';

                    const nameText = document.createElement('span');
                    nameText.textContent = channel.name || 'Unknown channel';
                    name.appendChild(nameText);

                    if (channel.quality) {
                        const quality = document.createElement('span');
                        quality.className = 'quality-badge';
                        quality.textContent = channel.quality;
                        name.appendChild(quality);
                    }

                    const group = document.createElement('div');
                    group.className = 'channel-group';
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
            document.querySelectorAll('.channel-item').forEach(function(el) { el.classList.remove('active') });
            if (element) element.classList.add('active');
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
            npLogo.style.display = 'block';
            npLogo.onerror = function() { this.style.display = 'none'; };

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
    console.log('IPTV Player running at http://localhost:' + PORT);
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