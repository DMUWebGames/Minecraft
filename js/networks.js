// js/network.js

export class NetworkManager {
    constructor(url, roomId) {
        console.log("🔍 Tentative de connexion à :", `${url}?room=${roomId}`);
        this.ws = new WebSocket(`${url}?room=${roomId}`);
        this.lastSentPos = { x: 0, y: 0, z: 0 };
        this.lastSendTime = 0;

        this.networkTickRate = 50; // en millisecondes
        this.onBlockAction = null;
        this.onWorldSync = null;
        this.onPlayerPositionUpdate = null;

        // Quand le téléphone se connecte...
        this.ws.onopen = () => {
            console.log("📱 Connecté au serveur multijoueur !");
            //this.ws.send("Bonjour Deno, c'est le joueur 1 !");
        };

        // Quand on reçoit un message (pour plus tard)
        this.ws.onmessage = (event) => {
            // Plus tard, c'est ici qu'on mettra à jour la position des autres joueurs
            const data = JSON.parse(event.data);
            
            // Reception de l'historique 
            if (data.type === "world_sync" && this.onWorldSync) {
                this.onWorldSync(data.blocks);
            }

            // GESTION DES BLOCS
            if (data.type === "block_action") {
                if (this.onBlockAction) {
                    this.onBlockAction(data.action, data.x, data.y, data.z, data.blockId);
                }
            }

            // POSITION DES AUTRES JOUEURS
            if (data.type === "position") {
                if (this.onPlayerPositionUpdate) {
                    this.onPlayerPositionUpdate(data.x, data.y, data.z);
                }
            }
        };

        this.ws.onerror = (error) => {
            console.error("❌ Erreur WebSocket (Le serveur Deno est-il lancé ?) :", error);
        };
    }

    // Fonction pour envoyer sa position (avec le Dirty Flag inclus !)
    sendPosition(x, y, z, currentTime) {
        // Si le serveur est déconnecté, on ne fait rien
        if (this.ws.readyState !== WebSocket.OPEN) return;

        // On ne spamme pas le serveur, on envoie seulement toutes les 50ms
        if (currentTime - this.lastSendTime < this.networkTickRate) {
            return; 
        }

        // On vérifie si on a bougé assez pour justifier un envoi
        const dx = Math.abs(x - this.lastSentPos.x);
        const dy = Math.abs(y - this.lastSentPos.y);
        const dz = Math.abs(z - this.lastSentPos.z);

        if (dx > 0.01 || dy > 0.01 || dz > 0.01) {
            this.ws.send(JSON.stringify({
                type: "position",
                x: x,
                y: y,
                z: z
            }));
            
            // On mémorise pour la prochaine fois
            this.lastSentPos.x = x;
            this.lastSentPos.y = y;
            this.lastSentPos.z = z;
            this.lastSendTime = currentTime;
        }
    }

   sendBlockAction(action, x, y, z, blockId = 0) {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: "block_action",
            action: action,
            x: x,
            y: y,
            z: z,
            blockId: blockId
        }));
    }
}