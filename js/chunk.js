// js/chunk.js
import { BLOCK } from './blocks.js'; // On importe les définitions

// Le "moule" géométrique du cube (Juste les positions relatives, les UV)
//FORMAT XYZ UV
// FORMAT : XYZ UV NX NY NZ  (8 floats par vertex)
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

// On imagine que notre image est une grille de 4x4
// Ligne 0 (v=0.75) : Herbe, Terre, Pierre, Bois --- Ligne 1 (v=0.5) : Lampe, Verre, Eau, (vide)
    
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
    }
    // 1.0 - (v+1)*0.25 pour inverser l'axe Y
    return { u: u * 0.25, v: 1.0 - (v + 1) * 0.25 };
}

export class Chunk {
    constructor(chunkX=0, chunkZ=0) {   
        this.chunkX = chunkX; // ← NOUVEAU : position de ce chunk dans le monde
        this.chunkZ = chunkZ;   // ← NOUVEAU
        this.size = 16;

        // Stockage Voxel : Clé "x,y,z" -> Valeur ID Bloc
        this.blocks = new Map();
    }

    // Définir un bloc dans la grille
    setBlock(x, y, z, blockId) {
        const key = `${x},${y},${z}`;
        if (blockId === BLOCK.AIR) {
            this.blocks.delete(key); // On retire si c'est de l'air
        } else {
            this.blocks.set(key, blockId);
        }
    }

    // Récupérer un bloc (utile pour plus tard)
    getBlock(x, y, z) {
        return this.blocks.get(`${x},${y},${z}`) || BLOCK.AIR;
    }

    generateHouse(startX, startY, startZ) {
        const w = 10;  // largeur
        const h = 6;  // hauteur
        const d = 10 ;  // LONGUEUR

        for (let x = startX; x < startX + w; x++) {
            for (let z = startZ; z < startZ + d; z++) {
                for (let y = startY; y < startY + h; y++) {

                    const isWall =
                        x === startX || x === startX + w - 1 ||
                        z === startZ || z === startZ + d - 1;
                    const isRoof = y === startY + h - 1;
                    const isFloor = y === startY;

                    if (isFloor) {
                        this.setBlock(x, y, z, BLOCK.STONE);
                    } else if (isRoof) {
                        this.setBlock(x, y, z, BLOCK.WOOD);
                    } else if (isWall) {
                        this.setBlock(x, y, z, BLOCK.DIRT); // murs
                    }
                    // L'intérieur reste vide (AIR)
                }
            }
        }

        // Porte (trou dans le mur avant)
        this.setBlock(startX + 3, startY + 1, startZ, BLOCK.AIR);
        this.setBlock(startX + 3, startY + 2, startZ, BLOCK.AIR);

        // Fenêtres (trous dans les murs)
        this.setBlock(startX + 1, startY + 2, startZ, BLOCK.AIR);
        this.setBlock(startX + 5, startY + 2, startZ, BLOCK.AIR);
    }

    // Générer un sol avec des types de blocs
    generateFloor(sizeX, sizeZ) {
        // Sol simple
        for (let x = -sizeX; x < sizeX; x++) {
            for (let z = -sizeZ; z < sizeZ; z++) {
    
                this.setBlock(x, -1, z, BLOCK.GRASS);
                this.setBlock(x, -2, z, BLOCK.DIRT);
                this.setBlock(x, -3, z, BLOCK.STONE);
                this.setBlock(x, -4, z, BLOCK.WOOD);
                this.setBlock(x, -5, z, BLOCK.GRASS);
                this.setBlock(x, -6, z, BLOCK.WOOD);
                this.setBlock(x, -7, z, BLOCK.DIRT);
                this.setBlock(x, -8, z, BLOCK.STONE);
                this.setBlock(x, -9, z, BLOCK.DIRT);
                this.setBlock(x, -10, z, BLOCK.STONE);
            }
        }
        
        // --- BLOCS DE TEST ---
        // Joueur spawn à Z=5. Blocs à Z=3 = Devant le joueur.
        // Y=0, 1, 2 = A hauteur des yeux.
        this.setBlock(0, 0, 3, BLOCK.STONE);
        this.setBlock(0, 1, 3, BLOCK.STONE);
        this.setBlock(0, 2, 3, BLOCK.STONE);
        
        this.setBlock(2, 0, 3, BLOCK.WOOD);
        this.setBlock(2, 1, 3, BLOCK.WOOD);
        this.setBlock(2, 2, 3, BLOCK.WOOD);

        this.generateHouse(10, 0, 10);
    }

    getLightSources(){
        const lights = [];
        for (const [key, blockId] of this.blocks) {
            if (blockId === BLOCK.LAMP) {
                const [x, y, z] = key.split(',').map(Number);
                lights.push({ x : x + 0.5, y : y + 0.5, z : z + 0.5 });
            }
        }
        return lights;
    }

    // Construire le Mesh (Convertir les données Voxel en Vertices pour la GPU)
    buildMesh() {
        const floatsPerVertex = 8; // 3 pour position + 2 pour UV + 3 pour normale
        const verticesPerCube = 36;
        
        // Taille dynamique basée sur le nombre de blocs non vides
        const totalSize = this.blocks.size * verticesPerCube * floatsPerVertex;
        const mesh = new Float32Array(totalSize);

        let i = 0; // Index dans le tableau final

        // On parcourt tous les blocs stockés
        for (const [key, blockId] of this.blocks) {
            const [x, y, z] = key.split(',').map(Number); // Récupère les coordonnées
            
            //const color = getBlockColor(blockId); // Récupère la couleur RGB
            const uvOffset = getBlockUV(blockId); // Récupère le décalage UV pour ce type de bloc

            // On génère les 36 sommets pour ce bloc
            for (let v = 0; v < verticesPerCube; v++) {
                const idxMesh = (i * verticesPerCube + v) * floatsPerVertex;
                const idxBase = v * floatsPerVertex;

                // POSITION
                //mesh[idxMesh + 0] = baseCubeVertices[idxBase + 0] + x;
                mesh[idxMesh + 0] = baseCubeVertices[idxBase + 0] + x + this.chunkX * this.size;
                mesh[idxMesh + 1] = baseCubeVertices[idxBase + 1] + y;
                //mesh[idxMesh + 2] = baseCubeVertices[idxBase + 2] + z;
                mesh[idxMesh + 2] = baseCubeVertices[idxBase + 2] + z + this.chunkZ * this.size;

                // UV — adapter au nouvel atlas 4x4 (chaque case = 1/4 = 0.25)
                mesh[idxMesh + 3] = baseCubeVertices[idxBase + 3] * 0.25 + uvOffset.u;
                mesh[idxMesh + 4] = (1 - baseCubeVertices[idxBase + 4]) * 0.25 + uvOffset.v;

                //Normale
                mesh[idxMesh + 5] = baseCubeVertices[idxBase + 5];
                mesh[idxMesh + 6] = baseCubeVertices[idxBase + 6];
                mesh[idxMesh + 7] = baseCubeVertices[idxBase + 7];
            }
            i++;
    
        }
        return mesh;
    }
}