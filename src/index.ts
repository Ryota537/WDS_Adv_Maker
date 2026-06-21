import { getUrlParams } from "./utils/UrlParams";
import { AdvPlayer } from "./AdvPlayer";
import { createApp } from "./utils/createApp";

const { renderer } = getUrlParams();

// Initialize PixiJS application
const app = await createApp(<'webgl' | 'webgpu'> renderer);

// Create Adv Player
const advplayer = await AdvPlayer.create(app.stage);
(globalThis as any).advplayer = advplayer;

// ==========================================
// Web UI Controls & Sandbox Integration
// ==========================================

// Tab navigation handler
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    if (tabId) {
      document.getElementById(tabId)?.classList.add('active');
    }
  });
});

// Select input elements
const sandboxToggle = document.getElementById("sandbox-toggle") as HTMLInputElement;
const speakerInput = document.getElementById("speaker-name") as HTMLInputElement;
const dialogueInput = document.getElementById("dialogue-text") as HTMLTextAreaElement;

// Sync state helper
const updateSandboxText = () => {
  if (sandboxToggle && !sandboxToggle.checked) return;
  const speaker = speakerInput?.value || "";
  const text = dialogueInput?.value || "";
  advplayer.setSandboxText(speaker, text);
};

// Input listeners
speakerInput?.addEventListener("input", updateSandboxText);
dialogueInput?.addEventListener("input", updateSandboxText);

// Toggle Sandbox Mode
sandboxToggle?.addEventListener("change", (e) => {
  const isChecked = (e.target as HTMLInputElement).checked;
  advplayer.isSandboxMode = isChecked;
  if (isChecked) {
    updateSandboxText();
  }
});

// ==========================================
// Default Sandbox Initialization
// ==========================================

// Enable Sandbox Mode by default
advplayer.isSandboxMode = true;
if (sandboxToggle) {
  sandboxToggle.checked = true;
}

const defaultSandboxState = {
  backgroundId: "410",
  dialogue: {
    speakerName: "Kokona",
    dialogueText: "You finally here!"
  },
  characters: [
    {
      charId: "101",
      costumeId: "01",
      motion: "body/sad",
      facial: "202",
      position: {
        x: 960,
        y: 1080,
        scale: 0.79
      }
    }
  ]
};

// Populate editor fields
if (speakerInput) {
  speakerInput.value = defaultSandboxState.dialogue.speakerName;
}
if (dialogueInput) {
  dialogueInput.value = defaultSandboxState.dialogue.dialogueText;
}

// Load default visual scene
await advplayer.applySandboxState(defaultSandboxState);
