

// I. INitialisation
async function main() {
    // Verifier si le navigateur peut supporter WebGPU
    if (!navigator.gpu) {
        console.error("WebGPU is not supported on this browser.");
        return;
    }
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




