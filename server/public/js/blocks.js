// js/blocks.js

// 1. Définition des ID de blocs (Enum)
export const BLOCK = {
    AIR: 0,    // Vide
    GRASS: 1,  // Herbe
    DIRT: 2,   // Terre
    STONE: 3,  // Pierre
    WOOD: 4,    // Bois
    LAMP: 5,   // Lumière
    GLASS: 6, // Verre
    WATER: 7, // EAU
    TREES : 8 // Arbre
};

// 2. Définition des couleurs associées
// En WebGL/WebGPU, les couleurs sont souvent en RGB normalisé (0.0 à 1.0)
export function getBlockColor(blockId) {
    switch (blockId) {
        case BLOCK.GRASS: return [0.2, 0.8, 0.2]; // Vert
        case BLOCK.DIRT:  return [0.6, 0.4, 0.2]; // Marron
        case BLOCK.STONE: return [0.5, 0.5, 0.5]; // Gris
        case BLOCK.WOOD:  return [0.6, 0.3, 0.1]; // Marron clair
        case BLOCK.LAMP:  return [1.0, 1.0, 0.5]; // Jaune clair
        case BLOCK.GLASS: return [0.6, 0.8, 1.0]; // Bleu clair
        case BLOCK.WATER: return [0.2, 0.4, 0.9]; // Bleu foncé
        case BLOCK.TREES: return [0.15, 0.55, 0.1];
        default:          return [1.0, 0.0, 1.0]; // Magenta (Erreur)
    }
}