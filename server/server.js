// server/server.js
const PORT = 8000;
const SAVES_DIR = "./saves";

// Chaque room a SON PROPRE monde : { sockets, blocks, playerData }
const rooms = new Map();

// Sauvegardes en mémoire (Deno Deploy ne permet pas d'écrire sur disque)
const inMemorySaves = new Map();

const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

// On ne crée le dossier saves qu'en LOCAL
if (!isDenoDeploy) {
    try {
        await Deno.mkdir(SAVES_DIR, { recursive: true });
    } catch (err) {
        console.error("Impossible de créer le dossier saves :", err);
    }
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

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

async function handler(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
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
            if (!data.playerId) {
                return new Response(JSON.stringify({ error: "playerId manquant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Clé unique : playerId + roomId pour différencier les salles
            const saveKey = `${data.playerId}_room_${data.roomId || "solo"}`;

            if (isDenoDeploy) {
                inMemorySaves.set(saveKey, JSON.stringify(data));
            } else {
                const filePath = `${SAVES_DIR}/${saveKey}.json`;
                await Deno.writeTextFile(filePath, JSON.stringify(data));
            }

            console.log(`💾 Sauvegarde : ${saveKey}`);
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            console.error("Erreur sauvegarde:", err);
            return new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // ==================== CHARGER ====================
    if (url.pathname === "/load" && req.method === "GET") {
        const playerId = url.searchParams.get("playerId");
        const roomId = url.searchParams.get("roomId") || "solo";

        if (!playerId) {
            return new Response(JSON.stringify({ error: "playerId manquant" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        try {
            const saveKey = `${playerId}_room_${roomId}`;
            let content;

            if (isDenoDeploy) {
                content = inMemorySaves.get(saveKey);
                if (!content) throw new Error("not found");
            } else {
                const filePath = `${SAVES_DIR}/${saveKey}.json`;
                content = await Deno.readTextFile(filePath);
            }

            return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (err) {
            return new Response(JSON.stringify({ error: "Aucune sauvegarde" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // ==================== LISTER ====================
    if (url.pathname === "/list" && req.method === "GET") {
        const files = [];
        if (isDenoDeploy) {
            for (const key of inMemorySaves.keys()) files.push(key);
        } else {
            for await (const entry of Deno.readDir(SAVES_DIR)) {
                if (entry.isFile && entry.name.endsWith(".json")) {
                    files.push(entry.name.replace(".json", ""));
                }
            }
        }
        return new Response(JSON.stringify({ saves: files }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
}

console.log(`Serveur démarré sur le port ${PORT} (Deno Deploy: ${isDenoDeploy})`);
Deno.serve({ port: PORT }, handler);