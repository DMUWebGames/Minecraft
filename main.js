//main.js - Point d'entrée du jeu
import { Chunk } from './js/chunk.js';
import { BLOCK } from './js/blocks.js';
import { Player } from './js/player.js'; 

// --- VARIABLES GLOBALES ---
const player = new Player();
const keys = {};
let selectedBlock = BLOCK.DIRT; // Par défaut, on pose de l'herbe

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
    const textureSize = 64; // Taille  l'image
    const cellSize = 32;    // Taille d'une texture 

    const textureCanvas = document.createElement('canvas');
    //document.body.appendChild(textureCanvas); // Optionnel : pour voir le résultat
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const ctx = textureCanvas.getContext('2d');

    // Case (0,0) Herbe : Vert
    ctx.fillStyle = '#3a9d23'; ctx.fillRect(0, 0, cellSize, cellSize);
    // Case (1,0) Terre : Marron
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(cellSize, 0, cellSize, cellSize);
    // Case (0,1) Pierre : Gris
    ctx.fillStyle = '#808080'; ctx.fillRect(0, cellSize, cellSize, cellSize);
    // Case (1,1) Bois : Marron foncé
    ctx.fillStyle = '#5c4033'; ctx.fillRect(cellSize, cellSize, cellSize, cellSize);
    
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
    const world = new Chunk();
    
    // On génère le terrain (Herbe + Terre + quelques blocs)
    //Floor -> Terrain
     world.generateFloor(70, 70); 

    // Exemple d'ajout manuel si tu veux
    // world.setBlock(5, 5, 5, BLOCK.WOOD); 

    let vertices = world.buildMesh();
    /*const vertices = new Float32Array([
        // Face avant (Rouge) - Le cube sera centré en 0,0,0
        -1, -1,  1, 1, 0, 0,  1, -1,  1, 1, 0, 0,  1,  1,  1, 1, 0, 0, -1, -1,  1, 1, 0, 0,  1,  1,  1, 1, 0, 0, -1,  1,  1, 1, 0, 0,
        // Face arrière (Bleu)
        -1, -1, -1, 0, 0, 1, -1,  1, -1, 0, 0, 1,  1,  1, -1, 0, 0, 1, -1, -1, -1, 0, 0, 1,  1,  1, -1, 0, 0, 1,  1, -1, -1, 0, 0, 1,
        // Face supérieure (Vert)
        -1,  1, -1, 0, 1, 0, -1,  1,  1, 0, 1, 0,  1,  1,  1, 0, 1, 0, -1,  1, -1, 0, 1, 0,  1,  1,  1, 0, 1, 0,  1,  1, -1, 0, 1, 0,
        // Face inférieure (Jaune)
        -1, -1, -1, 1, 1, 0,  1, -1, -1, 1, 1, 0,  1, -1,  1, 1, 1, 0, -1, -1, -1, 1, 1, 0,  1, -1,  1, 1, 1, 0, -1, -1,  1, 1, 1, 0,
        // Face droite (Cyan)
         1, -1, -1, 0, 1, 1,  1,  1, -1, 0, 1, 1,  1,  1,  1, 0, 1, 1,  1, -1, -1, 0, 1, 1,  1,  1,  1, 0, 1, 1,  1, -1,  1, 0, 1, 1,
        // Face gauche (Magenta)
        -1, -1, -1, 1, 0, 1, -1, -1,  1, 1, 0, 1, -1,  1,  1, 1, 0, 1, -1, -1, -1, 1, 0, 1, -1,  1,  1, 1, 0, 1, -1,  1, -1, 1, 0, 1,
    ]);*/

    let vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
        arrayStride: 20, // 3 POS (12 bytes) + 2 UV (8 bytes) = 20 bytes par vertex
        attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" }, // Position
            { shaderLocation: 1, offset: 12, format: "float32x2" } // UV
        ]
    };

    // III. Shaders
    const shaderCode = `
        struct Uniforms { mvpMatrix: mat4x4<f32> };
        @binding(0) @group(0) var<uniform> uniforms: Uniforms;

        // On remet la texture
        @binding(1) @group(0) var textureSampler: sampler;
        @binding(2) @group(0) var textureData: texture_2d<f32>;

        struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) uv: vec2<f32>,
        };
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
        };
        
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
            output.uv = input.uv;
            return output;
        }

        @fragment
        fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
            // On lit la texture
            return textureSample(textureData, textureSampler, uv);
        }
    `;
    const shaderModule = device.createShaderModule({ code: shaderCode });

    // IV. Pipeline
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vertexMain', buffers: [vertexBufferLayout] },
        fragment: { module: shaderModule, entryPoint: 'fragmentMain', targets: [{ format }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' },
    });

    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const uniformBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },      // On remet le sampler
            { binding: 2, resource: texture.createView() } // On remet la texture
        ],
    });

    // CONTRÔLES FPS 
    window.addEventListener("keydown", (event) => {
        keys[event.key.toLowerCase()] = true;
        if (event.key === ' ') keys[' '] = true;

        // Flèches = Rotation caméra
        const turnSpeed = 0.05;
        switch (event.key) {
            case "ArrowRight":  player.yaw -= turnSpeed; break;
            case "ArrowLeft": player.yaw += turnSpeed; break;
            case "ArrowDown":  player.pitch -= turnSpeed; break;
            case "ArrowUp":  player.pitch += turnSpeed; break;
        }

        // Choix des blocs avec les touches 1, 2, 3
        switch(event.key) {
            case '1': selectedBlock = BLOCK.GRASS; console.log("Block : Herbe"); break;
            case '2': selectedBlock = BLOCK.DIRT; console.log("Block : Terre"); break;
            case '3': selectedBlock = BLOCK.STONE; console.log("Block : Pierre"); break;
            case '4': selectedBlock = BLOCK.WOOD; console.log("Block : Bois"); break;
        }
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

        // Mettre à jour la logique du jeu (mouvement du joueur, etc.)
        player.update(dt, keys, world);

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

        device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix);

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
        renderPass.draw(vertices.length / 5); // Juste le cube
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

main();