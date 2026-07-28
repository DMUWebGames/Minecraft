// js/inputs.js
import { BLOCK } from './blocks.js';
import { isChatting } from './chat.js';
import { saveGame, loadGame } from './save.js';

export function initInputs(state, deps) {
    const { canvas, player, world, device, network, sounds, updateLights, updateHotbar } = deps;

    // --- CLAVIER ---
    window.addEventListener("keydown", (event) => {
        if (event.key === 'F5' || event.key === 'F9') {
            event.preventDefault();
        }

        if (isChatting()) return; // Sécurité chat

        state.keys[event.key.toLowerCase()] = true;
        if (event.key === ' ') state.keys[' '] = true;

        switch(event.key) {
            case '1': state.selectedBlock = BLOCK.GRASS; updateHotbar(1); break;
            case '2': state.selectedBlock = BLOCK.DIRT; updateHotbar(2); break;
            case '3': state.selectedBlock = BLOCK.STONE; updateHotbar(3); break;
            case '4': state.selectedBlock = BLOCK.WOOD; updateHotbar(4); break;
            case '5': state.selectedBlock = BLOCK.LAMP; updateHotbar(5); break;
            case '6': state.selectedBlock = BLOCK.GLASS; updateHotbar(6); break;
            case '7': state.selectedBlock = BLOCK.WATER; updateHotbar(7); break;
            case '8': 
                const target = player.raycast(world);
                if (target) {
                    world.generateTree(world, target.x, target.z); 
                    // ON RECOPIE LE CODE BRUT ICI
                    const newVertices = world.buildMesh();
                    if (newVertices.byteLength > state.vertexBuffer.size) {
                        state.vertexBuffer.destroy();
                        state.vertexBuffer = device.createBuffer({
                            size: newVertices.byteLength,
                            usage: GPUBufferUsage.VERTEX | GPUBuffer_USAGE.COPY_DST,
                        });
                    }
                    device.queue.writeBuffer(state.vertexBuffer, 0, newVertices);
                    state.vertices = newVertices;
                }
                break;
            
            case 'F5' : saveGame(player, world); break;
            case 'F9' : loadGame(player,world).then((loaded)=>{
                if (loaded) {
                    // ON RECOPIE LE CODE BRUT ICI
                    const newVertices = world.buildMesh();
                    state.vertexBuffer.destroy();
                    state.vertexBuffer = device.createBuffer({
                        size: newVertices.byteLength,
                        usage: GPUBufferUsage.VERTEX | GPUBuffer_USAGE.COPY_DST,
                    });
                    device.queue.writeBuffer(state.vertexBuffer, 0, newVertices);
                    state.vertices = newVertices;
                }
            });
            break;
        }
    });

    window.addEventListener("keyup", (event) => {
        state.keys[event.key.toLowerCase()] = false;
        if (event.key === ' ') state.keys[' '] = false;
    });
    
    // --- SOURIS POUR CASSER/POSER ---
    canvas.addEventListener("mousedown", (event) => {
        if (!state.isPointerLocked) return;
        const target = player.raycast(world);
        if (target) {
            let modified = false;
            let px, py, pz;

            if (event.button === 0) {
                const brokenBlockId = world.getBlock(target.x, target.y, target.z);
                world.setBlock(target.x, target.y, target.z, BLOCK.AIR);
                modified = true;

                if ( brokenBlockId === BLOCK.GLASS) {
                    sounds.glass.cloneNode().play().catch(() => {});
                }else if (brokenBlockId === BLOCK.WOOD) {
                    sounds.wood.cloneNode().play().catch(() => {});
                } else {
                    sounds.breakDefault.cloneNode().play().catch(() => {});
                }
            } else if (event.button === 2) {
                px = target.x;
                py = target.y + 1;
                pz = target.z;

                if (world.getBlock(px, py, pz) === BLOCK.AIR) {
                    world.setBlock(px, py, pz, state.selectedBlock);
                    modified = true;
                    sounds.place.cloneNode().play().catch(() => {});
                }
            }
            
            // ON RECOPIE LE CODE BRUT ICI
            if (modified) {
                const newVertices = world.buildMesh();

                if (newVertices.byteLength > state.vertexBuffer.size) {
                    state.vertexBuffer.destroy();
                    state.vertexBuffer = device.createBuffer({
                        size: newVertices.byteLength,
                        usage: GPUBufferUsage.VERTEX | GPUBuffer_USAGE.COPY_DST,
                    });
                }
                device.queue.writeBuffer(state.vertexBuffer, 0, newVertices);
                state.vertices = newVertices; 
                updateLights(); 

                if (network){
                    if (event.button === 0) {
                        network.sendBlockAction("break", target.x, target.y, target.z);
                    } else if (event.button === 2) {
                        network.sendBlockAction("place", px, py, pz, state.selectedBlock);
                    }
                }
            }
        }
    });

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    
    // --- CAMERA ---
    canvas.addEventListener("click", () => {
        if (!state.isPointerLocked) {
            canvas.requestPointerLock();
        }
    });

    document.addEventListener("pointerlockchange", () => {
        state.isPointerLocked = (document.pointerLockElement === canvas);
    });

    document.addEventListener("mousemove", (event) => {
        if (state.isPointerLocked) {
            const sensitivity = 0.002;
            player.yaw -= event.movementX * sensitivity;
            player.pitch -= event.movementY * sensitivity;

            const maxPitch = Math.PI / 2 - 0.01;
            player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch));
        }
    });
}