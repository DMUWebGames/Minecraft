// server/server.js
// Serveur Deno minimal pour sauvegarder et charger des parties.
// Lancer avec : deno run --allow-net --allow-read --allow-write server.js
 
const PORT = 8000;
const SAVES_DIR = "./saves";

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

async function handler (req){
    const url = new URL (req.url);

    // Réponse aux requêtes "preflight" CORS (le navigateur les envoie avant un vrai POST)
    if (req.method === "OPTIONS"){
        return new Response(null, {headers : corsHeaders});
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

console.log(`Serveur de sauvegarde démarré sur http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);
