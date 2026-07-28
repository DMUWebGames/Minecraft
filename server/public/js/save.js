// js/save.js
import { Chunk } from './chunk.js';
 
const SERVER_URL = "http://localhost:8000";

const roomId = new URLSearchParams(location.search).get("room");

// Sauvegarde la partie actuelle (position du joueur + tous les chunks chargés)
export async function saveGame(player, world, playerId = "joueur1") {

    const saveData = {
        playerId: playerId,
        player: {
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            pitch : player.pitch,
        },
        chunks: Array.from(world.chunks.entries()).map(([key, chunk]) => ({
            key,
            chunkX : chunk.chunkX,
            chunkZ : chunk.chunkZ,
            blocks : Array.from(chunk.blocks.entries())
        })),
        roomId
    };

    console.log(saveData.roomId);
    

    try{
        const response = await fetch(`${SERVER_URL}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saveData)
        });

        if (response.ok){
            console.log("Partie Sauvegardée");
            return true;
        } else {
            console.error("Erreur lors de la sauvegarde (réponse serveur non-ok)");
            return false;
        }
    } catch (err) {
        console.error("Impossible de contacter le serveur de sauvegarde", err);
        return false;
    }
}

// Charge une partie sauvegardée et restaure player + world.
// Retourne true si une sauvegarde a bien été chargée, false sinon.
export async function loadGame(player, world, playerId="joueur1"){
    try {
        const response = await fetch(`${SERVER_URL}/load?room=${roomId}&playerId=${playerId}`);
 
        if (!response.ok) {
            console.log("Aucune sauvegarde trouvée, nouvelle partie.");
            return false;
        }

        const saveData = await response.json();

        //Restaurer les positions et l'orientation du joueur
        player.x = saveData.player.x;
        player.y = saveData.player.y;
        player.z = saveData.player.z;
        player.yaw = saveData.player.yaw;
        player.pitch = saveData.player.pitch;

        //Restaurer tous les chunks sauvegardés
        world.chunks.clear();
        
        for (const savedChunk of saveData.chunks) {
            const chunk = new Chunk(savedChunk.chunkX, savedChunk.chunkZ);
            chunk.blocks = new Map(savedChunk.blocks);
            world.chunks.set(savedChunk.key, chunk);
        }
 
        console.log("Partie chargée !");
        return true;

    }catch (err) {
        console.error("Impossible de contacter le serveur de sauvegarde :", err);
        return false;
    }

}
