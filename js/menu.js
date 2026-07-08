//js/menu.js

let gameMode = null; // Variable globale pour stocker le mode de jeu sélectionné
let serverIp = "localhost:8000"; // Valeur par défaut pour l'IP du serveur

// Fonction appelée par le bouton HTML "Jouer en Solo"
window.startSolo = function() {
    gameMode = "solo";
    document.getElementById('main-menu').remove(); // Le détruit au lieu de le cacher
    document.getElementById('webgpu-canvas').style.display = 'block';
};

// Fonction appelée par le bouton HTML "Rejoindre"
window.startMulti = function() {
    if (!serverIp) { alert("Entrez une adresse IP"); return; }
    gameMode = 'multi';
    document.getElementById('main-menu').remove();
    console.log(gameMode, serverIp);
};

// La fonction qui lance VRAIMENT le jeu une fois le choix fait
export async function waitForMenuChoice() {
    // On met le jeu en pause tant que le joueur n'a pas cliqué
    while (gameMode === null) {
        await new Promise(r => setTimeout(r, 100)); // Attente de 100ms
    }
    // On retourne le choix au fichier main.js
    return { mode: gameMode, ip: serverIp };
}