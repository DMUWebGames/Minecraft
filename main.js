
// varibales globales pour la caméra
let camRotationX = 0;
let camRotationY = 0;


// I. Initialisation
async function main() {
    // Verifier si le navigateur peut supporter WebGPU
    if (!navigator.gpu) {
        console.error("WebGPU is not supported on this browser.");
        return;
    }

    // Demander un adaptateur GPU
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("Failed to get GPU adapter.");
        return;
    }
    const device = await adapter.requestDevice();

    // Créer un canvas pour le rendu
    const canvas = document.getElementById('webgpu-canvas');
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device: device,
        format: format,
    });

    //II Le Cube 3D
        // Un cube a 6 faces. Pour WebGPU, on définit des triangles.
        // On va simplifier : on définit les sommets (vertices) et leurs couleurs.

    const vertices = new Float32Array([
        // Face avant (Z = 1)
        -1, -1,  1, 1, 0, 0, // rouge
        1, -1,  1, 1, 0, 0,
        1,  1,  1, 1, 0, 0,
        -1, -1,  1, 1, 0, 0,
        1,  1,  1, 1, 0, 0,
        -1,  1,  1, 1, 0, 0,

        // Face arrière (Z = -1)
        -1, -1, -1,   0, 0, 1, // bleu
        -1,  1, -1,   0, 0, 1,
        1,  1, -1,   0, 0, 1,
        -1, -1, -1,   0, 0, 1,
        1,  1, -1,   0, 0, 1,
        1, -1, -1,   0, 0, 1,

        // Face supérieure (Y = 1)
        -1,  1, -1,   0, 1, 0, // vert
        -1,  1,  1,   0, 1, 0,
        1,  1,  1,   0, 1, 0,
        -1,  1, -1,   0, 1, 0,
        1,  1,  1,   0, 1, 0,
        1,  1, -1,   0, 1, 0,

        // Face inférieure (Y = -1)
        -1, -1, -1,   1, 1, 0, // jaune
        1, -1, -1,   1, 1, 0,
        1, -1,  1,   1, 1, 0,
        -1, -1, -1,   1, 1, 0,
        1, -1,  1,   1, 1, 0,
        -1, -1,  1,   1, 1, 0,

        // Face gauche (X = -1)
        -1, -1, -1,   1, 0, 1, //magenta
        -1, -1,  1,   1, 0, 1,
        -1,  1,  1,   1, 0, 1,
        -1, -1, -1,   1, 0, 1,
        -1,  1,  1,   1, 0, 1,
        -1,  1, -1,   1, 0, 1,

        // Face droite (X = 1)
        1, -1, -1,   0, 1, 1, // cyan
        1,  1, -1,   0, 1, 1,
        1,  1,  1,   0, 1, 1,
        1, -1, -1,   0, 1, 1,
        1,  1,  1,   0, 1, 1,
        1, -1,  1,   0, 1, 1,
    ]);

    // Créer un buffer GPU pour les sommets
    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
        arrayStride: 24, // 6 floats per vertex, 4 bytes each
        attributes: [
            { // position
                shaderLocation: 0,
                offset: 0,
                format: "float32x3"
            },
            { // color
                shaderLocation: 1,
                offset: 3 * 4, // position (3 floats) + color (3 floats)
                format: "float32x3"
            }
        ]
    };

    // III. Shaders
    const shaderCode = `
        struct Uniforms {
            mvpMatrix: mat4x4<f32>,
        };
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
    // C'est la "recette" pour dessiner : quels shaders, quel format de vertex, etc.
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: 'vertexMain',
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fragmentMain',
            targets: [
                {
                    format: format,
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'back',
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    });

    // Création de la texture de profondeur (pour gérer quel cube est devant l'autre)
    const depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // V. UNIFORMS 
    // Création du buffer pour la matrice (4x4 floats = 64 octets)
    const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    
    // On écoute les flèches du clavier
    window.addEventListener("keydown", (event) => {
        const speed = 0.05; // Vitesse de rotation de la caméra
        switch (event.key) {
            case "ArrowLeft": camRotationY -= speed; break;
            case "ArrowRight": camRotationY += speed; break;
            case "ArrowUp": camRotationX -= speed; break; // Regarder en haut/bas
            case "ArrowDown": camRotationX += speed; break;
        }
    });

    // VI. Rendu
    function frame() {
        const time = Date.now() / 1000;

        // --- 1. CALCUL MATRICIEL PROPRE (avec gl-matrix) ---
        // On crée les matrices nécessaires
        const modelMatrix = glMatrix.mat4.create();
        const viewMatrix = glMatrix.mat4.create();
        const projectionMatrix = glMatrix.mat4.create();
        const mvpMatrix = glMatrix.mat4.create();

        // A. Modèle : Faire tourner le cube
        glMatrix.mat4.rotateY(modelMatrix, modelMatrix, camRotationY);
        glMatrix.mat4.rotateX(modelMatrix, modelMatrix, camRotationX);

        // B. Vue : Reculer la caméra pour voir le cube (Z = -5)
        glMatrix.mat4.translate(viewMatrix, viewMatrix, [0, 0, -5]);

        // C. Projection : Définir l'objectif (Perspective)
        const aspect = canvas.width / canvas.height;
        glMatrix.mat4.perspective(projectionMatrix, 1.0, aspect, 0.1, 100.0);

        // D. Multiplier tout : MVP = Projection * Vue * Modèle
        glMatrix.mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
        glMatrix.mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

        // Envoyer la matrice finale au GPU
        device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix);

        // --- 2. COMMANDES DE DESSIN ---
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
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
        renderPass.draw(36);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }
    
    frame();
}

main();