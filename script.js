// Theme Manager
const themeManager = {
    currentTheme: localStorage.getItem('theme') || 'dark',
    
    init() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('theme-toggle');
            if(btn) {
                btn.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleTheme();
                });
            }
        });
    },
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        
        const btn = document.getElementById('theme-toggle');
        if(btn) btn.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
        
        // Broadcast the change so canvases can repaint
        window.dispatchEvent(new Event('themeChanged'));
    },
    
    getColors() {
        if (this.currentTheme === 'light') {
            return {
                bg: '#E8E6E1', // Muted bone/paper
                void: '#D6D2C9', // Slightly darker cutout for the black hole
                accent: '#2A603B', // Deep Green
                particleColors: ["#2A603B", "#B8860B", "#8B5A2B", "#555555"], // Green, Gold, Wood, Gray
                loaderDarkish: '#C2BEB4', 
                loaderAccent: '#2A603B',
                rimGlow: 'rgba(42, 96, 59,' // Deep Green glow
            };
        } else {
            return {
                bg: '#000000', // Pure Black
                void: '#000000',
                accent: '#4dff7a', // Hacker Green
                particleColors: ["#4dff7a", "#ffffff", "#33cc66", "#ccffdd"], // Green, White
                loaderDarkish: '#04170b', 
                loaderAccent: '#4dff7a',
                rimGlow: 'rgba(77, 255, 122,' // Hacker Green glow
            };
        }
    }
};

// Initialize immediately to prevent flash of wrong theme
themeManager.init();

// Loading Screen Script
(function initLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    const canvas = document.getElementById('loading-canvas');
    const avatarImg = document.getElementById('loading-avatar');
    const barFill = document.getElementById('loading-bar-fill');
    const percentLabel = document.getElementById('loading-percent');
    const siteContent = document.getElementById('site-content');
    if (!screen || !canvas) return;

    const ctx = canvas.getContext('2d');
    const GRID = 64; 
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function sizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
    }

    let imgLoaded = false;
    let imgFailed = false;
    let cellBrightness = null;
    let cellColors = null; // Store actual image RGB colors

    function sampleImage() {
        try {
            const sample = document.createElement('canvas');
            sample.width = GRID;
            sample.height = GRID;
            const sctx = sample.getContext('2d');
            sctx.drawImage(avatarImg, 0, 0, GRID, GRID);
            const data = sctx.getImageData(0, 0, GRID, GRID).data;
            
            const brightnessArr = new Float32Array(GRID * GRID);
            const colorArr = [];
            
            for (let i = 0; i < GRID * GRID; i++) {
                const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
                brightnessArr[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                colorArr.push(`rgb(${r}, ${g}, ${b})`);
            }
            cellBrightness = brightnessArr;
            cellColors = colorArr;
            imgLoaded = true;
        } catch (e) {
            console.error("PROFILE IMAGE ERROR:", e);
            imgFailed = true;
        }
    }

    if (avatarImg) {
        if (avatarImg.complete && avatarImg.naturalWidth > 0) sampleImage();
        else {
            avatarImg.addEventListener('load', sampleImage);
            avatarImg.addEventListener('error', () => { imgFailed = true; });
        }
    } else {
        imgFailed = true;
    }

    const INTRO_MS = 2200;    
    const WAIT_MAX_MS = 3000; 
    const HOLD_MS = 650;      

    let phase = 'intro';
    let introStart = null, waitStart = null, holdStart = null;
    let rafId = null;
    let done = false;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function updateBar(pct) {
        const clamped = Math.max(0, Math.min(100, pct));
        if (barFill) barFill.style.width = clamped + '%';
        if (percentLabel) percentLabel.textContent = Math.round(clamped) + '%';
    }

    function mixColor(hexA, hexB, t) {
        const a = hexToRgb(hexA), b = hexToRgb(hexB);
        const r = Math.round(a.r + (b.r - a.r) * t);
        const g = Math.round(a.g + (b.g - a.g) * t);
        const bl = Math.round(a.b + (b.b - a.b) * t);
        return `rgb(${r}, ${g}, ${bl})`;
    }

    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
    }

    function renderGrid(w, h, resolveChance) {
        const cellW = w / GRID, cellH = h / GRID;
        let tc = themeManager.getColors();
        let isDark = themeManager.currentTheme === 'dark';

        for (let gy = 0; gy < GRID; gy++) {
            for (let gx = 0; gx < GRID; gx++) {
                const idx = gy * GRID + gx;
                const hashSeed = Math.sin(gx * 12.9898 + gy * 78.233 + 4.0) * 43758.5453;
                const noiseVal = hashSeed - Math.floor(hashSeed);
                const isResolved = noiseVal < resolveChance;

                let color;
                if (isResolved && cellBrightness) {
                    if (!isDark && cellColors) {
                        // In light mode, resolve completely to the actual image colors!
                        color = cellColors[idx];
                    } else {
                        // In dark mode, resolve to the classic Matrix Green scale
                        const brightness = cellBrightness[idx];
                        if (brightness < 0.16) {
                            color = '#000000'; 
                        } else if (brightness < 0.6) {
                            color = mixColor(tc.loaderDarkish, tc.loaderAccent, (brightness - 0.16) / 0.44);
                        } else {
                            color = mixColor(tc.loaderAccent, '#ffffff', Math.min((brightness - 0.6) / 0.4, 1));
                        }
                    }
                } else if (isResolved) {
                    // Fallback if image failed to load
                    color = noiseVal < resolveChance * 0.55 ? tc.loaderDarkish : tc.loaderAccent;
                } else {
                    // Unresolved flickering noise
                    const flick = Math.random();
                    color = flick < 0.5 ? tc.loaderDarkish : (flick < 0.85 ? tc.loaderAccent : (isDark ? '#ffffff' : '#2A2A2A'));
                }

                ctx.fillStyle = color;
                ctx.fillRect(gx * cellW, gy * cellH, cellW - 1, cellH - 1);
            }
        }
    }

    function drawFrame(now) {
        if (!introStart) introStart = now;
        sizeCanvas();
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        if (phase === 'intro') {
            const t = Math.min((now - introStart) / INTRO_MS, 1);
            renderGrid(w, h, easeOutCubic(t));
            updateBar(t * 80);
            if (t >= 1) {
                if (imgLoaded || imgFailed) { phase = 'hold'; holdStart = now; }
                else { phase = 'waitForImage'; waitStart = now; }
            }
        } else if (phase === 'waitForImage') {
            renderGrid(w, h, 1);
            updateBar(80 + Math.min((now - waitStart) / WAIT_MAX_MS, 1) * 10);
            if (imgLoaded || imgFailed || (now - waitStart) > WAIT_MAX_MS) {
                phase = 'hold'; holdStart = now;
            }
        } else if (phase === 'hold') {
            renderGrid(w, h, 1);
            updateBar(100);
            if (now - holdStart > HOLD_MS) { phase = 'finish'; }
        }

        if (phase !== 'finish') {
            rafId = requestAnimationFrame(drawFrame);
        } else {
            finishLoading();
        }
    }

    function finishLoading() {
        if (done) return;
        done = true;
        setTimeout(() => {
            screen.classList.add('is-hidden');
            document.body.classList.remove('is-loading');
            if (siteContent) siteContent.classList.add('is-visible');
            setTimeout(() => { screen.remove(); }, 1000);
        }, 250);
    }

    window.addEventListener('resize', sizeCanvas);
    sizeCanvas();
    rafId = requestAnimationFrame(drawFrame);

    setTimeout(() => { if (!done) finishLoading(); }, 8000);
})();

// Custom Crosshair Cursor Script 
(function initCrosshairCursor() {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const root = document.getElementById('crosshair-cursor');
    if (!root) return;
    const vLine = root.querySelector('.ch-v');
    const hLine = root.querySelector('.ch-h');
    const dot = root.querySelector('.ch-dot');
    const label = root.querySelector('.ch-label');

    let x = null, y = null;

    function setPosition(clientX, clientY) {
        x = clientX;
        y = clientY;
        root.classList.add('is-visible');
        vLine.style.left = x + 'px';
        hLine.style.top = y + 'px';
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        label.style.left = x + 'px';
        label.style.top = y + 'px';
        label.textContent = `X: ${Math.round(x)}  Y: ${Math.round(y)}`;
    }

    window.addEventListener('mousemove', (e) => setPosition(e.clientX, e.clientY), { passive: true });
    window.addEventListener('mouseleave', () => root.classList.remove('is-visible'));
    window.addEventListener('mouseenter', (e) => setPosition(e.clientX, e.clientY));
})();

// Cursor Selector Script (multi-preset custom cursor + panel)
(function initCursorSelector() {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    const STORAGE_KEY = 'cursorPreset';
    const NAME_KEY = 'cursorCustomName';
    const COLOR_KEY = 'cursorCustomColor';

    const crosshairRoot = document.getElementById('crosshair-cursor');
    const arrowLayer = document.getElementById('arrow-cursor-layer');
    const pixelCanvas = document.getElementById('pixel-trail-cursor');
    const panel = document.getElementById('cursor-panel');
    const listEl = document.getElementById('cursor-option-list');
    const activeDot = document.getElementById('cp-active-dot');
    const uploadInput = document.getElementById('cursor-upload-input');
    const uploadNameInput = document.getElementById('cursor-upload-name');
    const uploadColorInput = document.getElementById('cursor-upload-color');
    const useCustomBtn = document.getElementById('cursor-use-custom');

    if (!crosshairRoot || !arrowLayer || !panel || !listEl) return;

    const acArrow = arrowLayer.querySelector('.ac-arrow');
    const acLabel = arrowLayer.querySelector('.ac-label');
    let pixelTrailColor = '#4dff7a';

    function arrowSVG(color) {
        return `<svg viewBox="0 0 28 28" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 3 L23 14 L14 16 L11 24 Z" fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6" stroke-linejoin="round"/>
        </svg>`;
    }

    function crosshairPreviewSVG(color) {
        return `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
            <line x1="12" y1="0" x2="12" y2="24" stroke="${color}" stroke-width="1" opacity="0.5"/>
            <line x1="0" y1="12" x2="24" y2="12" stroke="${color}" stroke-width="1" opacity="0.5"/>
            <circle cx="12" cy="12" r="2.5" fill="${color}"/>
        </svg>`;
    }

    function nativePreviewSVG(color) {
        return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 2 L4 20 L9 15.5 L12.5 22 L15 20.5 L11.5 14 L18 13 Z" fill="${color}"/>
        </svg>`;
    }

    function pixelPreviewSVG(color) {
        return `<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="10" width="3" height="3" fill="${color}" opacity="0.2"/>
            <rect x="7" y="7" width="3" height="3" fill="${color}" opacity="0.45"/>
            <rect x="12" y="11" width="3" height="3" fill="${color}" opacity="0.75"/>
            <rect x="17" y="8" width="3" height="3" fill="${color}"/>
        </svg>`;
    }

    const PRESETS = [
        { id: 'atharv',    name: 'NEXUS', type: 'crosshair',  color: '#4dff7a' },
        { id: 'root',     name: 'ROOT@ATHARV',     type: 'arrow',      color: '#4dff7a', label: 'root@atharv' },
        { id: 'decrypt',  name: 'SIGNAL_LOST',   type: 'arrow',      color: '#ff4d6d', label: 'signal_lost...' },
        { id: 'null',     name: 'VOID',   type: 'dot',        color: '#9a9a9a' },
        { id: 'system',   name: 'SYSTEM_DEFAULT', type: 'native',     color: '#dddddd' },
        { id: 'custom',   name: 'CUSTOM',         type: 'custom',     color: '#4dff7a', hasImage: false, url: null },
        { id: 'pixel',    name: 'PIXEL_TRAIL',    type: 'pixeltrail', color: '#4dff7a' },
    ];

    let current = localStorage.getItem(STORAGE_KEY) || 'atharv';
    if (!PRESETS.find(p => p.id === current)) current = 'atharv';
    const customPreset = PRESETS.find(p => p.id === 'custom');
    customPreset.name = localStorage.getItem(NAME_KEY) || 'CUSTOM';
    customPreset.color = localStorage.getItem(COLOR_KEY) || customPreset.color;
    if (uploadNameInput) uploadNameInput.value = customPreset.name === 'CUSTOM' ? '' : customPreset.name;
    if (uploadColorInput) uploadColorInput.value = customPreset.color;

    function previewMarkup(p) {
        if (p.type === 'crosshair') return crosshairPreviewSVG(p.color);
        if (p.type === 'arrow') return arrowSVG(p.color);
        if (p.type === 'native') return nativePreviewSVG(p.color);
        if (p.type === 'pixeltrail') return pixelPreviewSVG(p.color);
        if (p.type === 'dot') return `<span class="co-dot" style="background:${p.color}"></span>`;
        if (p.type === 'custom') {
            return p.hasImage && p.url
                ? `<img src="${p.url}" alt="">`
                : arrowSVG(p.color);
        }
        return '';
    }

    function renderList() {
        listEl.innerHTML = '';
        PRESETS.forEach(p => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'cursor-option' + (p.id === current ? ' is-active' : '');
            row.dataset.id = p.id;
            row.innerHTML = `<span class="co-preview">${previewMarkup(p)}</span><span class="co-name">${p.name}</span>`;
            row.addEventListener('click', () => selectPreset(p.id));
            listEl.appendChild(row);
        });
    }

    function applyPreset(id) {
        const p = PRESETS.find(x => x.id === id) || PRESETS[0];

        crosshairRoot.classList.remove('is-active-cursor');
        arrowLayer.classList.remove('is-active-cursor');
        if (pixelCanvas) pixelCanvas.classList.remove('is-active-cursor', 'is-visible');
        document.body.classList.remove('native-cursor');
        document.body.dataset.cursorMode = p.id;

        if (activeDot) activeDot.style.background = p.color;

        if (p.type === 'native') {
            document.body.classList.add('native-cursor');
            return;
        }

        if (p.type === 'crosshair') {
            crosshairRoot.classList.add('is-active-cursor');
            return;
        }

        if (p.type === 'pixeltrail') {
            if (pixelCanvas) pixelCanvas.classList.add('is-active-cursor');
            pixelTrailColor = p.color;
            return;
        }

        arrowLayer.classList.add('is-active-cursor');

        if (p.type === 'custom' && p.hasImage && p.url) {
            acArrow.innerHTML = `<img src="${p.url}" alt="">`;
            acLabel.style.display = '';
            acLabel.textContent = p.name;
            acLabel.style.background = p.color;
        } else if (p.type === 'dot') {
            acArrow.innerHTML = `<span class="ac-dot" style="background:${p.color}"></span>`;
            acLabel.style.display = 'none';
        } else {
            acArrow.innerHTML = arrowSVG(p.color);
            acLabel.style.display = '';
            acLabel.textContent = p.label || p.name;
            acLabel.style.background = p.color;
        }
    }

    function selectPreset(id) {
        current = id;
        localStorage.setItem(STORAGE_KEY, id);
        applyPreset(id);
        renderList();
    }

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (customPreset.url) URL.revokeObjectURL(customPreset.url);
            customPreset.url = URL.createObjectURL(file);
            customPreset.hasImage = true;
            const typedName = (uploadNameInput && uploadNameInput.value.trim()) || file.name.replace(/\.[^.]+$/, '');
            customPreset.name = typedName.toUpperCase().slice(0, 18) || 'CUSTOM';
            localStorage.setItem(NAME_KEY, customPreset.name);
            renderList();
            selectPreset('custom');
        });
    }

    if (uploadNameInput) {
        uploadNameInput.addEventListener('input', () => {
            const typed = uploadNameInput.value.trim();
            customPreset.name = (typed || 'CUSTOM').toUpperCase().slice(0, 18);
            localStorage.setItem(NAME_KEY, customPreset.name);
            renderList();
            if (current === 'custom') applyPreset('custom');
        });
    }

    if (uploadColorInput) {
        uploadColorInput.addEventListener('input', () => {
            customPreset.color = uploadColorInput.value;
            localStorage.setItem(COLOR_KEY, customPreset.color);
            renderList();
            if (current === 'custom') applyPreset('custom');
        });
    }

    if (useCustomBtn) {
        useCustomBtn.addEventListener('click', () => {
            const typed = uploadNameInput && uploadNameInput.value.trim();
            if (typed) {
                customPreset.name = typed.toUpperCase().slice(0, 18);
                localStorage.setItem(NAME_KEY, customPreset.name);
            }
            renderList();
            selectPreset('custom');
        });
    }

    renderList();
    applyPreset(current);

    // --- smooth follow loop for the arrow/label/dot cursor ---
    let mx = -9999, my = -9999;
    let curX = mx, curY = my, labelX = mx, labelY = my;
    let hasSample = false;

    window.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!hasSample) {
            curX = labelX = mx;
            curY = labelY = my;
            hasSample = true;
        }
        arrowLayer.classList.add('is-visible');
    }, { passive: true });

    window.addEventListener('mouseleave', () => arrowLayer.classList.remove('is-visible'));
    window.addEventListener('mouseenter', () => { if (hasSample) arrowLayer.classList.add('is-visible'); });

    function tick() {
        curX += (mx - curX) * 0.35;
        curY += (my - curY) * 0.35;
        labelX += (mx - labelX) * 0.16;
        labelY += (my - labelY) * 0.16;
        acArrow.style.transform = `translate(${curX}px, ${curY}px)`;
        acLabel.style.transform = `translate(${labelX + 18}px, ${labelY + 16}px)`;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // --- Pixel Trail engine: pixelated grid trail ---
    if (pixelCanvas) {
        const pctx = pixelCanvas.getContext('2d');
        const CELL = 9;    // grid spacing
        const DOT = 7;     // drawn square size per lit cell — thick enough to read clearly
        const MAX_AGE = 420; // ms a pixel stays lit before fully fading
        const decayPerFrame = 1 / (MAX_AGE / 16.67);

        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        let cols = 1, rows = 1;
        const trail = new Map(); // gridIndex -> alpha (1..0)
        let lastX = null, lastY = null;

        function hexToRgbTriplet(hex) {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
            return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '77, 255, 122';
        }

        function resizePixelCanvas() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = window.innerWidth, h = window.innerHeight;
            pixelCanvas.width = Math.round(w * dpr);
            pixelCanvas.height = Math.round(h * dpr);
            pixelCanvas.style.width = w + 'px';
            pixelCanvas.style.height = h + 'px';
            pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cols = Math.max(1, Math.ceil(w / CELL));
            rows = Math.max(1, Math.ceil(h / CELL));
            trail.clear();
        }
        resizePixelCanvas();
        window.addEventListener('resize', resizePixelCanvas);

        function lightCell(x, y) {
            const col = Math.floor(x / CELL);
            const row = Math.floor(y / CELL);
            trail.set(row * cols + col, 1);
        }

        window.addEventListener('mousemove', (e) => {
            if (!pixelCanvas.classList.contains('is-active-cursor')) { lastX = null; return; }
            pixelCanvas.classList.add('is-visible');

            const x = e.clientX, y = e.clientY;
            if (lastX === null) { lastX = x; lastY = y; }

            // Interpolate between samples so fast mouse movement doesn't leave gaps in the trail.
            const dist = Math.hypot(x - lastX, y - lastY);
            const steps = Math.min(40, Math.max(1, Math.ceil(dist / (CELL * 0.6))));
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                lightCell(lastX + (x - lastX) * t, lastY + (y - lastY) * t);
            }
            lastX = x;
            lastY = y;
        }, { passive: true });

        window.addEventListener('mouseleave', () => {
            pixelCanvas.classList.remove('is-visible');
            lastX = null;
        });

        function tickPixels() {
            const active = pixelCanvas.classList.contains('is-active-cursor');
            if (active && trail.size) {
                const w = pixelCanvas.width / dpr, h = pixelCanvas.height / dpr;
                pctx.clearRect(0, 0, w, h);
                const rgb = hexToRgbTriplet(pixelTrailColor);
                pctx.shadowBlur = 6;
                pctx.shadowColor = `rgba(${rgb}, 0.9)`;
                trail.forEach((alpha, idx) => {
                    const next = alpha - decayPerFrame;
                    if (next <= 0.02) { trail.delete(idx); return; }
                    const col = idx % cols;
                    const row = Math.floor(idx / cols);
                    const cx = col * CELL + CELL / 2;
                    const cy = row * CELL + CELL / 2;
                    // Slower fade at the start, quicker at the end — keeps pixels readable longer.
                    const displayAlpha = Math.pow(next, 0.55);
                    pctx.fillStyle = `rgba(${rgb}, ${displayAlpha})`;
                    pctx.fillRect(cx - DOT / 2, cy - DOT / 2, DOT, DOT);
                    trail.set(idx, next);
                });
                pctx.shadowBlur = 0;
            } else if (!active && trail.size) {
                trail.clear();
                pctx.clearRect(0, 0, pixelCanvas.width / dpr, pixelCanvas.height / dpr);
            }
            requestAnimationFrame(tickPixels);
        }
        requestAnimationFrame(tickPixels);
    }
})();

// Decrypt Beam Script — blocks link navigation and surfaces an error popup while active
(function initDecryptBeamGuard() {
    const toast = document.getElementById('cursor-error-toast');
    let toastTimer = null;

    function showErrorToast() {
        if (!toast) return;
        toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
    }

    document.addEventListener('click', (e) => {
        if (document.body.dataset.cursorMode !== 'decrypt') return;
        if (e.target.closest('#cursor-panel')) return; // never block the control panel itself

        const link = e.target.closest('a[href]');
        if (link) {
            e.preventDefault();
            e.stopPropagation();
        }
        showErrorToast();
    }, true);
})();

// Black Hole Animation Script
(function initBlackHole() {
    const container = document.getElementById('hero-background');
    if (!container) return;

    let tc = themeManager.getColors();

    const config = {
        voidRadius: 45,    
        voidX: 50,          
        voidY: 50,          
        particleCount: 1500, 
        particleSize: 1.5,  
        colors: tc.particleColors, 
        outerRadius: 80,    
        tilt: 20,           
        tiltSideway: 160,   
        trailAlpha: 0.2,    
        orbitSpeed: 4,      
        pullSpeed: 0,       
        perspective: 1300
    };

    const bgCanvas = document.createElement('canvas');
    const fgCanvas = document.createElement('canvas');
    bgCanvas.style.position = 'absolute';
    fgCanvas.style.position = 'absolute';
    fgCanvas.style.pointerEvents = 'none';
    container.appendChild(bgCanvas);
    container.appendChild(fgCanvas);

    const ctx = bgCanvas.getContext('2d');
    const fgCtx = fgCanvas.getContext('2d');

    let width, height, voidCx, voidCy, outerRad;
    let particles = [];
    let animationFrameId;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        width = window.innerWidth;
        height = window.innerHeight; 
        
        bgCanvas.width = width * dpr;
        bgCanvas.height = height * dpr;
        bgCanvas.style.width = `${width}px`;
        bgCanvas.style.height = `${height}px`;
        
        fgCanvas.width = width * dpr;
        fgCanvas.height = height * dpr;
        fgCanvas.style.width = `${width}px`;
        fgCanvas.style.height = `${height}px`;

        voidCx = (config.voidX / 100) * width;
        voidCy = (config.voidY / 100) * height;

        const maxR = width / 2;
        outerRad = config.voidRadius + (config.outerRadius / 100) * (maxR - config.voidRadius);

        seedParticles();
    }

    function seedParticles() {
        particles = [];
        for (let i = 0; i < config.particleCount; i++) {
            const r = config.voidRadius + Math.pow(Math.random(), 2) * (outerRad - config.voidRadius);
            particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: r,
                height: (Math.random() - 0.5) * 16,
                speedOffset: 0.75 + Math.random() * 0.5,
                color: config.colors[Math.floor(Math.random() * config.colors.length)]
            });
        }
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    let voidRgb = hexToRgb(tc.void); 
    let bgRgb = hexToRgb(tc.bg);

    // Dynamic Updates upon Theme Switch
    window.addEventListener('themeChanged', () => {
        tc = themeManager.getColors();
        config.colors = tc.particleColors;
        voidRgb = hexToRgb(tc.void);
        bgRgb = hexToRgb(tc.bg);

        particles.forEach(p => {
            p.color = config.colors[Math.floor(Math.random() * config.colors.length)];
        });
    });

    let lastTime = performance.now();

    function draw(now) {
        if (window.scrollY > window.innerHeight) {
            lastTime = now;
            animationFrameId = requestAnimationFrame(draw);
            return;
        }

        const dt = Math.min((now - lastTime) / 16.667, 3);
        lastTime = now;

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.globalAlpha = 1.0;
        fgCtx.globalAlpha = 1.0;

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${config.trailAlpha})`;
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";

        fgCtx.globalCompositeOperation = "destination-out";
        fgCtx.fillStyle = `rgba(${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}, ${config.trailAlpha})`;
        fgCtx.fillRect(0, 0, width, height);
        fgCtx.globalCompositeOperation = "source-over";

        const tiltRad = (config.tilt * Math.PI) / 180;
        const tiltSidewayRad = (config.tiltSideway * Math.PI) / 180;

        let bgPts = [];
        let fgPts = [];

        for (let i = 0; i < particles.length; i++) {
            let pt = particles[i];

            const speedFactor = Math.sqrt(config.voidRadius / Math.max(pt.radius, 10));
            const localOrbitSpeed = config.orbitSpeed * speedFactor * pt.speedOffset;
            const localPullSpeed = config.pullSpeed * speedFactor * pt.speedOffset;

            pt.angle += localOrbitSpeed * 0.012 * dt;
            pt.radius -= localPullSpeed * dt;

            if (pt.radius < config.voidRadius) {
                pt.radius = config.voidRadius + 0.7 * (outerRad - config.voidRadius) + Math.random() * 0.3 * (outerRad - config.voidRadius);
                pt.angle = Math.random() * Math.PI * 2;
                pt.height = (Math.random() - 0.5) * 16;
                continue;
            }

            const cosA = Math.cos(pt.angle);
            const sinA = Math.sin(pt.angle);

            const x_base = pt.radius * cosA;
            const y_base = pt.height;
            const z_base = pt.radius * sinA;

            const x1 = x_base;
            const y1 = y_base * Math.cos(tiltRad) + z_base * Math.sin(tiltRad);
            const z1 = -y_base * Math.sin(tiltRad) + z_base * Math.cos(tiltRad);

            const x3d = x1 * Math.cos(tiltSidewayRad) - y1 * Math.sin(tiltSidewayRad);
            const y3d = x1 * Math.sin(tiltSidewayRad) + y1 * Math.cos(tiltSidewayRad);
            const z3d = z1;

            const scale = config.perspective / (config.perspective + z3d);
            const px = voidCx + x3d * scale;
            const py = voidCy + y3d * scale;

            if (px < -30 || px > width + 30 || py < -30 || py > height + 30) continue;

            const size = Math.max(0.3, config.particleSize * scale);
            const alpha = Math.max(0.35, 1 - ((z3d + outerRad) / (2 * outerRad)) * 0.45);

            const projected = { x: px, y: py, size: size, alpha: alpha, z: z3d, color: pt.color };

            if (z3d >= 0) bgPts.push(projected);
            else fgPts.push(projected);
        }

        bgPts.sort((a, b) => b.z - a.z);
        fgPts.sort((a, b) => b.z - a.z);

        for (let i = 0; i < bgPts.length; i++) {
            let p = bgPts[i];
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        const isDark = themeManager.currentTheme === 'dark';
        const edgeOffset = isDark ? 18 : -18;
        const centerOffset = isDark ? 8 : -8;
        
        const edgeR = Math.max(0, Math.min(255, voidRgb.r + edgeOffset));
        const edgeG = Math.max(0, Math.min(255, voidRgb.g + edgeOffset));
        const edgeB = Math.max(0, Math.min(255, voidRgb.b + edgeOffset));

        const centerR = Math.max(0, Math.min(255, voidRgb.r + centerOffset));
        const centerG = Math.max(0, Math.min(255, voidRgb.g + centerOffset));
        const centerB = Math.max(0, Math.min(255, voidRgb.b + centerOffset));

        const sphereGrad = ctx.createRadialGradient(
            voidCx - config.voidRadius * 0.25, voidCy - config.voidRadius * 0.3, config.voidRadius * 0.05,
            voidCx, voidCy, config.voidRadius
        );
        
        sphereGrad.addColorStop(0, `rgba(${centerR}, ${centerG}, ${centerB}, 1)`);
        sphereGrad.addColorStop(0.65, `rgba(${voidRgb.r}, ${voidRgb.g}, ${voidRgb.b}, 1)`);
        sphereGrad.addColorStop(0.92, `rgba(${edgeR}, ${edgeG}, ${edgeB}, 1)`);
        sphereGrad.addColorStop(1, `rgba(${edgeR}, ${edgeG}, ${edgeB}, 0.9)`);

        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(voidCx, voidCy, config.voidRadius, 0, Math.PI * 2);
        ctx.fill();

        const rimGrad = ctx.createRadialGradient(
            voidCx, voidCy, config.voidRadius * 0.88,
            voidCx, voidCy, config.voidRadius * 1.02
        );
        rimGrad.addColorStop(0, `${tc.rimGlow} 0)`);
        rimGrad.addColorStop(0.6, `${tc.rimGlow} 0.1)`);
        rimGrad.addColorStop(0.85, `${tc.rimGlow} 0.2)`);
        rimGrad.addColorStop(1, `${tc.rimGlow} 0)`);
        
        ctx.fillStyle = rimGrad;
        ctx.beginPath();
        ctx.arc(voidCx, voidCy, config.voidRadius * 1.02, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < fgPts.length; i++) {
            let p = fgPts[i];
            fgCtx.globalAlpha = p.alpha;
            fgCtx.fillStyle = p.color;
            fgCtx.beginPath();
            fgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            fgCtx.fill();
        }
        fgCtx.globalAlpha = 1.0;

        animationFrameId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    animationFrameId = requestAnimationFrame(draw);
})();

// Clock Script
function updateClock() {
    const now = new Date();
    const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', options);
}
setInterval(updateClock, 1000);
updateClock();

// Repo Cards Reveal & Scramble Script
(function initCardReveal() {
    const cards = document.querySelectorAll('.project-card');
    if (!cards.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scrambleChars = '!<>-_\\/[]{}—=+*^?#$%&01ABCDEF';

    const terminalData = [
        [
            { text: 'atharv@drone-lab:~/DRONE$ ./build.sh --target flight-controller', color: 'var(--accent)' },
            { text: '[+] Initializing flight control systems...', color: '#888888' },
            { text: '[+] Calibrating sensors and motor outputs...', color: '#888888' },
            { text: '[+] Drone assembly complete. System ready.', color: 'var(--accent)' }
        ],
        [
            { text: 'atharv@electronics-lab:~/POWER_SUPPLY$ ./test_output.sh', color: 'var(--accent)' },
            { text: '[+] Initializing voltage regulation...', color: '#888888' },
            { text: '[+] Testing output stability and current limits...', color: '#888888' },
            { text: '[+] Bench supply verified. Output stable.', color: 'var(--accent)' }
        ],
        [
            { text: 'atharv@ml-lab:~/MARKET_MODEL$ python3 predict.py', color: 'var(--accent)' },
            { text: '[INFO] Loading historical S&P 500 data...', color: '#888888' },
            { text: '[INFO] Training Random Forest and evaluating model...', color: '#888888' },
            { text: '[+] Next-day prediction pipeline completed.', color: 'var(--accent)' }
        ],
        [
            { text: 'atharv@ai-lab:~/LOCAL_LLM$ python3 run_model.py', color: 'var(--accent)' },
            { text: '[INFO] Loading Ollama model: Qwen 2.5 3B...', color: '#888888' },
            { text: '[INFO] Initializing embeddings and LangChain pipeline...', color: '#888888' },
            { text: '[+] Local inference pipeline ready.', color: 'var(--accent)' }
        ]
    ];

    function scrambleTo(el, finalText, token, duration) {
        const len = finalText.length;
        let start = null;

        function step(ts) {
            if (el.dataset.token !== String(token)) return; 
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            const revealCount = Math.floor(progress * len);

            let out = '';
            for (let i = 0; i < len; i++) {
                if (finalText[i] === ' ') { out += ' '; continue; }
                out += i < revealCount ? finalText[i] : scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
            }
            el.textContent = out;

            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = finalText;
        }
        requestAnimationFrame(step);
    }

    function typeTerminal(bodyEl, lines, token) {
        bodyEl.innerHTML = '';
        let i = 0;

        function nextLine() {
            if (bodyEl.dataset.token !== String(token)) return; 
            if (i >= lines.length) return;

            const { text, color, pause = 320 } = lines[i];
            const p = document.createElement('p');
            if (color) p.style.color = color;

            const textNode = document.createTextNode('');
            const cursor = document.createElement('span');
            cursor.className = 'term-cursor';
            p.appendChild(textNode);
            p.appendChild(cursor);
            bodyEl.appendChild(p);

            let c = 0;
            function typeChar() {
                if (bodyEl.dataset.token !== String(token)) return; 
                if (c < text.length) {
                    textNode.textContent += text[c];
                    c++;
                    setTimeout(typeChar, 16 + Math.random() * 26);
                } else {
                    cursor.remove();
                    i++;
                    if (i >= lines.length) {
                        p.classList.add('term-glow'); 
                    } else {
                        setTimeout(nextLine, pause);
                    }
                }
            }
            typeChar();
        }
        nextLine();
    }

    function renderStatic(card, lines) {
        const titleEl = card.querySelector('.project-title');
        const bodyEl = card.querySelector('.term-body');
        if (titleEl && titleEl.dataset.finalText) titleEl.textContent = titleEl.dataset.finalText;
        if (bodyEl) {
            bodyEl.innerHTML = lines.map(l => `<p${l.color ? ` style="color:${l.color}"` : ''}>${l.text}</p>`).join('');
            const last = bodyEl.lastElementChild;
            if (last) last.classList.add('term-glow');
        }
    }

    cards.forEach((card, idx) => {
        const titleEl = card.querySelector('.project-title');
        if (titleEl) titleEl.dataset.finalText = titleEl.textContent.trim();
        card.dataset.revealToken = '0';
        card._terminalLines = terminalData[idx] || [];
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
        cards.forEach(card => {
            card.classList.add('is-visible');
            renderStatic(card, card._terminalLines);
        });
    } else {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const card = entry.target;
                const titleEl = card.querySelector('.project-title');
                const bodyEl = card.querySelector('.term-body');
                const token = Number(card.dataset.revealToken) + 1;
                card.dataset.revealToken = String(token);
                if (titleEl) titleEl.dataset.token = String(token);
                if (bodyEl) bodyEl.dataset.token = String(token);

                if (entry.isIntersecting) {
                    card.classList.add('is-visible');
                    if (titleEl) scrambleTo(titleEl, titleEl.dataset.finalText, token, 650);
                    if (bodyEl) typeTerminal(bodyEl, card._terminalLines, token);
                } else {
                    card.classList.remove('is-visible');
                    if (titleEl) titleEl.textContent = '';
                    if (bodyEl) bodyEl.innerHTML = '';
                }
            });
        }, { threshold: 0.2 });

        cards.forEach(card => observer.observe(card));
    }

    const footer = document.querySelector('footer');
    const scrambleEls = document.querySelectorAll('[data-scramble]');
    if (footer && scrambleEls.length) {
        scrambleEls.forEach(el => {
            el.dataset.finalText = el.textContent.trim();
            el.dataset.revealToken = '0';
        });

        if (reduceMotion || !('IntersectionObserver' in window)) {
            scrambleEls.forEach(el => { el.textContent = el.dataset.finalText; });
        } else {
            const footerObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    scrambleEls.forEach(el => {
                        const token = Number(el.dataset.revealToken) + 1;
                        el.dataset.revealToken = String(token);
                        el.dataset.token = String(token);
                        scrambleTo(el, el.dataset.finalText, token, 650);
                    });
                    footerObserver.unobserve(footer);
                });
            }, { threshold: 0.2 });
            footerObserver.observe(footer);
        }
    }

    if (!reduceMotion) {
        const hoverTargets = document.querySelectorAll('nav a, .footer-links a, .section-header a, .footer-brand h3, .project-title, .tag');
        hoverTargets.forEach(el => {
            if (!el.dataset.finalText) el.dataset.finalText = el.textContent.trim();
            if (!el.dataset.revealToken) el.dataset.revealToken = '0';
            el.addEventListener('mouseenter', () => {
                const token = Number(el.dataset.revealToken) + 1;
                el.dataset.revealToken = String(token);
                el.dataset.token = String(token);
                scrambleTo(el, el.dataset.finalText, token, 500);
            });
        });
    }
})();

// Smooth Nav Script
(function initSmoothNav() {
    const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]'));
    if (!navLinks.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const NAV_OFFSET = 90; 

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function smoothScrollTo(targetY, duration) {
        const startY = window.scrollY;
        const diff = targetY - startY;

        if (reduceMotion || Math.abs(diff) < 2) {
            window.scrollTo(0, targetY);
            return;
        }

        let startTime = null;
        function step(ts) {
            if (!startTime) startTime = ts;
            const elapsed = ts - startTime;
            const progress = Math.min(elapsed / duration, 1);
            window.scrollTo(0, startY + diff * easeInOutCubic(progress));
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function setActiveLink(link) {
        navLinks.forEach(l => l.classList.remove('active'));
        if (link) link.classList.add('active');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const id = link.getAttribute('href').slice(1);
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();

            const targetY = target.getBoundingClientRect().top + window.scrollY - (id === 'home' ? 0 : NAV_OFFSET);
            setActiveLink(link);
            smoothScrollTo(Math.max(targetY, 0), 900);
            history.pushState(null, '', '#' + id);
        });
    });

    const sections = navLinks
        .map(link => document.getElementById(link.getAttribute('href').slice(1)))
        .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const match = navLinks.find(l => l.getAttribute('href') === '#' + entry.target.id);
                if (match) setActiveLink(match);
            });
        }, { threshold: 0.4, rootMargin: '-35% 0px -35% 0px' });

        sections.forEach(s => observer.observe(s));
    }
})();
/* Experience timeline scroll progress and active milestone */
(() => {
    const section = document.querySelector('#experience');
    if (!section) return;
    const timeline = section.querySelector('.experience-timeline');
    const progress = section.querySelector('.timeline-progress');
    const cards = [...section.querySelectorAll('.timeline-card')];
    if (!timeline || !progress || !cards.length) return;

    let ticking = false;
    const updateTimeline = () => {
        const rect = timeline.getBoundingClientRect();
        const viewportMark = window.innerHeight * 0.52;
        const total = Math.max(timeline.scrollHeight, 1);
        const travelled = Math.min(total, Math.max(0, viewportMark - rect.top));
        progress.style.height = `${(travelled / total) * 100}%`;

        let activeIndex = 0;
        let closest = Infinity;
        cards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const distance = Math.abs((cardRect.top + Math.min(cardRect.height * 0.35, 90)) - viewportMark);
            if (distance < closest) { closest = distance; activeIndex = index; }
        });
        cards.forEach((card, index) => card.classList.toggle('is-active', index === activeIndex));
        ticking = false;
    };
    const requestUpdate = () => {
        if (!ticking) { window.requestAnimationFrame(updateTimeline); ticking = true; }
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    requestUpdate();
})();
