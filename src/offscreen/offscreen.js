// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "PLAY_AUDIO") {
        playAudio(request.audioData, sendResponse);
        return true; // Keep the message channel open for async response
    }
});

function playAudio(audioData, sendResponse) {
    try {
        const audio = new Audio(audioData);
        
        audio.onended = () => {
            sendResponse({ success: true });
        };
        
        audio.onerror = (e) => {
            console.error("Audio playback error:", e);
            sendResponse({ success: false, error: "Playback failed" });
        };

        audio.play().catch(error => {
            console.error("Play error:", error);
            sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
        console.error("Audio init error:", error);
        sendResponse({ success: false, error: error.message });
    }
}