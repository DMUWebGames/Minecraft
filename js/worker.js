//js/worker.js

// On copie les blocks dont on a besoin
const BLOCK = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LAMP: 5, GLASS: 6, WATER: 7, TREES: 8
};


// On copie le moule du cube
const baseCubeVertices = new Float32Array([
    // Face avant (Z+1) — normale (0, 0, 1)
    0,0,1, 0,1, 0,0,1,  1,0,1, 1,1, 0,0,1,  1,1,1, 1,0, 0,0,1,
    0,0,1, 0,1, 0,0,1,  1,1,1, 1,0, 0,0,1,  0,1,1, 0,0, 0,0,1,
    // Face arrière (Z0) — normale (0, 0, -1)
    1,0,0, 0,1, 0,0,-1,  0,0,0, 1,1, 0,0,-1,  0,1,0, 1,0, 0,0,-1,
    1,0,0, 0,1, 0,0,-1,  0,1,0, 1,0, 0,0,-1,  1,1,0, 0,0, 0,0,-1,
    // Face supérieure (Y+1) — normale (0, 1, 0)
    0,1,0, 0,1, 0,1,0,  0,1,1, 1,1, 0,1,0,  1,1,1, 1,0, 0,1,0,
    0,1,0, 0,1, 0,1,0,  1,1,1, 1,0, 0,1,0,  1,1,0, 0,0, 0,1,0,
    // Face inférieure (Y0) — normale (0, -1, 0)
    0,0,1, 0,1, 0,-1,0,  1,0,1, 1,1, 0,-1,0,  1,0,0, 1,0, 0,-1,0,
    0,0,1, 0,1, 0,-1,0,  1,0,0, 1,0, 0,-1,0,  0,0,0, 0,0, 0,-1,0,
    // Face droite (X+1) — normale (1, 0, 0)
    1,0,1, 0,1, 1,0,0,  1,0,0, 1,1, 1,0,0,  1,1,0, 1,0, 1,0,0,
    1,0,1, 0,1, 1,0,0,  1,1,0, 1,0, 1,0,0,  1,1,1, 0,0, 1,0,0,
    // Face gauche (X0) — normale (-1, 0, 0)
    0,0,0, 0,1, -1,0,0,  0,0,1, 1,1, -1,0,0,  0,1,1, 1,0, -1,0,0,
    0,0,0, 0,1, -1,0,0,  0,1,1, 1,0, -1,0,0,  0,1,0, 0,0, -1,0,0,
]);

// On copie la fonction UV
function getBlockUV(blockId) {
    let u = 0, v = 0;
    if (blockId === BLOCK.GRASS) {
        u = 0; v = 3;  
    } else if (blockId === BLOCK.DIRT) {
        u = 1; v = 3;  
    } else if (blockId === BLOCK.STONE) {
        u = 2; v = 3;  
    } else if (blockId === BLOCK.WOOD) {
        u = 3; v = 3;  
    } else if (blockId === BLOCK.LAMP) {
        u = 0; v = 2;  
    } else if (blockId === BLOCK.GLASS){
        u = 1; v = 2;
    } else if (blockId === BLOCK.WATER) { 
        u = 2; v = 2; 
    } else if (blockId ===BLOCK.TREES){
        u = 3; v = 2;
    }
    // 1.0 - (v+1)*0.25 pour inverser l'axe Y
    return { u: u * 0.25, v: 1.0 - (v + 1) * 0.25 };
}

// La fonction principale qui tourne quand le main.js lui donne du travail
self.onmessage = function(event) {
    const chunksData = event.data.chunks;
    const requestId = event.data.requestId;
    
    const floatsPerVertex = 8;
    const verticesPerCube = 36;
    
    // On calcule la taille totale nécessaire
    let totalSize = 0;
    for (let c = 0; c < chunksData.length; c++) {
        const chunk = chunksData[c];
        totalSize += (chunk.blocks.length / 4) * verticesPerCube * floatsPerVertex; // divisé par 4 car on envoie x,y,z,id
    }

    const finalMesh = new Float32Array(totalSize);
    let globalOffset = 0;

    // On construit la géométrie
    for (let c = 0; c < chunksData.length; c++) {
        const chunk = chunksData[c];
        const blockCount = chunk.blocks.length / 4;

        for (let i = 0; i < blockCount; i++) {
            const x = chunk.blocks[i * 4];
            const y = chunk.blocks[i * 4 + 1];
            const z = chunk.blocks[i * 4 + 2];
            const blockId = chunk.blocks[i * 4 + 3];
            
            const uvOffset = getBlockUV(blockId);

            for (let v = 0; v < verticesPerCube; v++) {
                const idxMesh = globalOffset + (v * floatsPerVertex);
                const idxBase = v * floatsPerVertex;

                finalMesh[idxMesh + 0] = baseCubeVertices[idxBase + 0] + x + chunk.cx * chunk.size;
                finalMesh[idxMesh + 1] = baseCubeVertices[idxBase + 1] + y;
                finalMesh[idxMesh + 2] = baseCubeVertices[idxBase + 2] + z + chunk.cz * chunk.size;

                finalMesh[idxMesh + 3] = baseCubeVertices[idxBase + 3] * 0.25 + uvOffset.u;
                finalMesh[idxMesh + 4] = (1 - baseCubeVertices[idxBase + 4]) * 0.25 + uvOffset.v;

                finalMesh[idxMesh + 5] = baseCubeVertices[idxBase + 5];
                finalMesh[idxMesh + 6] = baseCubeVertices[idxBase + 6];
                finalMesh[idxMesh + 7] = baseCubeVertices[idxBase + 7];
            }
            globalOffset += verticesPerCube * floatsPerVertex;
        }
    }
    // On renvoie le tableau en transférant sa propriété (0 copie mémoire !)
    self.postMessage({ mesh: finalMesh, requestId: requestId }, [finalMesh.buffer]);
};