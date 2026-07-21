// js/skin.js

export async function createPlayerTexture(device) {
    // 1. On crée un canvas caché pour dessiner le personnage
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128; // Tête (64) + Corps (~64)
    const ctx = canvas.getContext('2d');

    // 2. On charge les images
    const headImg = new Image();
    const bodyImg = new Image();
    
    await Promise.all([
        new Promise(r => { headImg.onload = r; headImg.src = 'textures/male_head.png'; }),
        new Promise(r => { bodyImg.onload = r; bodyImg.src = 'textures/male_body.png'; })
    ]);

    // 3. On assemble le personnage
    ctx.drawImage(headImg, 0, 0); // Tête en haut
    
    // Corps en dessous (centré car il fait 44px de large sur 64px)
    const bodyX = (64 - 44) / 2; 
    ctx.drawImage(bodyImg, bodyX, 64);

    // 4. On transforme le canvas en Texture WebGPU
    const texture = device.createTexture({
        size: [64, 128],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUBufferUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    const imageBitmap = await createImageBitmap(canvas);
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [64, 128]
    );
    
    return texture;
}