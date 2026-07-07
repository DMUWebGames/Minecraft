// js/otherPlayer.js

export class OtherPlayer {
    constructor(device) {
        this.pos = { x: 0, y: 5, z: 5 };
        
        // Un "Billboard" c'est juste un carré plat (2 triangles = 6 sommets)
        // Pour l'instant les UV pointent vers la case 0,0 de ton atlas (on changera ça après)
        const vertices = new Float32Array([
            // Face avant (Normale Y+ pour être éclairé comme le sol)
            0,0,0, 0,0, 0,1,0,   1,0,0, 0.25,0, 0,1,0,   1,1,0, 0.25,0.25, 0,1,0,
            0,0,0, 0,0, 0,1,0,   1,1,0, 0.25,0.25, 0,1,0,  0,1,0, 0,0.25, 0,1,0,
            // Face arrière
            0,0,0, 0.25,0, 0,1,0,  1,0,0, 0,0, 0,1,0,  1,1,0, 0,0.25, 0,1,0,
            0,0,0, 0.25,0, 0,1,0,  1,1,0, 0,0.25, 0,1,0,  0,1,0, 0.25,0.25, 0,1,0,
        ]);

        this.buffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.buffer, 0, vertices);
    }

    // Met à jour la position reçue du réseau
    updatePosition(x, y, z) {
        this.pos.x = x;
        this.pos.y = y;
        this.pos.z = z;
    }

    // La magie du Billboard : calculer la matrice pour qu'il nous fasse toujours face
    getMatrix(viewMatrix, projectionMatrix) {
        // 1. Créer la matrice de position du joueur (où il est dans le monde)
        const modelMatrix = glMatrix.mat4.create();
        glMatrix.mat4.translate(modelMatrix, modelMatrix, [this.zpos.x, this.pos.y, this.pos.z]);
        // On l'agrandit un peu (hauteur de 2 blocs)
        glMatrix.mat4.scale(modelMatrix, modelMatrix, [1.0, 2.0, 1.0]);

        // 2. Magie de la caméra : on prend la matrice de VUE, on lui vole sa rotation, 
        // et on la combine avec notre position. Le résultat : le panneau regarde la caméra !
        const billboardMatrix = glMatrix.mat4.create();
        // Copie les 3 premières colonnes de la vue (la rotation de la caméra)
        billboardMatrix[0] = viewMatrix[0];
        billboardMatrix[1] = viewMatrix[4];
        billboardMatrix[2] = viewMatrix[8];
        billboardMatrix[4] = viewMatrix[1];
        billboardMatrix[5] = viewMatrix[5];
        billboardMatrix[6] = viewMatrix[9];
        billboardMatrix[8] = viewMatrix[2];
        billboardMatrix[9] = viewMatrix[6];
        billboardMatrix[10] = viewMatrix[10];

        // 3. Multiplier tout pour avoir le résultat final
        const mvp = glMatrix.mat4.create();
        glMatrix.mat4.multiply(mvp, projectionMatrix, billboardMatrix);
        glMatrix.mat4.multiply(mvp, mvp, modelMatrix);

        return mvp;
    }
}