// js/textureAtlas.js
import { loadAllTextures } from 'https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/js/textures.js';

export async function createTextureAtlas(device) {
    const textureSize = 128;
    const cellSize = 32;

    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const ctx = textureCanvas.getContext('2d');

    const textures = await loadAllTextures();

    // Ligne du haut
    ctx.fillStyle = '#3a9d23'; ctx.fillRect(0, 0, cellSize, cellSize);
    ctx.drawImage(textures.dirt, cellSize, 0, cellSize, cellSize);
    ctx.drawImage(textures.stone, 2*cellSize, 0, cellSize, cellSize);
    ctx.drawImage(textures.wood, 3*cellSize, 0, cellSize, cellSize);

    // Ligne suivante
    ctx.fillStyle = '#FFD700'; ctx.fillRect(0, cellSize, cellSize, cellSize);
    ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
    ctx.fillRect(cellSize, cellSize, cellSize, cellSize);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2;
    ctx.strokeRect(cellSize + 2, cellSize + 2, cellSize - 4, cellSize - 4);

    ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
    ctx.fillRect(2*cellSize, cellSize, cellSize, cellSize);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(2*cellSize + 5, cellSize + 5, 4, 4);
    ctx.fillRect(2*cellSize + 20, cellSize + 15, 3, 3);

    ctx.fillStyle = '#1f5611';
    ctx.fillRect (3*cellSize, cellSize, cellSize, cellSize);
    ctx.fillStyle = 'rgba(80, 180, 60, 0.5)';
    for (let i = 0; i < 15; i++) {
        ctx.fillRect(3*cellSize + Math.random()*28, cellSize + Math.random()*28, 3, 3);
    }
    
    for(let k=0; k<500; k++) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(Math.random()*textureSize, Math.random()*textureSize, 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(Math.random()*textureSize, Math.random()*textureSize, 2, 2);
    }

    // Création des objets WebGPU
    const texture = device.createTexture({
        size: [textureSize, textureSize],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    const imageBitmap = await createImageBitmap(textureCanvas);
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [textureSize, textureSize]
    );

    const sampler = device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
    });

    // On renvoie les deux objets dont main.js a besoin
    return { texture, sampler };
}