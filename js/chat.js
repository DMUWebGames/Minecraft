//js/chat.js

let isActive = false;
let networkInstance = null;
let canvasInstance = null;

export function initChat(network, canvas){
    networkInstance = network;
    canvasInstance = canvas;

    window.addEventListener("keydown", handleGlobalKeyDown);
    document.getElementById('chat-input').addEventListener("keydown", handleInputKeyDown);
}

function handleGlobalKeyDown(event){
    if (event.key.toLowerCase()=== 't' && !isActive && document.pointerLockElement){
        event.preventDefault(); // Empêche le "T" de faire autre chose
        openChat();
    }
}

function handleInputKeyDown(event){
    // stopPropagation prevents the (ZQSD) keys from triggering game actions while typing.
    event.stopPropagation();

    if (event.key === "Enter") {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        
        if (text && networkInstance) {
            networkInstance.sendChat(text);
        }
        closeChat();
    } else if (event.key === "Escape") {
        closeChat(); // Cancel the message
    }
}

function openChat() {
    isActive = true;
    document.exitPointerLock();

    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-container');

    input.style.display = 'block';
    container.classList.add('active');
    input.focus();
}

function closeChat() {
    isActive = false;
    const input = document.getElementById('chat-input');
    input.value = '';
    input.style.display = 'none';

    // Rend la main au jeu
    if (canvasInstance) canvasInstance.requestPointerLock();
}

export function displayChatMessage(message){
    const chatBox = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');

    msgDiv.innerHTML = message;
    chatBox.appendChild(msgDiv);

    chatBox.scrollTop = chatBox.scrollHeight;

    const container = document.getElementById('chat-container');
    container.classList.add('active');
    
    // Disappears after 5 seconds
    setTimeout(() => {
        container.classList.remove('active');
    }, 5000);
}


export function isChatting(){
    return isActive;
}