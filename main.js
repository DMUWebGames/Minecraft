//import { Chunk } from './js/chunk.js';


// --- VARIABLES GLOBALES ---
// Position du joueur dans le monde
let camX = 0;
let camY = 1; // On commence un peu en hauteur (comme un joueur)
let camZ = 5;

// Orientation de la tête (Angles)
let camYaw = 0;   // Rotation gauche/droite
let camPitch = 0; // Rotation haut/bas

// Rotation du cube (pour ZQSD qui tourne le cube si c'est ça que tu veux, 
// mais attention dans ton texte tu dis que ZQSD déplace la caméra. 
// Je suis ton texte : ZQSD = Déplacement caméra)

// Si tu veux que ZQSD tourne le cube, il faut des variables pour le cube.
// Mais je crois que tu veux ZQSD = Déplacer le joueur.
// Je vais faire : ZQSD = Déplacer Joueur, Flèches = Tourner Tête.
// Le cube reste FIXE (c'est un décor).

let cubeRotationX = 0; // Si tu veux quand même pouvoir tourner le cube avec d'autres touches
let cubeRotationY = 0;


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

    // II. Géométrie (Cube)
    const vertices = new Float32Array([
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
    ]);

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
        const moveSpeed = 0.2;
        const turnSpeed = 0.05;

        // 1. FLÈCHES = ORIENTATION (Tourner la tête)
        switch (event.key) {
            case "ArrowLeft":  camYaw -= turnSpeed; break;   // Tourner la tête à gauche
            case "ArrowRight": camYaw += turnSpeed; break;   // Tourner la tête à droite
            case "ArrowUp":    camPitch -= turnSpeed; break; // Lever la tête
            case "ArrowDown":  camPitch += turnSpeed; break; // Baisser la tête
        }

        // 2. ZQSD = DÉPLACEMENT (Bouger le corps relativement à où on regarde)
        // On calcule la direction "Devant" et "Droite" grâce à la trigonométrie
        
        // Vecteur "Devant" (Forward) sur le plan XZ (on ne vole pas ici)
        const forwardX = Math.sin(camYaw);
        const forwardZ = Math.cos(camYaw);
        
        // Vecteur "Droite" (Right) (perpendiculaire au vecteur devant)
        const rightX = Math.sin(camYaw + Math.PI / 2);
        const rightZ = Math.cos(camYaw + Math.PI / 2);

        switch (event.key.toLowerCase()) {
            case "z": // Avancer
                camX -= forwardX * moveSpeed;
                camZ -= forwardZ * moveSpeed;
                break;
            case "s": // Reculer
                camX += forwardX * moveSpeed;
                camZ += forwardZ * moveSpeed;
                break;
            case "q": // Gauche (Strafe)
                camX -= rightX * moveSpeed;
                camZ -= rightZ * moveSpeed;
                break;
            case "d": // Droite (Strafe)
                camX += rightX * moveSpeed;
                camZ += rightZ * moveSpeed;
                break;
        }
    });

    // V. Rendu
    function frame() {
        const modelMatrix = glMatrix.mat4.create(); // Le cube est fixe dans le monde
        const viewMatrix = glMatrix.mat4.create();
        const projectionMatrix = glMatrix.mat4.create();
        const mvpMatrix = glMatrix.mat4.create();

        // --- CALCUL DE LA VUE (FPS) ---
        // 1. Calculer le point cible (Target) : Position + Direction du regard
        // La direction du regard dépend du Pitch (haut/bas) et Yaw (gauche/droite)
        const targetX = camX - Math.sin(camYaw) * Math.cos(camPitch);
        const targetY = camY + Math.sin(camPitch); // On ajoute le Y pour regarder haut/bas
        const targetZ = camZ - Math.cos(camYaw) * Math.cos(camPitch);

        // 2. Créer la matrice de vue
        // Oeil : (camX, camY, camZ) -> Cible : (targetX, targetY, targetZ)
        glMatrix.mat4.lookAt(viewMatrix, [camX, camY, camZ], [targetX, targetY, targetZ], [0, 1, 0]);

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
        renderPass.draw(36); // Juste le cube
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }
    frame();
}

main();