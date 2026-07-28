// js/otherPlayer.js

export class OtherPlayer {
    constructor(device) {
        this.pos = { x: 0, y: 0, z: 0 };
        
        // Un vrai cube fait 6 faces. 6 faces * 2 triangles * 3 sommets = 36 sommets.
        // UV pointant vers la case 3,0 de l'atlas (le bois)
        const vertices = new Float32Array([
            // Face Avant (Z+)
            -0.5, 0.0,  0.5,  0.75, 0.25,  0.0,  0.0,  1.0,
             0.5, 0.0,  0.5,  1.00, 0.25,  0.0,  0.0,  1.0,
             0.5, 2.0,  0.5,  1.00, 0.00,  0.0,  0.0,  1.0,
            -0.5, 0.0,  0.5,  0.75, 0.25,  0.0,  0.0,  1.0,
             0.5, 2.0,  0.5,  1.00, 0.00,  0.0,  0.0,  1.0,
            -0.5, 2.0,  0.5,  0.75, 0.00,  0.0,  0.0,  1.0,

            // Face Arrière (Z-)
             0.5, 0.0, -0.5,  0.75, 0.25,  0.0,  0.0, -1.0,
            -0.5, 0.0, -0.5,  1.00, 0.25,  0.0,  0.0, -1.0,
            -0.5, 2.0, -0.5,  1.00, 0.00,  0.0,  0.0, -1.0,
             0.5, 0.0, -0.5,  0.75, 0.25,  0.0,  0.0, -1.0,
            -0.5, 2.0, -0.5,  1.00, 0.00,  0.0,  0.0, -1.0,
             0.5, 2.0, -0.5,  0.75, 0.00,  0.0,  0.0, -1.0,

            // Face Dessus (Y+)
            -0.5, 2.0,  0.5,  0.75, 0.25,  0.0,  1.0,  0.0,
             0.5, 2.0,  0.5,  1.00, 0.25,  0.0,  1.0,  0.0,
             0.5, 2.0, -0.5,  1.00, 0.00,  0.0,  1.0,  0.0,
            -0.5, 2.0,  0.5,  0.75, 0.25,  0.0,  1.0,  0.0,
             0.5, 2.0, -0.5,  1.00, 0.00,  0.0,  1.0,  0.0,
            -0.5, 2.0, -0.5,  0.75, 0.00,  0.0,  1.0,  0.0,

            // Face Dessous (Y-)
            -0.5, 0.0, -0.5,  0.75, 0.25,  0.0, -1.0,  0.0,
             0.5, 0.0, -0.5,  1.00, 0.25,  0.0, -1.0,  0.0,
             0.5, 0.0,  0.5,  1.00, 0.00,  0.0, -1.0,  0.0,
            -0.5, 0.0, -0.5,  0.75, 0.25,  0.0, -1.0,  0.0,
             0.5, 0.0,  0.5,  1.00, 0.00,  0.0, -1.0,  0.0,
            -0.5, 0.0,  0.5,  0.75, 0.00,  0.0, -1.0,  0.0,

            // Face Droite (X+)
             0.5, 0.0,  0.5,  0.75, 0.25,  1.0,  0.0,  0.0,
             0.5, 0.0, -0.5,  1.00, 0.25,  1.0,  0.0,  0.0,
             0.5, 2.0, -0.5,  1.00, 0.00,  1.0,  0.0,  0.0,
             0.5, 0.0,  0.5,  0.75, 0.25,  1.0,  0.0,  0.0,
             0.5, 2.0, -0.5,  1.00, 0.00,  1.0,  0.0,  0.0,
             0.5, 2.0,  0.5,  0.75, 0.00,  1.0,  0.0,  0.0,

            // Face Gauche (X-)
            -0.5, 0.0, -0.5,  0.75, 0.25, -1.0,  0.0,  0.0,
            -0.5, 0.0,  0.5,  1.00, 0.25, -1.0,  0.0,  0.0,
            -0.5, 2.0,  0.5,  1.00, 0.00, -1.0,  0.0,  0.0,
            -0.5, 0.0, -0.5,  0.75, 0.25, -1.0,  0.0,  0.0,
            -0.5, 2.0,  0.5,  1.00, 0.00, -1.0,  0.0,  0.0,
            -0.5, 2.0, -0.5,  0.75, 0.00, -1.0,  0.0,  0.0,
        ]);

        this.buffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(this.buffer, 0, vertices);
    }

    updatePosition(x, y, z) {
        this.pos.x = x;
        this.pos.y = y;
        this.pos.z = z;
    }

    // Plus de Billboard ! Juste une translation normale
    getMatrix(viewMatrix, projectionMatrix) {
        const modelMatrix = glMatrix.mat4.create();
        // On décale de 0.5 en X et Z pour centrer le bloc sur les pieds du joueur
        glMatrix.mat4.translate(modelMatrix, modelMatrix, [
            this.pos.x + 0.5, 
            this.pos.y, 
            this.pos.z + 0.5
        ]);

        const mvp = glMatrix.mat4.create();
        glMatrix.mat4.multiply(mvp, projectionMatrix, viewMatrix);
        glMatrix.mat4.multiply(mvp, mvp, modelMatrix);

        return mvp;
    }
}