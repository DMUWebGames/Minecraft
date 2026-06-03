//js/player.js
import { BLOCK } from './blocks.js';

export class Player {
    constructor() {
        this.x = 0;
        this.y = 5; // ON COMMENCE UN PEU EN HAUTEUR (COMME UN JOUEUR)
        this.z = 5;

        // Vitesse de déplacement
        this.speed = 5;
        this.velocityY = 0; // Pour la gravité et les sauts

        // Etat
        this.onGround = false; // Est-ce que le joueur touche le sol ?
        this.pitch = 0; // Haut/bas
        this.yaw = 0;   // Gauche/droite

        //constantes physiques
        this.GRAVITY = 25;
        this.JUMP_FORCE = 9;
        this.PLAYER_HEIGHT = 1.8; // Hauteur du joueur (pour collision)
    }

    update(dt, keys, world) {
        
        const cosPitch = Math.cos(this.pitch);
        const sinPitch = Math.sin(this.pitch);
        const cosYaw = Math.cos(this.yaw);
        const sinYaw = Math.sin(this.yaw);

        // Direction avant (en fonction de la rotation)
        // J'ignore le Y pour le mouvement horizontal, on gère la gravité à part
        const forwardX = -sinYaw ;
        const forwardZ = -cosYaw;

        // Vecteur droite
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        // Gestion des touches
        let dx=0;
        let dz=0;

        if (keys['z']) { // Avancer
            dx += forwardX; dz += forwardZ ;
        }
        if (keys['s']) { // Reculer
            dx -= forwardX; dz -= forwardZ;
        }
        if (keys['q']) { // Gauche (Strafe)
            dx -= rightX; dz -= rightZ;
        }
        if (keys['d']) { // Droite (Strafe)
            dx += rightX; dz += rightZ;
        }

        // Normalisation du vecteur de déplacement
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0) {
            dx = (dx / len) * this.speed * dt;
            dz = (dz / len) * this.speed * dt;
        }

        // Mouvement de collision
        this.moveWithCollision(dx, 0, dz, world);

        // Gravité et saut
        this.velocityY -= this.GRAVITY * dt;
        this.moveWithCollision(0, this.velocityY * dt, 0, world);

        // Saut (espace)
        if (keys[' '] && this.onGround) {
            this.velocityY = this.JUMP_FORCE;
            this.onGround = false;
        }

        // Annule la vitesse de chute
        if (this.y <= 0 && this.velocityY < 0) { // Sécurité si le monde est vide
            // Normalement géré par collision, mais au cas où
        }
        
    }

    moveWithCollision(dx, dy, dz, world) {  
        // On essaye de bouger sur X
        if (dx !== 0) {
            const newX = this.x + dx;
            if (!this.isColliding(newX, this.y, this.z, world)) {
                this.x = newX;
            }
        }

        //  On essaye de bouger sur Z
        if (dz !== 0) {
            const newZ = this.z + dz;
            if (!this.isColliding(this.x, this.y, newZ, world)) {
                this.z = newZ;
            }
        }

        // On essaye de bouger sur Y (gravité + saut)
        if (dy !== 0) {
            const newY = this.y + dy;
            if (!this.isColliding(this.x, newY, this.z, world)) {
                this.y = newY;
                this.onGround = false; // En l'air
            } else {
                if (dy < 0) { // Collision en descendant -> on est au sol
                    this.onGround = true;
                }
                this.velocityY = 0; // Arrête la chute ou le saut
            }
        }
    }

    isColliding(x, y, z, world) {
    
        const blockX = Math.floor(x);
        const blockYFeet = Math.floor(y); // Pieds du joueur
        const blockYHead = Math.floor(y + this.PLAYER_HEIGHT); // Tête du joueur
        const blockZ = Math.floor(z);

        //Verification pied
        if (world.getBlock(blockX, blockYFeet, blockZ) !== BLOCK.AIR) {
            return true; // Collision au niveau des pieds
        }

        //Verification tête
        if (world.getBlock(blockX, blockYHead, blockZ) !== BLOCK.AIR) {
            return true; // Collision au niveau de la tête
        }

        return false; // Pas de collision
    }
}