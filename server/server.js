import { serveDir } from "@std/http"; 
import { db } from "./db.js";

// server/server.js
const PORT = 8000;
const SAVES_DIR = "./saves";

// Chaque room a SON PROPRE monde : { sockets, blocks, playerData }
const rooms = new Map();

// Sauvegardes en mémoire (Deno Deploy ne permet pas d'écrire sur disque)
const inMemorySaves = new Map();
const playerdata = new Map();

const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

// On ne crée le dossier saves qu'en LOCAL
if (!isDenoDeploy) {
    try {
        await Deno.mkdir(SAVES_DIR, { recursive: true });
    } catch (err) {
        console.error("Impossible de créer le dossier saves :", err);
    }
}


// Crée une room si elle n'existe pas, la retourne toujours
function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            sockets: new Set(),
            blocks: [],
            playerData: new Map()
        });
        console.log(`🏠 Création de la salle ${roomId}`);
    }
    return rooms.get(roomId);
}


const publicPattern = new URLPattern({ pathname: "*.(html|js|css|mp3|png)" });
const homePattern = new URLPattern({ pathname: "/" });

async function handler(req) {
    const url = new URL(req.url);
    console.log(req.method , url.pathname);

    if (homePattern.test(req.url) || publicPattern.test(req.url)) {
        return serveDir(req, { fsRoot: "public" });
    }

    // ==================== WEBSOCKET ====================
    if (url.pathname === "/ws" && req.headers.get("upgrade") === "websocket") {
        const requestedRoom = url.searchParams.get("room") || "default";
        const { socket, response } = Deno.upgradeWebSocket(req);
        const room = getOrCreateRoom(requestedRoom);

        socket.onopen = () => {
            console.log(`📱 Joueur connecté à la salle : ${requestedRoom}`);
            room.sockets.add(socket);
            socket.currentRoom = requestedRoom;
            room.playerData.set(socket, { x: 0, y: 0, z: 0 });
            // On envoie LES BLOCS DE CETTE ROOM, pas d'une autre
            socket.send(JSON.stringify({ type: "world_sync", blocks: room.blocks }));

            playerdata.set(socket, { x: 0, y: 0, z: 0, name: "Joueur" });
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const myRoom = rooms.get(socket.currentRoom);
            if (!myRoom) return;

            // Modification de bloc → dans LE CAHIER DE CETTE ROOM
            if (data.type === "block_action") {
                const blocks = myRoom.blocks;
                const index = blocks.findIndex(b => b.x === data.x && b.y === data.y && b.z === data.z);

                if (data.action === "place") {
                    if (index !== -1) {
                        blocks[index].blockId = data.blockId;
                    } else {
                        blocks.push({ x: data.x, y: data.y, z: data.z, blockId: data.blockId });
                    }
                } else if (data.action === "break") {
                    if (index !== -1) {
                        blocks[index].blockId = 0;
                    } else {
                        blocks.push({ x: data.x, y: data.y, z: data.z, blockId: 0 });
                    }
                }
                console.log(`📝 Salle ${socket.currentRoom} : ${blocks.length} bloc(s)`);
            }

            // Position du joueur
            if (data.type === "position") {
                myRoom.playerData.set(socket, { x: data.x, y: data.y, z: data.z });
            }

            // Le joueur donne son pseudo
            if (data.type === "set_name") {
                const pData = playerdata.get(socket);
                if (pData) pData.name = data.name;
                
                // On prévient les AUTRES joueurs de la room quel est notre nom
                // On utilise myRoom.sockets (défini tout en haut du onmessage)
                for (const client of myRoom.sockets) {
                    if (client !== socket && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: "player_name", name: data.name }));
                    }
                }
                return; 
            }

            // LE CHAT PERSONNALISÉ
            if (data.type === "chat") {
                const senderName = playerdata.get(socket)?.name || "Anonyme";
                const chatMessage = JSON.stringify({ type: "chat", sender: senderName, message: data.message });
                
                // ON ENVOIE À TOUT LE MONDE dans myRoom.sockets
                for (const client of myRoom.sockets) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(chatMessage);
                    }
                }
                return; 
            }

            // Broadcast : on envoie aux AUTRES joueurs de CETTE ROOM uniquement
            for (const client of myRoom.sockets) {
                if (client !== socket && client.readyState === WebSocket.OPEN) {
                    client.send(event.data);
                }
            }
        };

        socket.onclose = () => {
            console.log(`❌ Joueur déconnecté de ${socket.currentRoom}`);
            const myRoom = rooms.get(socket.currentRoom);
            if (myRoom) {
                myRoom.sockets.delete(socket);
                myRoom.playerData.delete(socket);
                if (myRoom.sockets.size === 0) {
                    rooms.delete(socket.currentRoom);
                    console.log(`🏠 Salle ${socket.currentRoom} détruite (vide).`);
                }
            }
        };

        return response;
    }

    // ==================== SAUVEGARDER ====================
    if (url.pathname === "/save" && req.method === "POST") {
        try {
            const data = await req.json();

            // Clé unique : playerId + roomId pour différencier les salles
            const saveKey = data.roomId; //`${data.playerId}_room_${data.roomId || "solo"}`;
            
            const record = db.prepare("SELECT id FROM games WHERE id=:id").get({id: data.roomId});
            if (record) {
                db.prepare("UPDATE games SET data=:data WHERE id=:id").run({ id: saveKey, data: JSON.stringify(data) });
            } else {
                db.prepare("INSERT INTO games (id, data) VALUES (:id, :data)").run({ id: saveKey, data: JSON.stringify(data) });
            }
            console.log(`💾 Sauvegarde : ${saveKey}`);
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
        } catch (err) {
            console.error("Erreur sauvegarde:", err);
            return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
    }

    // ==================== CHARGER ====================
    if (url.pathname === "/load" && req.method === "GET") {
        const roomId = url.searchParams.get("room") || "solo";
        try {
            const content = db.prepare("SELECT * FROM games WHERE id=:id").get({ id: roomId });
            if (!content) throw new Error("not found");
            return new Response(content.data, { headers: { "Content-Type": "application/json" } });
        } catch (err) {
            return new Response(JSON.stringify({ error: "Aucune sauvegarde" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
    }

    // ==================== LISTER ====================
    if (url.pathname === "/list" && req.method === "GET") {
        const saves = db.prepare("SELECT id FROM games").all().map(s => s.id);

        return new Response(JSON.stringify({ saves }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Not found", { status: 404 });
}

console.log(`Serveur démarré sur le port ${PORT} (Deno Deploy: ${isDenoDeploy})`);
Deno.serve({ port: PORT }, handler);