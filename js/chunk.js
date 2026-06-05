// js/chunk.js
import { BLOCK } from './blocks.js'; // On importe les définitions

// Le "moule" géométrique du cube (Juste les positions relatives, les UV)
//FORMAT XYZ UV
const baseCubeVertices = new Float32Array([
    // Face avant (Z +1)
    0, 0, 1, 0, 1,  1, 0, 1, 1, 1,  1, 1, 1, 1, 0,  0, 0, 1, 0, 1,  1, 1, 1, 1, 0,  0, 1, 1, 0, 0,
    // Face arrière (Z 0)
    1, 0, 0, 0, 1,  0, 0, 0, 1, 1,  0, 1, 0, 1, 0,  1, 0, 0, 0, 1,  0, 1, 0, 1, 0,  1, 1, 0, 0, 0,
    // Face supérieure (Y +1)
    0, 1, 0, 0, 1,  0, 1, 1, 1, 1,  1, 1, 1, 1, 0,  0, 1, 0, 0, 1,  1, 1, 1, 1, 0,  1, 1, 0, 0, 0,
    // Face inférieure (Y 0)
    0, 0, 1, 0, 1,  1, 0, 1, 1, 1,  1, 0, 0, 1, 0,  0, 0, 1, 0, 1,  1, 0, 0, 1, 0,  0, 0, 0, 0, 0,
    // Face droite (X +1)
    1, 0, 1, 0, 1,  1, 0, 0, 1, 1,  1, 1, 0, 1, 0,  1, 0, 1, 0, 1,  1, 1, 0, 1, 0,  1, 1, 1, 0, 0,
    // Face gauche (X 0)
    0, 0, 0, 0, 1,  0, 0, 1, 1, 1,  0, 1, 1, 1, 0,  0, 0, 0, 0, 1,  0, 1, 1, 1, 0,  0, 1, 0, 0, 0,
]);

/*const baseCubeVertices = new Float32Array([
    // Face avant (Z +1)
    0, 0, 1, 0,0,0,  1, 0, 1, 0,0,0,  1, 1, 1, 0,0,0,  0, 0, 1, 0,0,0,  1, 1, 1, 0,0,0,  0, 1, 1, 0,0,0,
    // Face arrière (Z 0)
    1, 0, 0, 0,0,0,  0, 0, 0, 0,0,0,  0, 1, 0, 0,0,0,  1, 0, 0, 0,0,0,  0, 1, 0, 0,0,0,  1, 1, 0, 0,0,0,
    // Face supérieure (Y +1)
    0, 1, 1, 0,0,0,  1, 1, 1, 0,0,0,  1, 1, 0, 0,0,0,  0, 1, 1, 0,0,0,  1, 1, 0, 0,0,0,  0, 1, 0, 0,0,0,
    // Face inférieure (Y 0)
    0, 0, 0, 0,0,0,  1, 0, 0, 0,0,0,  1, 0, 1, 0,0,0,  0, 0, 0, 0,0,0,  1, 0, 1, 0,0,0,  0, 0, 1, 0,0,0,
    // Face droite (X +1)
    1, 0, 1, 0,0,0,  1, 0, 0, 0,0,0,  1, 1, 0, 0,0,0,  1, 0, 1, 0,0,0,  1, 1, 0, 0,0,0,  1, 1, 1, 0,0,0,
    // Face gauche (X 0)
    0, 0, 0, 0,0,0,  0, 0, 1, 0,0,0,  0, 1, 1, 0,0,0,  0, 0, 0, 0,0,0,  0, 1, 1, 0,0,0,  0, 1, 0, 0,0,0,
]);*/

// On imagine que notre image est une grille de 2x2
// (0,0) = Herbe, (1,0) = Terre, (0,1) = Pierre, (1,1) = Bois
function getBlockUV(blockId) {
    let u = 0, v = 0;
    if (blockId === BLOCK.GRASS) {
        u = 0; v = 1;  // était v=0, maintenant v=1
    } else if (blockId === BLOCK.DIRT) {
        u = 1; v = 1;  // était v=0, maintenant v=1
    } else if (blockId === BLOCK.STONE) {
        u = 0; v = 0;  // était v=1, maintenant v=0
    } else if (blockId === BLOCK.WOOD) {
        u = 1; v = 0;  // était v=1, maintenant v=0
    }
    return { u: u * 0.5, v: (1 - v) * 0.5 };
}

export class Chunk {
    constructor() {
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
    }

    // Construire le Mesh (Convertir les données Voxel en Vertices pour la GPU)
    buildMesh() {
        const floatsPerVertex = 5; // 3 pour position + 2 pour UV
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
                mesh[idxMesh + 0] = baseCubeVertices[idxBase + 0] + x;
                mesh[idxMesh + 1] = baseCubeVertices[idxBase + 1] + y;
                mesh[idxMesh + 2] = baseCubeVertices[idxBase + 2] + z;

                // UV
                mesh[idxMesh + 3] = baseCubeVertices[idxBase + 3] * 0.5 + uvOffset.u;
                // On inverse le V de base aussi : (1 - v) * 0.5 + offset
                mesh[idxMesh + 4] = (1 - baseCubeVertices[idxBase + 4]) * 0.5 + uvOffset.v;
            }
            i++;
    
        }
        return mesh;
    }
}