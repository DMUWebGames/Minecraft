//js/textures


function loadImage(src){
    return new Promise((resolve, reject)=> {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    }); 
}

export async function loadAllTextures() {
    const [dirt, stone, wood, water] = await Promise.all([
        loadImage('../textures/dirt.png'),
        loadImage('../textures/stone.png'),
        loadImage('../textures/wood.png'),
        loadImage('../textures/water.png'),
    ]);
    return { dirt, stone, wood, water };
}
