//js/menu.js

let gameMode = null; // Variable globale pour stocker le mode de jeu sélectionné

// Si on est en local, on utilise localhost. Sinon, on utilise le vrai serveur.
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
let serverIp = isLocal ? "localhost:8000" : "minecraft-server.mohameddjoncoundasissoko.deno.net";

// Fonction appelée par le bouton HTML "Jouer en Solo"
window.startSolo = function() {
    gameMode = "solo";
    document.getElementById('main-menu').remove(); // Le détruit au lieu de le cacher
    document.getElementById('webgpu-canvas').style.display = 'block';
};

// Fonction appelée par le bouton HTML "Rejoindre"
window.startMulti = function() {
    // On demande le pseudo ICI
    window.playerName = prompt("Entrez votre pseudo :", "Joueur") || "Joueur";

    console.log(window.playerName);
    

    localStorage.setItem("playerName", window.playerName);

    if (!serverIp) {
        alert("Entrez une adresse IP");
        return;
    }
    
    // On regarde si le joueur arrive avec un lien partagé dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    
    if (roomFromUrl) {
        // CAS 1 : C'EST UN POTE QUI A CLiqué SUR LE LIEN
        window.currentRoomId = roomFromUrl;
    } else {
        // CAS 2 : C'EST L'HÔTE QUI CRÉE LA PARTIE
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase(); 
        //crypto.randomUUID(); // Génère un identifiant unique pour la partie
        window.currentRoomId = roomId; 
        
        const gameUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        prompt("Partagez ce lien avec vos amis pour rejoindre la partie :", gameUrl);
    }

    gameMode = 'multi';
    document.getElementById('main-menu').remove();
};

// La fonction qui lance VRAIMENT le jeu une fois le choix fait
export async function waitForMenuChoice() {
    while (gameMode === null) {
        await new Promise(r => setTimeout(r, 100)); // Attente de 100ms
    }

    // Si on a un lien avec ?room=XXXX dans la barre d'adresse
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    // Sinon, on prend celui qu'in a généré
   const finalRoom = roomFromUrl || window.currentRoomId || "default";

    // On retourne le choix au fichier main.js
    return { mode: gameMode, ip: serverIp, room: finalRoom };
}


