import { getUrlParams } from "./utils/UrlParams";
import { AdvPlayer } from "./AdvPlayer";
import { createApp } from "./utils/createApp";
import { resPath } from "./utils/resPath";
import { Assets } from "pixi.js";
import { saveCustomBackground, getCustomBackgrounds, deleteCustomBackground } from "./utils/customBgStorage";

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

// ==========================================
// Background Choice Panel Integration
// ==========================================

const bgGridContainer = document.getElementById("bg-grid-container");
const selectBgBtn = document.getElementById("select-bg-btn");
const bgModal = document.getElementById("bg-modal");
const closeBgModalBtn = document.getElementById("close-bg-modal-btn");
const activeBgThumbnail = document.getElementById("active-bg-thumbnail");
const activeBgId = document.getElementById("active-bg-id");
const uploadBgInput = document.getElementById("upload-bg-input") as HTMLInputElement;

// Map to track local object URLs for custom backgrounds
const customBackgroundsMap = new Map<string, string>();
let standardBgList: string[] = [];

const updateActiveBgPreview = (bgId: string) => {
  if (activeBgId) {
    activeBgId.textContent = bgId.startsWith("custom_") ? "Uploaded Custom Image" : `Background: ${bgId}`;
  }
  if (activeBgThumbnail) {
    if (bgId.startsWith("custom_")) {
      const customUrl = customBackgroundsMap.get(bgId);
      if (customUrl) {
        activeBgThumbnail.style.backgroundImage = `url('${customUrl}')`;
      } else {
        activeBgThumbnail.style.backgroundImage = "none";
        activeBgId!.textContent = "Custom Image (re-upload needed)";
      }
    } else {
      const imageUrl = resPath.background(bgId);
      const optimizedUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp`;
      activeBgThumbnail.style.backgroundImage = `url('${optimizedUrl}')`;
    }
  }
};

const closeModal = () => {
  bgModal?.classList.remove("open");
};

const renderBackgroundGrid = () => {
  if (!bgGridContainer) return;
  bgGridContainer.innerHTML = "";

  const activeBgIdVal = advplayer.getSandboxState().backgroundId;

  // 1. Render custom uploaded backgrounds
  customBackgroundsMap.forEach((blobUrl, bgId) => {
    const card = document.createElement("div");
    card.className = "bg-card";
    card.setAttribute("data-bg-id", bgId);
    if (activeBgIdVal === bgId) {
      card.classList.add("active");
    }

    const thumbnail = document.createElement("div");
    thumbnail.className = "bg-thumbnail";
    thumbnail.style.backgroundImage = `url('${blobUrl}')`;

    const label = document.createElement("div");
    label.className = "bg-id-label";
    label.textContent = "Custom BG";

    // Deletion button for custom BG card
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "bg-card-delete";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = "Delete custom background";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Avoid triggering selection
      if (confirm("Delete this custom background?")) {
        // Remove from IndexedDB
        await deleteCustomBackground(bgId);
        // Revoke URL and remove from local map
        URL.revokeObjectURL(blobUrl);
        customBackgroundsMap.delete(bgId);
        
        // If it was active, fallback to default standard background
        if (advplayer.getSandboxState().backgroundId === bgId) {
          const defaultBg = defaultSandboxState.backgroundId;
          await advplayer.setSandboxBackground(defaultBg);
          updateActiveBgPreview(defaultBg);
        }

        // Re-render grid
        renderBackgroundGrid();
      }
    });

    card.appendChild(deleteBtn);
    card.appendChild(thumbnail);
    card.appendChild(label);

    card.addEventListener("click", async () => {
      document.querySelectorAll(".bg-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      await advplayer.setSandboxBackground(bgId);
      updateActiveBgPreview(bgId);
      closeModal();
    });

    bgGridContainer.appendChild(card);
  });

  // 2. Render standard backgrounds
  standardBgList.forEach(bgId => {
    const card = document.createElement("div");
    card.className = "bg-card";
    card.setAttribute("data-bg-id", bgId);
    if (activeBgIdVal === bgId) {
      card.classList.add("active");
    }

    const thumbnail = document.createElement("div");
    thumbnail.className = "bg-thumbnail";
    const imageUrl = resPath.background(bgId);
    const optimizedUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp`;
    thumbnail.style.backgroundImage = `url('${optimizedUrl}')`;

    const label = document.createElement("div");
    label.className = "bg-id-label";
    label.textContent = bgId;

    card.appendChild(thumbnail);
    card.appendChild(label);

    card.addEventListener("click", async () => {
      document.querySelectorAll(".bg-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      await advplayer.setSandboxBackground(bgId);
      updateActiveBgPreview(bgId);
      closeModal();
    });

    bgGridContainer.appendChild(card);
  });
};

// Open Modal and render selection grid
selectBgBtn?.addEventListener("click", () => {
  renderBackgroundGrid();
  bgModal?.classList.add("open");
});

// Close Modal
closeBgModalBtn?.addEventListener("click", closeModal);
bgModal?.addEventListener("click", (e) => {
  if (e.target === bgModal) {
    closeModal();
  }
});

// Handle custom background upload
uploadBgInput?.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const customBgId = `custom_${Date.now()}`;
  const bgKey = `bg_${customBgId}`;

  try {
    // Save to IndexedDB for page reload persistence
    await saveCustomBackground(customBgId, file, file.name);

    // Create object URL and store in mapping
    const blobUrl = URL.createObjectURL(file);
    customBackgroundsMap.set(customBgId, blobUrl);

    // Register blob texture in PixiJS cache
    Assets.add({ alias: bgKey, src: blobUrl });
    await Assets.load(bgKey);

    // Set as player background
    await advplayer.setSandboxBackground(customBgId);

    // Update UI active preview
    updateActiveBgPreview(customBgId);
  } catch (error) {
    console.error("Failed to upload/save custom background:", error);
  }
});

// Intercept AdvPlayer applySandboxState to update preview appropriately
const originalApplySandboxState = advplayer.applySandboxState.bind(advplayer);
(advplayer as any).applySandboxState = async (state: any) => {
  await originalApplySandboxState(state);
  if (state && state.backgroundId) {
    updateActiveBgPreview(state.backgroundId);
  }
};

const initBackgroundTab = async () => {
  try {
    // 1. Load custom backgrounds from IndexedDB
    const savedBGs = await getCustomBackgrounds();
    for (const item of savedBGs) {
      const blobUrl = URL.createObjectURL(item.blob);
      customBackgroundsMap.set(item.id, blobUrl);
      
      const bgKey = `bg_${item.id}`;
      Assets.add({ alias: bgKey, src: blobUrl });
      // Pre-load texture
      await Assets.load(bgKey);
    }

    // 2. Fetch standard background list
    standardBgList = await fetch(resPath.backgroundMaster).then(res => res.json()) as string[];

    // 3. Update the initial preview card
    const initialBgId = advplayer.getSandboxState().backgroundId || defaultSandboxState.backgroundId;
    updateActiveBgPreview(initialBgId);

  } catch (error) {
    console.error("Failed to initialize background tab:", error);
    if (bgGridContainer) {
      bgGridContainer.innerHTML = `<p style="color: #ef4444; font-size: 13px; text-align: center; width: 100%;">Failed to load backgrounds.</p>`;
    }
  }
};

// Load background list
await initBackgroundTab();
