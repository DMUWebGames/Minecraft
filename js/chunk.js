// js/chunk.js
import { getBlockColor, BLOCK } from './blocks.js'; // On importe les définitions

// Le "moule" géométrique du cube (Juste les positions relatives, les couleurs seront écrasées)
const baseCubeVertices = new Float32Array([
    // Face avant
    -1, -1,  1, 0,0,0,  1, -1,  1, 0,0,0,  1,  1,  1, 0,0,0, -1, -1,  1, 0,0,0,  1,  1,  1, 0,0,0, -1,  1,  1, 0,0,0,
    // Face arrière
    -1, -1, -1, 0,0,0, -1,  1, -1, 0,0,0,  1,  1, -1, 0,0,0, -1, -1, -1, 0,0,0,  1,  1, -1, 0,0,0,  1, -1, -1, 0,0,0,
    // Face supérieure
    -1,  1, -1, 0,0,0, -1,  1,  1, 0,0,0,  1,  1,  1, 0,0,0, -1,  1, -1, 0,0,0,  1,  1,  1, 0,0,0,  1,  1, -1, 0,0,0,
    // Face inférieure
    -1, -1, -1, 0,0,0,  1, -1, -1, 0,0,0,  1, -1,  1, 0,0,0, -1, -1, -1, 0,0,0,  1, -1,  1, 0,0,0, -1, -1,  1, 0,0,0,
    // Face droite
     1, -1, -1, 0,0,0,  1,  1, -1, 0,0,0,  1,  1,  1, 0,0,0,  1, -1, -1, 0,0,0,  1,  1,  1, 0,0,0,  1, -1,  1, 0,0,0,
    // Face gauche
    -1, -1, -1, 0,0,0, -1, -1,  1, 0,0,0, -1,  1,  1, 0,0,0, -1, -1, -1, 0,0,0, -1,  1,  1, 0,0,0, -1,  1, -1, 0,0,0,
]);

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
        for (let x = -sizeX; x < sizeX; x++) {
            for (let z = -sizeZ; z < sizeZ; z++) {
                // Couche supérieure : Herbe
                this.setBlock(x, -1, z, BLOCK.GRASS);
                // Couche inférieure : Terre
                this.setBlock(x, -2, z, BLOCK.DIRT);
            }
        }
        // Ajoutons quelques pierres pour le décor
        this.setBlock(0, 0, 0, BLOCK.STONE);
        this.setBlock(1, 0, 0, BLOCK.WOOD);
    }

    // Construire le Mesh (Convertir les données Voxel en Vertices pour la GPU)
    buildMesh() {
        const floatsPerVertex = 6;
        const verticesPerCube = 36;
        
        // Taille dynamique basée sur le nombre de blocs non vides
        const totalSize = this.blocks.size * verticesPerCube * floatsPerVertex;
        const mesh = new Float32Array(totalSize);

        let i = 0; // Index dans le tableau final

        // On parcourt tous les blocs stockés
        for (const [key, blockId] of this.blocks) {
            const [x, y, z] = key.split(',').map(Number); // Récupère les coordonnées
            const color = getBlockColor(blockId); // Récupère la couleur RGB

            // On génère les 36 sommets pour ce bloc
            for (let v = 0; v < verticesPerCube; v++) {
                const idxMesh = (i * verticesPerCube + v) * floatsPerVertex;
                const idxBase = v * floatsPerVertex;

                // POSITION
                mesh[idxMesh + 0] = baseCubeVertices[idxBase + 0] + x;
                mesh[idxMesh + 1] = baseCubeVertices[idxBase + 1] + y;
                mesh[idxMesh + 2] = baseCubeVertices[idxBase + 2] + z;

                // COULEUR (On écrase le 0,0,0 du modèle par la vraie couleur)
                mesh[idxMesh + 3] = color[0];
                mesh[idxMesh + 4] = color[1];
                mesh[idxMesh + 5] = color[2];
            }
            i++;
        }
        return mesh;
    }
}