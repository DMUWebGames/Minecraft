//main.js - Point d'entrée du jeu
//import { Chunk } from './js/chunk.js';
import { World } from './js/world.js';
import { BLOCK } from './js/blocks.js';
import { Player } from './js/player.js'; 

// --- VARIABLES GLOBALES ---
const player = new Player();
window.player = player;

const keys = {};
let selectedBlock = BLOCK.DIRT; // Par défaut, on pose de l'herbe
let gameTime = 0;

// I. Initialisation
async function main() {
    // ... (Initialisation WebGPU standard, je zappe pour aller au cœur du code) ...
    if (!navigator.gpu) { console.error("WebGPU not supported"); return; }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) { return; }
    const device = await adapter.requestDevice();

    const canvas = document.getElementById('webgpu-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    // CREATION DE LA TEXTURE (ATLAS) POUR LES BLOCS
    // On crée un petit canvas 2D pour dessiner nos textures
    const textureSize = 128; // Taille  l'image
    const cellSize = 32;    // Taille d'une texture 

    const textureCanvas = document.createElement('canvas');
    //document.body.appendChild(textureCanvas); // Optionnel : pour voir le résultat
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const ctx = textureCanvas.getContext('2d');


    // Ligne du haut du canvas (y=0) : Herbe, Terre, Pierre, Bois
    ctx.fillStyle = '#3a9d23'; ctx.fillRect(0, 0, cellSize, cellSize);
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(cellSize, 0, cellSize, cellSize);
    ctx.fillStyle = '#808080'; ctx.fillRect(2*cellSize, 0, cellSize, cellSize);
    ctx.fillStyle = '#5c4033'; ctx.fillRect(3*cellSize, 0, cellSize, cellSize);

    // Ligne suivante (y=32) : Lampe, Verre, Eau
    ctx.fillStyle = '#FFD700'; ctx.fillRect(0, cellSize, cellSize, cellSize);

    ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
    ctx.fillRect(cellSize, cellSize, cellSize, cellSize);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
    ctx.strokeRect(cellSize + 2, cellSize + 2, cellSize - 4, cellSize - 4);

    ctx.fillStyle = 'rgba(52, 152, 219, 0.6)'
    ctx.fillRect(2*cellSize, cellSize, cellSize, cellSize);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(2*cellSize + 5, cellSize + 5, 4, 4);
    ctx.fillRect(2*cellSize + 20, cellSize + 15, 3, 3);
    
    // Optionnel : Ajouter du bruit pour faire moins "plat"
    // (Tu peux ignorer cette boucle si tu veux des couleurs unies)
    for(let k=0; k<500; k++) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(Math.random()*textureSize, Math.random()*textureSize, 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.random()*textureSize, Math.random()*textureSize, 2, 2);
    }

    // Créer l'objet Texture WebGPU
    const texture = device.createTexture({
        size: [textureSize, textureSize],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    // Copier l'image du canvas vers le GPU
    const imageBitmap = await createImageBitmap(textureCanvas);
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [textureSize, textureSize]
    );

    // Créer le Sampler (comment le GPU lit la texture)
    const sampler = device.createSampler({
        magFilter: 'nearest', // 'nearest' garde le style pixel art (Minecraft)
        minFilter: 'nearest',
    });

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

    const vertexBufferLayout = {
        arrayStride: 32, // 3 POS (12 bytes) + 2 UV (8 bytes) + 3 Normale (12 bytes) = 32 bytes par vertex
        attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" }, // Position
            { shaderLocation: 1, offset: 12, format: "float32x2" }, // UV
            { shaderLocation: 2, offset: 20, format: "float32x3" } // Normale (optionnel)
        ]
    };

    // III. Shaders
    const shaderCode = `
        struct Uniforms { 
            mvpMatrix: mat4x4<f32>, 
            time: f32, 
            pad1: f32, 
            pad2: f32, 
            pad3: f32 
        };

        @binding(0) @group(0) var<uniform> uniforms: Uniforms;
        // On remet la texture
        @binding(1) @group(0) var textureSampler: sampler;
        @binding(2) @group(0) var textureData: texture_2d<f32>;

        //struct d'une lampe
        struct Light {
            pos: vec3<f32>,
            intensity: f32,
        };

        //Buffer des lampes (max 16)
        struct LightsBuffer {
            count: u32,
            pad1: u32, pad2: u32, pad3: u32, // padding alignement
            lights: array<Light, 16>,
        };
        
        @binding(3) @group(0) var<uniform> lightsData: LightsBuffer;

        struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) uv: vec2<f32>,
            @location(2) normal: vec3<f32>, // Optionnel : pour l'éclairage
        };
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
            @location(1) normal: vec3<f32>,
            @location(2) worldPos: vec3<f32>, // Position dans le monde pour l'éclairage
        };
        
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
            output.uv = input.uv;
            output.normal = input.normal;
            output.worldPos = input.position; // position monde
            return output;
        }

        @fragment
        fn fragmentMain(@location(0) uv: vec2<f32>, @location(1) normal: vec3<f32>, @location(2) worldPos: vec3<f32>,) -> @location(0) vec4<f32> {

        let texColor = textureSample(textureData, textureSampler, uv);

        // Lumière ambiante
        var totalLight = vec3<f32>(0.2, 0.2, 0.2); 

        // Soleil (on le garde mais plus doux)
        // CALCUL DU SOLEIL DYNAMIQUE
        // uniforms.time * 0.005 ralentit la rotation.
        let sunAngle = uniforms.time * 0.005; 

        // Création de la direction du soleil :
        // X = cos(angle) -> Il se déplace sur l'horizon
        // Y = sin(angle) -> Il monte et descend (hauteur)
        // Z = 0.2 -> Un petit fixe pour avoir des ombres un peu obliques
        var sunDir = normalize(vec3<f32>(cos(sunAngle), sin(sunAngle), 0.2));

        // Gestion Jour / Nuit
        // Si le soleil est bas (Y négatif), c'est la nuit.
        let isDay = sunDir.y > -0.2; 

        // Couleur du soleil :
        // Jour : Blanc/Jaune
        // Nuit : Bleu foncé (Lune) ou Noir
        let sunColor = select(vec3<f32>(0.05, 0.05, 0.15), vec3<f32>(0.9, 0.8, 0.6), isDay);

        // Intensité du soleil :
        // Jour : Forte
        // Nuit : Très faible
        let sunIntensity = select(0.1, 1.0, isDay);

        // Application de la lumière
        let sunDiffuse = max(dot(normal, sunDir), 0.0);
        totalLight += sunColor * sunDiffuse * sunIntensity * 0.8; // 0.8 pour adoucir

        // Point lights (lampes)
        for (var i: u32 = 0u; i < lightsData.count; i++) {
            let light = lightsData.lights[i];
            let toLight = light.pos - worldPos;
            let dist = length(toLight);
            let dir = normalize(toLight);

            // Atténuation : plus on est loin, moins on reçoit
            let attenuation = light.intensity / (1.0 + dist * dist);

            // Diffuse
            let diffuse = max(dot(normal, dir), 0.0);

            // Couleur chaude orange pour les lampes
            totalLight += vec3<f32>(1.0, 0.55, 0.1) * diffuse * attenuation;
        }

        // Clamp pour ne pas dépasser le blanc
        let finalLight = clamp(totalLight, vec3<f32>(0.0), vec3<f32>(1.0));
        return vec4<f32>(texColor.rgb * finalLight, texColor.a);
        }
    `;
    const shaderModule = device.createShaderModule({ code: shaderCode });

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

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },      // On remet le sampler
            { binding: 2, resource: texture.createView() }, // On remet la texture
            { binding: 3, resource: { buffer: lightsBuffer } }
        ],
    });

    // CONTRÔLES FPS 
    window.addEventListener("keydown", (event) => {
        keys[event.key.toLowerCase()] = true;
        if (event.key === ' ') keys[' '] = true;

        // Flèches = Rotation caméra
        //const turnSpeed = 0.1;

        // Choix des blocs avec les touches 1, 2, 3
        switch(event.key) {
            case '1': selectedBlock = BLOCK.GRASS; updateHotbar(1); break;
            case '2': selectedBlock = BLOCK.DIRT; updateHotbar(2); break;
            case '3': selectedBlock = BLOCK.STONE; updateHotbar(3); break;
            case '4': selectedBlock = BLOCK.WOOD; updateHotbar(4); break;
            case '5': selectedBlock = BLOCK.LAMP; updateHotbar(5); break;
            case '6': selectedBlock = BLOCK.GLASS; updateHotbar(6); break;
            case '7': selectedBlock = BLOCK.WATER; updateHotbar(7); break;
        }
        //Simplifier le code
    });

    window.addEventListener("keyup", (event) => {
        keys[event.key.toLowerCase()] = false;
        if (event.key === ' ') keys[' '] = false;
    });
    
    // Souris pour casser et poser des blocs
    canvas.addEventListener("mousedown", (event) => {
        const target = player.raycast(world);
        if (target) {
            let modified = false;

            if (event.button === 0) {
                // Casser le bloc
                world.setBlock(target.x, target.y, target.z, BLOCK.AIR);
                modified = true;
            } else if (event.button === 2) {
                // Poser un bloc de bois devant le joueur
                let px = target.x;
                let py = target.y + 1;
                let pz = target.z;

                if (world.getBlock(px, py, pz) === BLOCK.AIR) {
                    world.setBlock(px, py, pz, selectedBlock);
                    modified = true;
                }
            }
            // Rebuild du mesh après modification
            if (modified) {
                const newVertices = world.buildMesh();

                if (newVertices.byteLength > vertexBuffer.size) {
                    vertexBuffer.destroy();
                    vertexBuffer = device.createBuffer({
                        size: newVertices.byteLength,
                        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    });
                }
                device.queue.writeBuffer(vertexBuffer, 0, newVertices);
                vertices = newVertices; // Mettre à jour les vertices pour le rendu
                updateLights(); // Mettre à jour les lumières si nécessaire
            }
        }
    });

    // Empêcher le menu contextuel du clic droit sur le canvas
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

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
        player.update(dt, keys, world);

        // Recharge les chunks si le joueur a changé de chunk
        const chunksChanged = world.update(player.x, player.z);
        if (chunksChanged) {
            const newVertices = world.buildMesh();

            if (newVertices.byteLength > vertexBuffer.size) {
                vertexBuffer.destroy();
                vertexBuffer = device.createBuffer({
                    size: newVertices.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
            }
            device.queue.writeBuffer(vertexBuffer, 0, newVertices);
            vertices = newVertices;
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

        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.draw(vertices.length / 8); // Juste le cube
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
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
            view.setFloat32(offset + 12, 10.0,          true); // intensité
        }

        device.queue.writeBuffer(lightsBuffer, 0, data);
    }

    function updateHotbar(slotNumber) {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        document.getElementById(`slot-${slotNumber}`).classList.add('active');
    }

    updateLights();
    updateHotbar(2);
    requestAnimationFrame(frame);
    
}

main();