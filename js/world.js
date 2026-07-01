//js/world.js
import { Chunk } from './chunk.js';
import { BLOCK } from './blocks.js';

const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 3; // Nombre de chunks

export class World{
    constructor(){
        this.chunks = new Map();

        this.lastPlayerChunkX = null;
        this.lastPlayerChunkZ = null;
    }

    // ---- Conversion de données

    // Convertit une coordonnée globale
    worldToChunkCoord(coord){
        return Math.floor(coord / CHUNK_SIZE);
    }

    worldToLocalCoord(coord){
        // Le modulo en JS peut être négatif, on corrige avec une double opération
        return ((coord % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE; //between 0 to 8
    }

    getChunkKey(chunkX, chunkZ){
        return `${chunkX},${chunkZ}`; //unique texte key
    }

    // --- GESTION DES CHUNKS

    getOrCreateChunk(chunkX, chunkZ) {
        const key = this.getChunkKey(chunkX, chunkZ);

        if (!this.chunks.has(key)) {
            const chunk = new Chunk(chunkX, chunkZ);
            this.generateChunkTerrain(chunk);
            this.chunks.set(key, chunk);
        }
        return this.chunks.get(key);
    }

    generateTree(chunk, x, y,z){
        const trunkHeight = 4;

        //Tronc
        for (let dy = -1; dy < trunkHeight - 1; dy++){
            chunk.setBlock(x, y + dy, z, BLOCK.WOOD);
        }

        // Feuillage : cube 3x3 sur 2 couches, au sommet du tronc
        const leafBaseY = y + trunkHeight - 2;

        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                chunk.setBlock(x + dx, leafBaseY, z + dz, BLOCK.TREES);
            }
        }

        // Étage du haut : plus étroit 3x3
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                chunk.setBlock(x + dx, leafBaseY + 1, z + dz, BLOCK.TREES);
            }
        }
        // Pointe du feuillage (juste le centre, une couche plus haut)
        chunk.setBlock(x, leafBaseY + 2, z, BLOCK.TREES);
    }

    // Fonction mathématique pour calculer la hauteur de la montagne
    getMountainHeight(worldX, worldZ) {
        // 1. De petites collines douces partout (le sol de base qui ondule)
        let height = Math.sin(worldX * 0.05) * 5;
        height += Math.cos(worldZ * 0.08) * 4;

        // 2. Le gros pic de montagne (au centre du monde 0,0)
        // On calcule la distance depuis le centre
        let dist = Math.sqrt(worldX * worldX + worldZ * worldZ);
        
        // Plus on est près du centre, plus ça monte haut (calcul de cloche)
        let peak = Math.exp(-dist * dist / 300.0) * 20.0; // 20 = hauteur max du pic

        // On arrondit pour avoir des blocs entiers
        return Math.floor(height + peak);
    }

    generateChunkTerrain(chunk) {
        // Sol simple
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                chunk.setBlock(x, -1, z, BLOCK.GRASS);
                chunk.setBlock(x, -2, z, BLOCK.DIRT);
                chunk.setBlock(x, -3, z, BLOCK.STONE);
                chunk.setBlock(x, -4, z, BLOCK.WOOD);
                chunk.setBlock(x, -5, z, BLOCK.GRASS);
                chunk.setBlock(x, -6, z, BLOCK.WOOD);
                chunk.setBlock(x, -7, z, BLOCK.DIRT);
                chunk.setBlock(x, -8, z, BLOCK.STONE);
                chunk.setBlock(x, -9, z, BLOCK.DIRT);
                chunk.setBlock(x, -10, z, BLOCK.STONE);
            }
        }
         
        // La maison ne sera générée que dans le chunk de spawn (0,0), pour ne pas
        if (chunk.chunkX === 0 && chunk.chunkZ === 0) {
            chunk.generateHouse(8, 0, 8);
            this.generateTree (chunk, -10, 0, 9);
         
            // Joueur spawn à Z=5. Blocs à Z=3 = Devant le joueur.
            // Y=0, 1, 2 = A hauteur des yeux.
            chunk.setBlock(0, 0, 3, BLOCK.STONE);
            chunk.setBlock(0, 1, 3, BLOCK.STONE);
            chunk.setBlock(0, 2, 3, BLOCK.STONE);

            chunk.setBlock(2, 0, 3, BLOCK.WOOD);
            chunk.setBlock(2, 1, 3, BLOCK.WOOD);
            chunk.setBlock(2, 2, 3, BLOCK.WOOD);

        }else if (chunk.chunkX === 3 && chunk.chunkZ === 3) {
            // NOUVEAU : la grotte/rivière fixe
            this.generateUndergroundRoom(chunk);
        } else if (chunk.chunkX === -1 && chunk.chunkZ === -2) {
            // NOUVEAU : la montagne fixe
            this.generateMountain(chunk, 8, 8);
        }
            
    }

    // FONCTION 100% INDÉPENDANTE POUR LA MONTAGNE
    generateMountain(chunk, centerX, centerZ) {
        const rayon = 12;      // La largeur de la montagne (en blocs)
        const hauteurMax = 18; // Le point le plus haut de la montagne

        for (let x = -rayon; x <= rayon; x++) {
            for (let z = -rayon; z <= rayon; z++) {
                
                // On calcule la distance depuis le centre de la montagne
                const dist = Math.sqrt(x * x + z * z);
                
                // Si on est en dehors du rayon, on passe
                if (dist > rayon) continue;

                // On calcule la hauteur pour cet endroit 
                // (Proche du centre = hauteurMax, loin du centre = 0)
                let hauteur = Math.floor((1 - (dist / rayon)) * hauteurMax);

                // ON POSE LES BLOCS DE Y=1 JUSQU'A Y=hauteur
                // (On ne touche jamais à Y=0 ou en dessous !)
                for (let y = 1; y <= hauteur; y++) {
                    
                    // Le bloc tout en haut est de l'herbe, le reste est de la pierre
                    let typeBloc = BLOCK.STONE;
                    if (y === hauteur) typeBloc = BLOCK.GRASS;

                    // Position finale dans le chunk
                    let finalX = centerX + x;
                    let finalZ = centerZ + z;

                    // Sécurité : on ne dessine que si on ne sort pas du chunk
                    if (finalX >= 0 && finalX < CHUNK_SIZE && finalZ >= 0 && finalZ < CHUNK_SIZE) {
                        chunk.setBlock(finalX, y, finalZ, typeBloc);
                    }
                }
            }
        }
    }

    generateUndergroundRoom(chunk) {
        const startX = 3, startZ = 3; // position locale dans le chunk
        const roomW = 10, roomD = 10, roomH = 6;
        const roomFloorY = -8; // profondeur de la salle (sous le sol normal)

        // 1. Creuser la grande salle (remplir d'air)
        for (let x = startX; x < startX + roomW; x++ ){
            for (let z = startZ; z < startZ + roomD; z++){
                for (let y = roomFloorY; y < roomFloorY + roomH; y++){
                    chunk.setBlock(x, y, z, BLOCK.AIR);
                }
            }
        }

        // 2. Sol  de la taille en pierre
        for (let x = startX; x < startX + roomW; x++ ){
            for (let z = startZ; z < startZ + roomD; z++){
                chunk.setBlock(x, roomFloorY -1, z, BLOCK.STONE);  
            }
        }

        // 3. Le trou vertical (l'entrée), depuis la surface jusqu'à la salle — élargi
        const entranceX = startX + 5, entranceZ = startZ + 5;
        const entranceRadius = 1; // 1 = trou de 3x3, 2 = trou de 5x5, etc.

        for (let dx = -entranceRadius; dx <= entranceRadius; dx++) {
            for (let dz = -entranceRadius; dz <= entranceRadius; dz++) {
                for (let y = roomFloorY + roomH; y <= -1; y++) {
                    chunk.setBlock(entranceX + dx, y, entranceZ + dz, BLOCK.AIR);
                }
            }
        }

        // 4. La rivière : un point de départ en surface qui descend par paliers
        let riverX = entranceX - 3;
        let riverY = -1; // niveau du sol normal
        let riverZ = entranceZ;

        for (let step = 0; step < 6; step++) {
            chunk.setBlock(riverX, riverY, riverZ, BLOCK.WATER);
            riverY -= 1; // palier : on descend d'un bloc à chaque étape
            riverX += 1; // on avance horizontalement vers le trou
        }

        // 5. La rivière se déverse dans la salle (eau au centre du fond)
        chunk.setBlock(entranceX, roomFloorY, entranceZ, BLOCK.WATER);

    }

    // --- API PUBLIQUE (même interface que ton ancienne classe Chunk)
    setBlock(worldX, worldY, worldZ, blockId) {
        const chunkX = this.worldToChunkCoord(worldX);
        const chunkZ = this.worldToChunkCoord(worldZ);
        const localX = this.worldToLocalCoord(worldX);
        const localZ = this.worldToLocalCoord(worldZ);
 
        const chunk = this.getOrCreateChunk(chunkX, chunkZ);
        chunk.setBlock(localX, worldY, localZ, blockId);
    }

    getBlock(worldX, worldY, worldZ){
        const chunkX = this.worldToChunkCoord(worldX);
        const chunkZ = this.worldToChunkCoord(worldZ);
        const key = this.getChunkKey(chunkX,chunkZ);

        if (!this.chunks.has(key)){
            return BLOCK.AIR;
        }

        const localX = this.worldToLocalCoord(worldX);
        const localZ = this.worldToLocalCoord(worldZ);

        return this.chunks.get(key).getBlock(localX, worldY, localZ);
    }

    //CHARGEMENT DYNAMIQUE AUTOUR DU JOUEUR 
    // Appelée à chaque frame : charge les chunks proches du joueur, décharge les lointains
    update(playerX,playerZ){
        const playerChunkX = this.worldToChunkCoord(playerX);
        const playerChunkZ = this.worldToChunkCoord(playerZ);

        // Optimisation : si le joueur est resté dans le même chunk, rien à faire
        if (playerChunkX === this.lastPlayerChunkX && playerChunkZ === this.lastPlayerChunkZ) {
            return false;
        }

        this.lastPlayerChunkX = playerChunkX;
        this.lastPlayerChunkZ = playerChunkZ;

        // Charger tous les chunks dans le rayon RENDER_DISTANCE autour du joueur
        for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
            for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
                this.getOrCreateChunk(playerChunkX + dx, playerChunkZ + dz);
            }
        }

        // Décharger les chunks trop loin (pour ne pas accumuler indéfiniment en mémoire)
        for (const [key, chunk] of this.chunks) {
            const dx = chunk.chunkX - playerChunkX;
            const dz = chunk.chunkZ - playerChunkZ;
            const dist = Math.max(Math.abs(dx), Math.abs(dz));
 
            if (dist > RENDER_DISTANCE + 1) {
                this.chunks.delete(key);
            }
        }
 
        return true; // true = il y a eu des changements, il faut reconstruire les meshes
    }

    //CONSTRUCTION DU MESH GLOBAL
    // Reconstruit le mesh de TOUS les chunks actifs et les fusionne en un seul tableau
    // (Pour l'instant on garde un seul gros mesh, comme avant — on optimisera plus tard si besoin)
    buildMesh() {
        const meshes = [];
        let totalLength = 0;
 
        for (const chunk of this.chunks.values()) {
            const chunkMesh = chunk.buildMesh();
            meshes.push(chunkMesh);
            totalLength += chunkMesh.length;
        }
 
        const finalMesh = new Float32Array(totalLength);
        let offset = 0;
        for (const mesh of meshes) {
            finalMesh.set(mesh, offset);
            offset += mesh.length;
        }
 
        return finalMesh;
    }
 
    // LUMIÈRES (toutes les lampes de tous les chunks actifs) 
    getLightSources() {
        const allLights = [];
        for (const chunk of this.chunks.values()) {
            const localLights = chunk.getLightSources();
            // Il faut convertir les coordonnées locales du chunk en coordonnées globales
            for (const light of localLights) {
                allLights.push({
                    x: light.x + chunk.chunkX * CHUNK_SIZE,
                    y: light.y,
                    z: light.z + chunk.chunkZ * CHUNK_SIZE,
                });
            }
        }
        return allLights;
    }

}