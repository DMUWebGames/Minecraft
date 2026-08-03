//js/textures


function loadImage(src){
    return new Promise((resolve, reject)=> {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    }); 
}

export async function loadAllTextures() {
    const [dirt, stone, wood, water] = await Promise.all([
        loadImage('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/textures/dirt.png'),
        loadImage('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/textures/stone.png'),
        loadImage('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/textures/wood.png'),
        loadImage('https://cdn.jsdelivr.net/gh/DMUWebGames/Minecraft@main/textures/water.png'),
    ]);
    return { dirt, stone, wood, water };
}
