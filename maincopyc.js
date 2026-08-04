//main.js - Point d'entrée du jeu
//import { Chunk } from './js/chunk.js';
import { World } from './js/world.js';
import { BLOCK } from './js/blocks.js';
import { Player } from './js/player.js'; 
//import { saveGame, loadGame } from './js/save.js';
//import { loadAllTextures } from './js/textures.js';
import { createTextureAtlas } from './js/textureAtlas.js';
import { NetworkManager } from './js/networks.js';
import { waitForMenuChoice } from './js/menu.js';
import { OtherPlayer } from './js/otherPlayer.js';
import { initChat, displayChatMessage, isChatting } from './js/chat.js';

import { SHADER_CODE } from './js/shaders.js';
import { initInputs } from './js/inputs.js';


// --- VARIABLES GLOBALES ---
const player = new Player();
window.player = player;

const keys = {};
let selectedBlock = BLOCK.DIRT; // Par défaut, on pose de l'herbe
let gameTime = 0;
let isPointerLocked = false; 
let otherPlayerPos = { x : 0, y : 0, z : 0};
let otherPlayerConnected = false;

const soundBreak = new Audio('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/sounds/break.mp3');
const soundPlace = new Audio('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/sounds/place.mp3');
const soundGlass = new Audio('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/sounds/glass_break.mp3');
const soundWood = new Audio('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/sounds/wood_break.mp3');

// WEBWORKER FOR MESH BUILDING
const meshWorker = new Worker('js/worker.js');
let meshRequestId = 0;
let currentMeshRequestId = 0;
let isMeshBuilding = false;

// I. Initialisation
async function main() {
    // ... (Initialisation WebGPU standard, je zappe pour aller au cœur du code) ...
    if (!navigator.gpu) { console.error("WebGPU not supported"); return; }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) { return; }
    const device = await adapter.requestDevice();

    // LE JEU ATTEND LE CHOIX DU MENU
    const choice = await waitForMenuChoice();

    // LE PONT VERS INPUTS.JS
    const state = {
        keys: keys,
        selectedBlock: selectedBlock,
        isPointerLocked: isPointerLocked,
        vertexBuffer: null, 
        vertices: null
    };

    const otherPlayer = new OtherPlayer(device);
    // ON INITIALISE LE RÉSEAU SEULEMENT SI C'EST MULTI
    let network = null;
    if (choice.mode === 'multi') {
        const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
        network = new NetworkManager(`${wsProtocol}${choice.ip}/ws`, choice.room);

        // Quand on reçoit l'historique
        network.onWorldSync = (blocks) => {
            console.log(`📦 Chargement de ${blocks.length} bloc(s) depuis le serveur`);
            for (const b of blocks) {
                world.setBlock(b.x, b.y, b.z, b.blockId);
            }
            // Rebuild le mesh
            window.requestBuildMesh();
        };

        // AJOUTE CE BLOC 
        network.onBlockAction = (action, x, y, z, blockId) => {
            if (action === "break") {
                world.setBlock(x, y, z, BLOCK.AIR);
            } else if (action === "place") {
                world.setBlock(x, y, z, blockId);
            }
            
            // On reconstruit le mesh pour que le trou apparaisse chez l'autre joueur !
            window.requestBuildMesh();
        };

        network.onPlayerPositionUpdate = (x, y, z) => {
            console.log(`👤 Autre joueur vu à : X=${x.toFixed(1)} Y=${y.toFixed(1)} Z=${z.toFixed(1)}`);
            otherPlayerPos.x = x;
            otherPlayerPos.y = y;
            otherPlayerPos.z = z;
            otherPlayerConnected = true;

            // isFinite empeche les NaN et Infinity
            if (isFinite(x) && isFinite(y) && isFinite(z)) {
                otherPlayer.updatePosition(x, y, z);
            }
        };

        network.onPlayerName = (name) => {
            document.getElementById('nametag').innerText = name;
        };
    }
    // ------------------------

    const canvas = document.getElementById('webgpu-canvas');

    if (network){
        initChat(network,canvas);
        network.onChat = (sender, message) => displayChatMessage(sender, message);
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    const { texture, sampler } = await createTextureAtlas(device);

    // II. Géométrie (Monde)
    //const world = new Chunk();
    const world = new World();
    
    // On génère le terrain (Herbe + Terre + quelques blocs)
    //Floor -> Terrain
    world.update(player.x, player.z);
    //world.generateFloor(70, 70); 

    let vertices = world.buildMesh();

    let vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // On lie le buffer initial au state
    state.vertexBuffer = vertexBuffer;
    state.vertices = vertices;

    // CRÉATION DU CUBE POUR L'AUTRE JOUEUR
    const playerVertices = new Float32Array([
        // Face devant (Z=0.5)
        -0.3, -0.5,  0.3,  0.0, 0.0,  0.0,  0.0,  1.0,
         0.3, -0.5,  0.3,  1.0, 0.0,  0.0,  0.0,  1.0,
         0.3,  0.5,  0.3,  1.0, 1.0,  0.0,  0.0,  1.0,
        -0.3,  0.5,  0.3,  0.0, 1.0,  0.0,  0.0,  1.0,
        // Face derrière (Z=-0.5)
         0.3, -0.5, -0.3,  0.0, 0.0,  0.0,  0.0, -1.0,
        -0.3, -0.5, -0.3,  1.0, 0.0,  0.0,  0.0, -1.0,
        -0.3,  0.5, -0.3,  1.0, 1.0,  0.0,  0.0, -1.0,
         0.3,  0.5, -0.3,  0.0, 1.0,  0.0,  0.0, -1.0,
    ]);

    const playerVertexBuffer = device.createBuffer({
        size: playerVertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(playerVertexBuffer, 0, playerVertices);

    const vertexBufferLayout = {
        arrayStride: 32, // 3 POS (12 bytes) + 2 UV (8 bytes) + 3 Normale (12 bytes) = 32 bytes par vertex
        attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" }, // Position
            { shaderLocation: 1, offset: 12, format: "float32x2" }, // UV
            { shaderLocation: 2, offset: 20, format: "float32x3" } // Normale (optionnel)
        ]
    };

    // III. Shaders
    const shaderModule = device.createShaderModule({ code: SHADER_CODE });

    // IV. Pipeline
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vertexMain', buffers: [vertexBufferLayout] },
        fragment: { 
            module: shaderModule, 
            entryPoint: 'fragmentMain', 
            targets: [{ 
                format,
                blend: {
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add',
                    },
                },
            }] 
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    });

    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // 64 bytes pour la matrice + 16 bytes pour le temps (alignement WGSL oblige)
    const uniformBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const lightsBuffer = device.createBuffer({ size: 272, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // BUFFER SPÉCIAL POUR DESSINER L'AUTRE JOUEUR
    const playerUniformBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const playerBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: playerUniformBuffer } }, // Le sien !
            { binding: 1, resource: sampler },
            { binding: 2, resource: texture.createView() },
            { binding: 3, resource: { buffer: lightsBuffer } }
        ],
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },      // On remet le sampler
            { binding: 2, resource: texture.createView() }, // On remet la texture
            { binding: 3, resource: { buffer: lightsBuffer } }
        ],
    });

    // V. Rendu
    let lastTime = 0;
    function frame(time) {

        if (lastTime === 0) lastTime = time; // Initialisation du temps
        const dt = (time - lastTime) / 1000;
        lastTime = time;

        // Si on est absent PLUS de 120 secondes (2 minutes) -> ON PERD (Reload)
        if (dt > 120) {
            location.reload(); // Recharge la page (Game Over)
            return; 
        }

        // On saute juste la mise à jour physique pour éviter que le joueur ne traverse le sol.
        if (dt > 1.0) {
            // On redemande une image pour que le jeu ne gèle pas
            requestAnimationFrame(frame);
            return;
        }
        // Mettre à jour la logique du jeu (mouvement du joueur, etc.)
        if (!isChatting()){
            player.update(dt, keys, world);
        }

        // Recharge les chunks si le joueur a changé de chunk
        const chunksChanged = world.update(player.x, player.z);
        if (chunksChanged) {
            window.requestBuildMesh();
        }

        const modelMatrix = glMatrix.mat4.create(); // Le cube est fixe dans le monde
        const viewMatrix = glMatrix.mat4.create();
        const projectionMatrix = glMatrix.mat4.create();
        const mvpMatrix = glMatrix.mat4.create();

        // CALCUL DE LA VUE (FPS)
        // Calcul Vue (Position = Yeux du joueur)
        const eyeX = player.x;
        const eyeY = player.y + player.PLAYER_HEIGHT;
        const eyeZ = player.z;

        const targetX = eyeX - Math.sin(player.yaw) * Math.cos(player.pitch);
        const targetY = eyeY + Math.sin(player.pitch);
        const targetZ = eyeZ - Math.cos(player.yaw) * Math.cos(player.pitch);

        // La caméra regarde vers le point cible
        glMatrix.mat4.lookAt(viewMatrix, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);

        // PROJECTION
        const aspect = canvas.width / canvas.height;
        glMatrix.mat4.perspective(projectionMatrix, 1.0, aspect, 0.1, 100.0);

        // MVP
        glMatrix.mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
        glMatrix.mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

        // 1. On écrit la matrice (la caméra) au début du buffer (offset 0)
        device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix);

        // 2. On prépare le temps
        gameTime += dt; // Le temps avance

        // On crée un petit tableau pour le temps (un seul float)
        const timeData = new Float32Array([gameTime]);

        // 3. On écrit le temps dans le buffer, APRÈS la matrice (offset 64)
        device.queue.writeBuffer(uniformBuffer, 64, timeData);

        // DESSIN
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.5, g: 0.7, b: 1.0, a: 1.0 }, // Ciel bleu
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        });

        // Dans main.js, dans la boucle frame()
        document.getElementById('debug-coords').textContent = `X: ${player.x.toFixed(1)} | Z: ${player.z.toFixed(1)} | Chunk: (${Math.floor(player.x/16)}, ${Math.floor(player.z/16)})`;

        // DESSIN DU MONDE
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, state.vertexBuffer);
        renderPass.draw(state.vertices.length / 8); // Juste le cube

        // 2. ON DESSINE L'AUTRE JOUEUR
        if (network && otherPlayer) {
            // La classe OtherPlayer calcule la magie du Billboard toute seule !
            const playerMvp = otherPlayer.getMatrix(viewMatrix, projectionMatrix);
            
            // On envoie la matrice au shader
            device.queue.writeBuffer(playerUniformBuffer, 0, playerMvp);

            // On dessine le carré plat (6 sommets = 2 triangles)
            renderPass.setBindGroup(0, playerBindGroup);
            renderPass.setVertexBuffer(0, otherPlayer.buffer); // Le buffer de la classe !
            renderPass.draw(36); 
        }

        // PLAYER NAME TAG
        const nametag = document.getElementById('nametag');

        if (network && otherPlayerConnected) { // On utilise notre variable à nous !
            
            // 1. Position 3D de l'autre joueur (montée de 1.2 pour la tête)
            const pos3D = [otherPlayerPos.x, otherPlayerPos.y + 1.2, otherPlayerPos.z];

            // 2. Matrice de projection combinée
            const viewProj = glMatrix.mat4.create();
            glMatrix.mat4.multiply(viewProj, projectionMatrix, viewMatrix);

            // 3. Projection 3D vers 2D écran
            const projected = glMatrix.vec3.transformMat4(glMatrix.vec3.create(), pos3D, viewProj);

            // 4. S'il est DEVANT la caméra
            if (projected[2] < 1) {
                const screenX = (projected[0] * 0.5 + 0.5) * canvas.width;
                const screenY = (-projected[1] * 0.5 + 0.5) * canvas.height;

                nametag.style.left = screenX + 'px';
                nametag.style.top = screenY + 'px';
                nametag.style.display = 'block'; 
            } else {
                nametag.style.display = 'none'; 
            }
        } else {
            nametag.style.display = 'none'; 
        }

        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);

        // ENVOI RESEAU
        if (network) {
            network.sendPosition(player.x, player.y, player.z, time);
        }
        requestAnimationFrame(frame);
    }

    function updateLights() {
        const lights = world.getLightSources();
        // 272 bytes : count(4) + padding(12) + 16 lights × (vec3 pos + intensity = 16 bytes)
        const data = new ArrayBuffer(272);
        const view = new DataView(data);

        // count
        view.setUint32(0, lights.length, true);
        // padding (12 bytes) → on ne touche pas

        // lampes
        for (let i = 0; i < Math.min(lights.length, 16); i++) {
            const offset = 16 + i * 16; // 16 bytes header + 16 bytes par lampe
            view.setFloat32(offset + 0,  lights[i].x,  true);
            view.setFloat32(offset + 4,  lights[i].y,  true);
            view.setFloat32(offset + 8,  lights[i].z,  true);
            view.setFloat32(offset + 12, 100.0,          true); // intensité
        }

        device.queue.writeBuffer(lightsBuffer, 0, data);
    }

    function updateHotbar(slotNumber) {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        document.getElementById(`slot-${slotNumber}`).classList.add('active');
    }

    updateLights();
    updateHotbar(2);

    // LANCEMENT DES INPUTS
    initInputs(state, {
        canvas, player, world, device, network, 
        sounds: { breakDefault: soundBreak, place: soundPlace, glass: soundGlass, wood: soundWood }, 
        updateLights, updateHotbar
    });

    // WEBWORKER LISTENER
    meshWorker.onmessage = function(event) {
        const newVertices = event.data.mesh;
        const requestId = event.data.requestId;

        // ANTI-GLITCH : Si le joueur a bougé pendant le calcul, on jette l'ancien résultat
        if (requestId !== currentMeshRequestId) {
            return; 
        }

        // Mise à jour du GPU
        if (newVertices.byteLength > state.vertexBuffer.size) {
            state.vertexBuffer.destroy();
            state.vertexBuffer = device.createBuffer({
                size: newVertices.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
        }
        device.queue.writeBuffer(state.vertexBuffer, 0, newVertices);
        state.vertices = newVertices;
        
        isMeshBuilding = false; // Le worker a fini
    };

    // FUNCTION TO ASK THE WORKER TO BUILD
    window.requestBuildMesh = function() {
        if (isMeshBuilding) return; 
        isMeshBuilding = true;
        currentMeshRequestId = ++meshRequestId;

        const chunksPayload = [];
        for (const [key, chunk] of world.chunks) {
            const blocksArray = [];
            for (const [coordKey, blockId] of chunk.blocks) {
                const parts = coordKey.split(',');
                blocksArray.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]), blockId);
            }
            chunksPayload.push({
                cx: chunk.chunkX, cz: chunk.chunkZ, size: chunk.size,
                blocks: new Float32Array(blocksArray)
            });
        }
        meshWorker.postMessage({ chunks: chunksPayload, requestId: currentMeshRequestId });
    }

    requestAnimationFrame(frame);
    
}

main();