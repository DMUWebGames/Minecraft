// server/server.js
// Serveur Deno minimal pour sauvegarder et charger des parties.
// Lancer avec : deno run --allow-net --allow-read --allow-write server.js
 
const PORT = 8000;
const SAVES_DIR = "./saves";
const rooms = new Map(); // Map qui contient : "ABC123" -> Set de WebSockets
const worldBlocks = [];

// On s'assure que le dossier de sauvegardes existe au démarrage
try {
    await Deno.mkdir(SAVES_DIR, { recursive : true });
} catch (err) {
    console.error("Impossible de créer le dossier saves :", err);
}

// En-têtes CORS : nécessaires pour que ton jeu (servi depuis un autre port,
// par exemple via VS Code Live Server sur le port 5500) puisse appeler ce serveur.
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const playerdata = new Map();

async function handler (req){
    const url = new URL (req.url);

    // Réponse aux requêtes "preflight" CORS (le navigateur les envoie avant un vrai POST)
    if (req.method === "OPTIONS"){
        return new Response(null, {headers : corsHeaders});
    }

    // Gestion des WebSockets 
    if (url.pathname === "/ws" &&  req.headers.get("upgrade") === "websocket") {

        //ON LIT LE NUMERO DE LA SALLE ICI (avant d'ouvrir le WebSocket)
        const requestedRoom = url.searchParams.get("room") || "default";

        // Deno fait la poignée de main magique
        const { socket, response } = Deno.upgradeWebSocket(req);
        console.log(`🔌 Connexion WebSocket pour la salle : ${requestedRoom}`);
        
        //Quand le téléphone sonne...
        socket.onopen = (event) => {
            console.log(`📱 Joueur connecté à la salle : ${requestedRoom}`);

            // Si la salle n'existe pas encore, on la crée
            if (!rooms.has(requestedRoom)) {
                rooms.set(requestedRoom, new Set());
                console.log(`🏠 Création de la salle ${requestedRoom}`);
            }

            // On ajoute le joueur à cette salle précise
            rooms.get(requestedRoom).add(socket);
            
            // On sauvegarde quelle salle appartient à ce socket
            socket.currentRoom = requestedRoom;
            playerdata.set(socket, { x: 0, y: 0, z: 0 });
            
            // historique
            socket.send(JSON.stringify({ type: "world_sync", blocks: worldBlocks }));
        };

        socket.onmessage = (event) => {
            // On transforme le texte JSON en objet JavaScript
            const data = JSON.parse(event.data);

            // Si c'est une action sur un bloc (casser ou poser)
            if (data.type === "block_action") {
                // On mémorise le bloc
                const index = worldBlocks.findIndex(b => b.x === data.x && b.y === data.y && b.z === data.z);

                if (data.action === "place") {
                    if (index !== -1) {
                        worldBlocks[index].blockId = data.blockId;
                    }else{
                        worldBlocks.push({ x: data.x, y: data.y, z: data.z, blockId: data.blockId });
                    }
                } else if (data.action === "break") {
                    // On le retire de la liste
                    if (index !== -1) {
                        worldBlocks[index].blockId = 0; // On peut aussi le marquer comme "vide"
                    }else{
                        worldBlocks.push({ x: data.x, y: data.y, z: data.z, blockId: 0 });
                    }
                }
                // Dans socket.onmessage, après le if (data.type === "block_action")
                console.log(`📝 Cahier : ${worldBlocks.length} bloc(s)`);
            }
            // On parcourt tous les joueurs connectés
            if (data.type === "position") {
                playerdata.set(socket, { x: data.x, y: data.y, z: data.z });
            }

            // Le routeur 
            const myRoom = socket.currentRoom;
            const clientsInRoom = rooms.get(myRoom);

            if (clientsInRoom) {
                for (const client of clientsInRoom) {
                    // On n'envoie pas le message à celui qui l'a envoyé
                    if (client !== socket && client.readyState === WebSocket.OPEN) {
                        client.send(event.data);
                    }
                }
            }
        };

        socket.onclose = () => {
            console.log(`❌ Le joueur a quitté le WebSocket ${socket.currentRoom}`);
            const myRoom = socket.currentRoom;
            if (myRoom && rooms.has(myRoom)) {
                rooms.get(myRoom).delete(socket);

                if (rooms.get(myRoom).size === 0) {
                    rooms.delete(myRoom);
                    console.log(`🏠 La salle ${myRoom} est détruite (vide).`);
                }
            }
            playerdata.delete(socket); // On supprime les données du joueur
        };
        // OBLIGATOIRE : on doit renvoyer cette réponse spéciale pour accepter la connexion
        return response;
    }

    // --- SAUVEGARDER UNE PARTIE ---
    if (url.pathname === "/save" &&  req.method === "POST"){
        try{
            const data = await req.json();
        
            if (!data.playerId) {
                return new Response(
                    JSON.stringify({ error: "playerId manquant" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const filePath = `${SAVES_DIR}/${data.playerId}.json`;
            await Deno.writeTextFile(filePath, JSON.stringify(data));

            console.log(`Sauvegarde écrite : ${filePath}`);
             return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        
        } catch(err){
            console.error("Erreur lors de la sauvegarde",err);
            return new Response(
                JSON.stringify({error : "Erreur server lors de la sauvegarde"}),
                {status: 500, headers : {...corsHeaders, "Content-Type": "application/json"}}
            );
        }
    }

    // --- CHARGER UNE PARTIE ---
    if (url.pathname === "/load" &&  req.method === "GET"){
        const playerId = url.searchParams.get("playerId");

        if (!playerId){
            return new Response(
                JSON.stringify({error : "playerId manquant dans l'URL"}),
                {status: 400, headers : {...corsHeaders, "Content-Type": "application/json"}}
            );
        }

        try{
            const filePath = `${SAVES_DIR}/${playerId}.json`;
            const content = await Deno.readTextFile(filePath);

            return new Response(content, {
                headers : {...corsHeaders, "Content-Type" :"application/json"},
            });
        } catch (err) {
            // Le fichier n'existe pas encore (première fois que ce joueur joue)
            return new Response(
                JSON.stringify({error : "Aucune sauvegarde trouver"}),
                {status: 404, headers : {...corsHeaders, "Content-Type": "application/json"}}
            );
        }

    }

    // --- LISTER LES SAUVEGARDES EXISTANTES (utile pour debug) ---
    if (url.pathname === "/list" && req.method === "GET") {
        const files = [];
        for await (const entry of Deno.readDir(SAVES_DIR)) {
            if (entry.isFile && entry.name.endsWith(".json")) {
                files.push(entry.name.replace(".json", ""));
            }
        }

        return new Response(
            JSON.stringify({ saves: files }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
}

setInterval(() => {
    console.log("données du joueurs :");
    for (const [socket, position] of playerdata) {
        console.log(`  - ${socket}: (${position.x}, ${position.y}, ${position.z})`);
    }
}, 5000);

console.log(`Serveur de sauvegarde démarré sur http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);
