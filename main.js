import { Chunk } from './js/chunk.js';
import { BLOCK } from './js/blocks.js';
import { Player } from './js/player.js'; 

// --- VARIABLES GLOBALES ---
const player = new Player();
const keys = {};

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

    // II. Géométrie (Monde)
    const world = new Chunk();
    
    // On génère le terrain (Herbe + Terre + quelques blocs)
    //Floor -> Terrain
     world.generateFloor(30, 30); 

    // Exemple d'ajout manuel si tu veux
    // world.setBlock(5, 5, 5, BLOCK.WOOD); 

    const vertices = world.buildMesh();
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

    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
        arrayStride: 24,
        attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" }
        ]
    };

    // III. Shaders
    const shaderCode = `
        struct Uniforms { mvpMatrix: mat4x4<f32> };
        @binding(0) @group(0) var<uniform> uniforms: Uniforms;
        struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) color: vec3<f32>,
        };
        struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) color: vec3<f32>,
        };
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
            output.color = input.color;
            return output;
        }
        @fragment
        fn fragmentMain(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
        }
    `;
    const shaderModule = device.createShaderModule({ code: shaderCode });

    // IV. Pipeline
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: 'vertexMain', buffers: [vertexBufferLayout] },
        fragment: { module: shaderModule, entryPoint: 'fragmentMain', targets: [{ format }] },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
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
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    // --- CONTRÔLES FPS ---
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
    });

    window.addEventListener("keyup", (event) => {
        keys[event.key.toLowerCase()] = false;
        if (event.key === ' ') keys[' '] = false;
    });

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

        // --- CALCUL DE LA VUE (FPS) ---
        // 1. Calculer le point cible (Target) : Position + Direction du regard
        // Calcul Vue (Position = Yeux du joueur)
        const eyeX = player.x;
        const eyeY = player.y + player.PLAYER_HEIGHT;
        const eyeZ = player.z;

        const targetX = eyeX - Math.sin(player.yaw) * Math.cos(player.pitch);
        const targetY = eyeY + Math.sin(player.pitch);
        const targetZ = eyeZ - Math.cos(player.yaw) * Math.cos(player.pitch);

        // 2. Créer la matrice de vue
        // Oeil : (camX, camY, camZ) -> Cible : (targetX, targetY, targetZ)
        glMatrix.mat4.lookAt(viewMatrix, [eyeX, eyeY, eyeZ], [targetX, targetY, targetZ], [0, 1, 0]);

        // --- PROJECTION ---
        const aspect = canvas.width / canvas.height;
        glMatrix.mat4.perspective(projectionMatrix, 1.0, aspect, 0.1, 100.0);

        // --- MVP ---
        glMatrix.mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
        glMatrix.mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

        device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix);

        // --- DESSIN ---
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
        renderPass.draw(vertices.length / 6); // Juste le cube
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

main();