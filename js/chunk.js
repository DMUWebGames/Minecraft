// js/chunk.js

// C'est le "moule" de base d'un cube centré en (0,0,0)
// On le stocke ici pour que le Chunk puisse l'utiliser
const baseCubeVertices = new Float32Array([
    // Face avant (Rouge)
    -1, -1,  1, 1, 0, 0,  1, -1,  1, 1, 0, 0,  1,  1,  1, 1, 0, 0, -1, -1,  1, 1, 0, 0,  1,  1,  1, 1, 0, 0, -1,  1,  1, 1, 0, 0,
    // Face arrière (Bleu)
    -1, -1, -1, 0, 0, 1, -1,  1, -1, 0, 0, 1,  1,  1, -1, 0, 0, 1, -1, -1, -1, 0, 0, 1,  1,  1, -1, 0, 0, 1,  1, -1, -1, 0, 0, 1,
    // Face supérieure (Vert)
    -1,  1, -1, 0, 1, 0, -1,  1,  1, 0, 1, 0,  1,  1,  1, 0, 1, 0, -1,  1, -1, 0, 1, 0,  1,  1,  1, 0, 1, 0,  1,  1, -1, 0, 1, 0,
    // Face inférieure (Jaune)
    -1, -1, -1, 1, 1, 0,  1, -1, -1, 1, 1, 0,  1, -1,  1, 1, 1, 0, -1, -1, -1, 1, 1, 0,  1, -1,  1, 1, 1, 0, -1, -1,  1, 1, 1, 0,
    // Face droite (Cyan)
     1, -1, -1, 0, 1, 1,  1,  1, -1, 0, 1, 1,  1,  1,  1, 0, 1, 1,  1, -1, -1, 0, 1, 1,  1,  1,  1, 0, 1, 1,  1, -1,  1, 0, 1, 1,
    // Face gauche (Magenta)
    -1, -1, -1, 1, 0, 1, -1, -1,  1, 1, 0, 1, -1,  1,  1, 1, 0, 1, -1, -1, -1, 1, 0, 1, -1,  1,  1, 1, 0, 1, -1,  1, -1, 1, 0, 1,
]);

export class Chunk {
    constructor() {
        this.cubes = []; // Liste des positions {x, y, z}
    }

    // Ajouter un cube aux coordonnées monde (x, y, z)
    addCube(x, y, z) {
        this.cubes.push({ x, y, z });
    }

    // Générer un sol de taille X par Z
    generateFloor(sizeX, sizeZ) {
        for (let x = -sizeX; x < sizeX; x++) {
            for (let z = -sizeZ; z < sizeZ; z++) {
                // On met le sol un peu plus bas (y = -1.5)
                this.addCube(x, -1.5, z);
            }
        }
    }

    // Construire le grand tableau de vertices (Mesh) à envoyer à la GPU
    buildMesh() {
        const floatsPerVertex = 6;
        const verticesPerCube = 36;
        
        // Taille totale du tableau
        const totalSize = this.cubes.length * verticesPerCube * floatsPerVertex;
        const mesh = new Float32Array(totalSize);

        // Pour chaque cube dans la liste
        for (let i = 0; i < this.cubes.length; i++) {
            const cube = this.cubes[i];
            
            // On copie le modèle de base et on applique la translation
            for (let v = 0; v < verticesPerCube; v++) {
                const idxMesh = (i * verticesPerCube + v) * floatsPerVertex;
                const idxBase = v * floatsPerVertex;

                // Position = Position de base + Position du cube
                mesh[idxMesh + 0] = baseCubeVertices[idxBase + 0] + cube.x;
                mesh[idxMesh + 1] = baseCubeVertices[idxBase + 1] + cube.y;
                mesh[idxMesh + 2] = baseCubeVertices[idxBase + 2] + cube.z;

                // Couleur = On reprend la même
                mesh[idxMesh + 3] = baseCubeVertices[idxBase + 3];
                mesh[idxMesh + 4] = baseCubeVertices[idxBase + 4];
                mesh[idxMesh + 5] = baseCubeVertices[idxBase + 5];
            }
        }
        return mesh;
    }
}