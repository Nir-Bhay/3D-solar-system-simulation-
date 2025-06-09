// 3D Solar System with Realistic Planets (Textures, Glow, Rings)

const PLANETS = [
    { name: 'Mercury', color: 0xb1b1b1, size: 0.38, distance: 6, speed: 4.74 },
    { name: 'Venus', color: 0xe6c47b, size: 0.95, distance: 8, speed: 3.5 },
    { name: 'Earth', color: 0x3a7ceb, size: 1, distance: 10, speed: 2.98 },
    { name: 'Mars', color: 0xd14b2c, size: 0.53, distance: 12, speed: 2.41 },
    { name: 'Jupiter', color: 0xe3c6a0, size: 2.5, distance: 16, speed: 1.31 },
    { name: 'Saturn', color: 0xe8d59e, size: 2.1, distance: 20, speed: 0.97 },
    { name: 'Uranus', color: 0x6fd1e7, size: 1.2, distance: 24, speed: 0.68 },
    { name: 'Neptune', color: 0x4563a0, size: 1.19, distance: 28, speed: 0.54 },
];
const panel = document.getElementById('controls-panel');
const toggleBtn = document.getElementById('toggle-panel-btn');
let panelCollapsed = false;
toggleBtn.onclick = () => {
    panelCollapsed = !panelCollapsed;
    panel.classList.toggle('collapsed', panelCollapsed);
    toggleBtn.setAttribute('aria-label', panelCollapsed ? 'Show controls' : 'Hide controls');
    toggleBtn.innerHTML = panelCollapsed ? '&#9776;' : '&#x22EE;'; // Hamburger when closed, dots when open
};
const SUN = { color: 0xffe066, size: 3.5, glow: 12 };

let scene, camera, renderer, clock;
let planetMeshes = [], planetGroups = [], orbitSpeeds = [];
let planetLabels = [];
let paused = false;
let sunGlow;
let stars;
let controlsOverlay;
let cameraTarget = null;
let cameraAnimating = false;
let defaultCamera = { position: new THREE.Vector3(0, 13, 38), lookAt: new THREE.Vector3(0, 0, 0) };
let isDarkMode = true;
let followingPlanet = null;

// For raycasting (hover/click interaction)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function init() {
    scene = new THREE.Scene();
    setSceneBackground();

    camera = new THREE.PerspectiveCamera(
        48, window.innerWidth / window.innerHeight, 0.1, 200
    );
    camera.position.set(0, 13, 38);
    camera.lookAt(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.14));
    const sunLight = new THREE.PointLight(0xfff2bd, 2.5, 120, 1.4);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // Sun (emissive)
    const sunGeometry = new THREE.SphereGeometry(SUN.size, 48, 48);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: SUN.color });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sunMesh);

    // Sun Glow
    sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: buildGlowTexture(),
        color: 0xfff8b0,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
    }));
    sunGlow.scale.set(SUN.glow, SUN.glow, 1);
    sunGlow.position.copy(sunMesh.position);
    scene.add(sunGlow);

    // Background stars
    addStars(800);

    // Planets + labels
    PLANETS.forEach((p, idx) => {
        const group = new THREE.Group();
        scene.add(group);

        // *** Realistic planet mesh with textures, glow, rings ***
        const mesh = createPlanetMesh(p);
        mesh.position.x = p.distance;
        group.add(mesh);
        planetMeshes.push(mesh);
        planetGroups.push(group);
        orbitSpeeds.push(p.speed / 10);

        // Orbit rings
        const ringGeo = new THREE.RingGeometry(p.distance - 0.025, p.distance + 0.025, 120);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffe57b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.16
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.001;
        scene.add(ring);

        // HTML Labels (hidden by default)
        const lbl = document.createElement('div');
        lbl.className = 'planet-tooltip';
        lbl.textContent = p.name;
        lbl.style.display = 'none';
        lbl.style.position = 'absolute';
        lbl.style.pointerEvents = 'none';
        document.body.appendChild(lbl);
        planetLabels.push(lbl);
    });

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);

    // Responsive
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse events for raycasting
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    setupControls();
    setupThemeToggle();

    clock = new THREE.Clock();
    animate();
}

function setSceneBackground() {
    if (scene) {
        scene.background = new THREE.Color(isDarkMode ? 0x101021 : 0xf2f2f2);
    }
}

function addStars(count = 500) {
    if (stars) scene.remove(stars);
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    for (let i = 0; i < count; i++) {
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 65 + Math.random() * 60;
        positions.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        const color = isDarkMode ? 1 : 0.3 + 0.7 * Math.random();
        colors.push(color, color, color);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    stars = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: 0.7, vertexColors: true, opacity: 0.66, transparent: true })
    );
    stars.renderOrder = -1;
    scene.add(stars);
}

// Build a soft radial gradient for planet/sun glow
function buildGlowTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(
        size / 2, size / 2, size / 8,
        size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, 'rgba(255,255,255,0.34)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.08)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// --- Realistic planet mesh with texture, glow, and rings ---
function createPlanetMesh(p) {
    let baseColor = new THREE.Color(p.color);

    // Use NASA/public domain textures for realism
    let map = null, ring = null;
    if (p.name === "Earth") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg');
    } else if (p.name === "Jupiter") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg');
    } else if (p.name === "Mars") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg');
    } else if (p.name === "Venus") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/8/85/Venus_globe.jpg');
    } else if (p.name === "Saturn") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg');
    } else if (p.name === "Uranus") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg');
    } else if (p.name === "Neptune") {
        map = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg');
    }
    // Saturn's ring
    if (p.name === "Saturn") {
        const ringTex = new THREE.TextureLoader().load('https://upload.wikimedia.org/wikipedia/commons/8/83/Saturn_Rings_PIA06077.jpg');
        const ringGeo = new THREE.RingGeometry(p.size * 1.25, p.size * 2.3, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            map: ringTex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.77,
            color: 0xffffff
        });
        ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.01;
    }

    const mat = new THREE.MeshPhysicalMaterial({
        color: baseColor,
        metalness: 0.18,
        roughness: 0.44,
        clearcoat: 0.33,
        clearcoatRoughness: 0.14,
        reflectivity: 0.32,
        transmission: 0.03,
        thickness: 0.33,
        map: map,
        emissive: baseColor.clone().lerp(new THREE.Color(0xffffff), 0.15),
        emissiveIntensity: (p.name === "Earth" || p.name === "Neptune" || p.name === "Uranus") ? 0.07 : 0.045,
        sheen: 0.15,
        sheenColor: baseColor.clone().lerp(new THREE.Color(0xffffff), 0.2),
    });

    const geo = new THREE.SphereGeometry(p.size, 44, 44);
    const mesh = new THREE.Mesh(geo, mat);

    // Subtle glow for all but Mercury
    if (p.name !== "Mercury") {
        const glowMat = new THREE.SpriteMaterial({
            map: buildGlowTexture(),
            color: baseColor.getHex(),
            transparent: true,
            opacity: 0.19,
            depthWrite: false
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(p.size * 2.2, p.size * 2.2, 1);
        mesh.add(glow);
    }

    // Saturn's rings
    if (ring) mesh.add(ring);

    return mesh;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (cameraAnimating && cameraTarget) {
        animateCameraToTarget();
    } else if (followingPlanet) {
        // Follow the selected planet's up-to-date position/orbit
        const worldPos = new THREE.Vector3();
        followingPlanet.getWorldPosition(worldPos);

        // Offset the camera so it's a bit behind/above the planet (tweak as you wish)
        const offset = new THREE.Vector3(0, 3, 7).applyAxisAngle(new THREE.Vector3(0, 1, 0), performance.now() * 0.0001);
        const cameraPos = worldPos.clone().add(offset);

        camera.position.lerp(cameraPos, 0.2); // Smoothly move camera
        camera.lookAt(worldPos);
    } else if (!cameraAnimating && !cameraTarget) {
        // Default orbiting behavior
        const t = clock.getElapsedTime();
        camera.position.x = Math.sin(t * 0.1) * 38;
        camera.position.z = Math.cos(t * 0.1) * 38;
        camera.position.y = 13 + Math.sin(t * 0.05) * 2.7;
        camera.lookAt(0, 0, 0);
    }

    if (!paused) {
        const t = clock.getElapsedTime();
        PLANETS.forEach((p, i) => {
            planetGroups[i].rotation.y = t * orbitSpeeds[i];
            planetMeshes[i].rotation.y += 0.02;
        });
    }

    renderer.render(scene, camera);
    planetMeshes.forEach((mesh, idx) => {
        const pos = new THREE.Vector3();
        mesh.getWorldPosition(pos);

        // Project 3D position to 2D screen
        pos.project(camera); // Now pos.x/y is in clip space [-1,1]

        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
        planetLabels[idx].style.left = `${x - planetLabels[idx].offsetWidth / 2}px`;
        planetLabels[idx].style.top = `${y - 36}px`; // 36px above the planet (tweak as needed)
        planetLabels[idx].style.display = 'block'; // always visible
    });
}

// Speed control panel
function setupControls() {
    const controlsDiv = document.getElementById('controls');
    controlsDiv.innerHTML = '';
    PLANETS.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'planet-control';

        const label = document.createElement('label');
        label.className = 'planet-label';
        label.textContent = p.name;
        label.htmlFor = `slider-${i}`;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'slider';
        slider.id = `slider-${i}`;
        slider.min = 0.05;
        slider.max = 10;
        slider.step = 0.01;
        slider.value = orbitSpeeds[i];
        slider.title = `Adjust ${p.name} speed`;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'slider-value';
        valueDisplay.textContent = slider.value;

        slider.addEventListener('input', (e) => {
            orbitSpeeds[i] = parseFloat(e.target.value);
            valueDisplay.textContent = e.target.value;
        });

        div.appendChild(label);
        div.appendChild(slider);
        div.appendChild(valueDisplay);
        controlsDiv.appendChild(div);
    });

    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.onclick = () => {
        paused = !paused;
        pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        if (!paused) clock.start();
        else clock.stop();
    };
}

// Theme toggle
function setupThemeToggle() {
    let modeBtn = document.getElementById('theme-toggle-btn');
    if (!modeBtn) {
        modeBtn = document.createElement('button');
        modeBtn.id = 'theme-toggle-btn';
        modeBtn.innerText = isDarkMode ? 'Light mode' : 'Dark mode';
        modeBtn.className = 'theme-toggle-btn';
        modeBtn.style.marginTop = '12px';
        modeBtn.style.width = '100%';
        document.getElementById('controls-panel').appendChild(modeBtn);
    }
    modeBtn.onclick = () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('lightmode', !isDarkMode);
        setSceneBackground();
        addStars(800);
        modeBtn.innerText = isDarkMode ? 'Light mode' : 'Dark mode';
        document.querySelectorAll('.planet-tooltip').forEach(lbl => {
            lbl.classList.toggle('lightmode', !isDarkMode);
        });
    };
}

// Raycast for hover and click
function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(planetMeshes, false);
    let found = false;
    planetLabels.forEach((lbl, idx) => {
        if (intersects.length && intersects[0].object === planetMeshes[idx]) {
            // Show label
            lbl.style.display = 'block';
            lbl.style.left = `${event.clientX + 16}px`;
            lbl.style.top = `${event.clientY - 8}px`;
            found = true;
        } else {
            lbl.style.display = 'none';
        }
    });
    renderer.domElement.style.cursor = found ? 'pointer' : '';
}

function onPointerDown(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(planetMeshes, false);
    if (intersects.length) {
        const mesh = intersects[0].object;
        focusCameraOnPlanet(mesh);
    }
}


function focusCameraOnPlanet(mesh) {
    // When a planet is clicked, start following it in real time
    followingPlanet = mesh;
    document.getElementById('reset-camera-btn').style.display = 'block';
}

function animateCameraToTarget() {
    if (!cameraTarget) return;
    const DURATION = 1.1;
    cameraTarget.t += clock.getDelta() / DURATION;
    const t = Math.min(cameraTarget.t, 1);
    const smoothT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(cameraTarget.camFrom, cameraTarget.camTo, smoothT);
    const lookAt = new THREE.Vector3().lerpVectors(cameraTarget.lookAtFrom, cameraTarget.lookAtTo, smoothT);
    camera.lookAt(lookAt);
    if (t >= 1) {
        cameraAnimating = false;
        if (cameraTarget.isReset) {
            cameraTarget = null;
            document.getElementById('reset-camera-btn').style.display = 'none';
        }
    }
}
document.getElementById('reset-camera-btn').onclick = resetCameraView;
function resetCameraView() {
    followingPlanet = null; // Stop following any planet
    // (Optionally, you can add back your animated camera reset logic)
    // Animate camera back to default view (optional smooth transition)
    const camFrom = camera.position.clone();
    const camTo = defaultCamera.position.clone();
    const lookAtFrom = camera.getWorldDirection(new THREE.Vector3()).add(camera.position);
    const lookAtTo = defaultCamera.lookAt.clone();

    cameraTarget = { camFrom, camTo, lookAtFrom, lookAtTo, t: 0, isReset: true };
    cameraAnimating = true;
    document.getElementById('reset-camera-btn').style.display = 'none';
}
window.onload = init;