import { getUrlParams } from "./utils/UrlParams";
import { AdvPlayer } from "./AdvPlayer";
import { createApp } from "./utils/createApp";
import { resPath } from "./utils/resPath";
import { Assets } from "pixi.js";
import { saveCustomBackground, getCustomBackgrounds, deleteCustomBackground } from "./utils/customBgStorage";
import { CHARACTER_MAP, THEATER_ORDER } from "./constant/charList";
import BodyMotion from "./constant/BodyMotion";
import FacialExpression from "./constant/FacialExpression";

declare global {
  interface Window {
    sandboxStorage: {
      exportSceneToImage: () => Promise<void> | void;
      exportSceneToJson: () => void;
      importSceneFromJson: (file: File) => Promise<any>;
    };
  }
}

// ==========================================
// Global Loading Interceptor (Jugon Animation)
// ==========================================
let activeRequestsCount = 0;

const showLoading = () => {
  const el = document.getElementById('jugon-loading');
  if (el) el.style.display = 'block';
};

const hideLoading = () => {
  const el = document.getElementById('jugon-loading');
  if (el) el.style.display = 'none';
};

// Intercept window.fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  activeRequestsCount++;
  showLoading();
  try {
    return await originalFetch(...args);
  } finally {
    activeRequestsCount--;
    if (activeRequestsCount <= 0) {
      activeRequestsCount = 0;
      hideLoading();
    }
  }
};

// Intercept PixiJS Assets.load and Assets.loadBundle
const originalAssetsLoad = Assets.load.bind(Assets);
const originalAssetsLoadBundle = Assets.loadBundle.bind(Assets);

Assets.load = async (...args) => {
  activeRequestsCount++;
  showLoading();
  try {
    return await originalAssetsLoad(...args);
  } finally {
    activeRequestsCount--;
    if (activeRequestsCount <= 0) {
      activeRequestsCount = 0;
      hideLoading();
    }
  }
};

Assets.loadBundle = async (...args) => {
  activeRequestsCount++;
  showLoading();
  try {
    return await originalAssetsLoadBundle(...args);
  } finally {
    activeRequestsCount--;
    if (activeRequestsCount <= 0) {
      activeRequestsCount = 0;
      hideLoading();
    }
  }
};

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

// Load default visual scene (moved to bottom of file after manifests are loaded)

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

// Intercept AdvPlayer applySandboxState to update preview, text inputs, and character controllers appropriately
const originalApplySandboxState = advplayer.applySandboxState.bind(advplayer);
(advplayer as any).applySandboxState = async (state: any) => {
  await originalApplySandboxState(state);
  if (state) {
    if (state.backgroundId) {
      updateActiveBgPreview(state.backgroundId);
    }
    if (state.dialogue) {
      if (speakerInput) speakerInput.value = state.dialogue.speakerName || "";
      if (dialogueInput) dialogueInput.value = state.dialogue.dialogueText || "";
    }
    renderCharacterControllers();
  }
};

// ==========================================
// Action Top Bar & Project Storage Bindings
// ==========================================

// Attach sandboxStorage helper functions to window as requested
window.sandboxStorage = {
  exportSceneToImage: () => advplayer.exportSceneToImage(),
  exportSceneToJson: () => advplayer.exportSceneToJson(),
  importSceneFromJson: async (file: File) => {
    try {
      await advplayer.importSceneFromJson(file);
    } catch (error: any) {
      alert("Gagal memuat proyek: " + error.message);
    }
  }
};

// Capture Image Button
const btnCaptureImage = document.getElementById("btn-capture-image");
btnCaptureImage?.addEventListener("click", () => {
  window.sandboxStorage.exportSceneToImage();
});

// JSON Preview Modal Elements
const btnSaveProject = document.getElementById("btn-save-project");
const previewModal = document.getElementById("preview-modal");
const jsonPreviewArea = document.getElementById("json-preview-area");
const btnConfirmSave = document.getElementById("btn-confirm-save");
const btnCancelPreview = document.getElementById("btn-cancel-preview");
const closePreviewModalBtn = document.getElementById("close-preview-modal-btn");

const closePreviewModal = () => {
  previewModal?.classList.remove("open");
};

// Save Project Button -> Show Preview Modal
btnSaveProject?.addEventListener("click", () => {
  const currentState = advplayer.getSandboxState();
  if (jsonPreviewArea) {
    jsonPreviewArea.textContent = JSON.stringify(currentState, null, 2);
  }
  previewModal?.classList.add("open");
});

closePreviewModalBtn?.addEventListener("click", closePreviewModal);
btnCancelPreview?.addEventListener("click", closePreviewModal);

// Confirm Save -> trigger export
btnConfirmSave?.addEventListener("click", () => {
  window.sandboxStorage.exportSceneToJson();
  closePreviewModal();
});

// Load Project Button -> handle input change
const btnLoadProject = document.getElementById("btn-load-project") as HTMLInputElement;
btnLoadProject?.addEventListener("change", async (e) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    await window.sandboxStorage.importSceneFromJson(file);
    // Reset file input value so loading the same file again triggers change event
    target.value = "";
  }
});


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

// ==========================================
// Character Controller Panel Integration
// ==========================================

const addCharacterSelect = document.getElementById("add-character-select") as HTMLSelectElement;
const addCharacterBtn = document.getElementById("add-character-btn") as HTMLButtonElement;
const characterControllersContainer = document.getElementById("character-controllers-container");

let spineList: Array<{ Id: number, CharacterId: number, CompanyId: number }> = [];
const charCostumesMap = new Map<string, string[]>();
const activeCharTabs = new Map<string, 'preset' | 'custom'>();

const renderCharacterControllers = () => {
  if (!characterControllersContainer) return;
  characterControllersContainer.innerHTML = "";

  const activeChars = advplayer.getSandboxState().characters;

  if (activeChars.length === 0) {
    characterControllersContainer.innerHTML = '<p style="color: #8c858e; font-style: italic; text-align: center; margin-top: 16px; font-size: 13px;">No characters on stage.</p>';
    return;
  }

  activeChars.forEach(char => {
    const charId = char.charId;
    const charInfo = CHARACTER_MAP[charId] || { name: `Character ${charId}`, theater: "" };
    const costumes = charCostumesMap.get(charId) || ["01"];
    const activeTab = activeCharTabs.get(charId) || 'preset';

    // Create card container
    const card = document.createElement("div");
    card.className = "char-card";

    // Header
    const header = document.createElement("div");
    header.className = "char-card-header";
    
    const title = document.createElement("div");
    title.className = "char-card-title";
    title.textContent = `${charInfo.name} (${charId})`;
    header.appendChild(title);

    const toggleIndicator = document.createElement("span");
    toggleIndicator.style.color = "#8c858e";
    toggleIndicator.style.fontSize = "12px";
    toggleIndicator.textContent = "▼";
    header.appendChild(toggleIndicator);

    // Body (collapsible, open by default)
    const body = document.createElement("div");
    body.className = "char-card-body";

    // Collapsible toggle handler
    header.addEventListener("click", () => {
      const isHidden = body.style.display === "none";
      body.style.display = isHidden ? "flex" : "none";
      toggleIndicator.textContent = isHidden ? "▼" : "▲";
    });

    // Sub-Tabs Header
    const tabsHeader = document.createElement("div");
    tabsHeader.className = "char-card-tabs-header";

    const presetTabBtn = document.createElement("button");
    presetTabBtn.className = `char-card-tab-btn ${activeTab === 'preset' ? 'active' : ''}`;
    presetTabBtn.textContent = "Preset";

    const customTabBtn = document.createElement("button");
    customTabBtn.className = `char-card-tab-btn ${activeTab === 'custom' ? 'active' : ''}`;
    customTabBtn.textContent = "Custom";

    tabsHeader.appendChild(presetTabBtn);
    tabsHeader.appendChild(customTabBtn);

    // Tab Panes
    const presetPane = document.createElement("div");
    presetPane.className = `char-card-tab-pane ${activeTab === 'preset' ? 'active' : ''}`;

    const customPane = document.createElement("div");
    customPane.className = `char-card-tab-pane ${activeTab === 'custom' ? 'active' : ''}`;

    // Switch tab handler
    const switchTab = async (tab: 'preset' | 'custom') => {
      activeCharTabs.set(charId, tab);
      if (tab === 'preset') {
        // Reset custom bones, gestures, animations, etc.
        await advplayer.resetToSetupPose(charId);
        // Re-apply preset states
        await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, char.facial, char.position);
      } else {
        // Reset preset animations to have a clean setup pose for custom posing
        await advplayer.resetToSetupPose(charId);
      }
      renderCharacterControllers();
    };

    presetTabBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Avoid collapsing the card
      await switchTab('preset');
    });

    customTabBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Avoid collapsing the card
      await switchTab('custom');
    });

    // ==================== PRESET TAB PANE ====================

    // Helper to create slider
    const createSlider = (label: string, min: number, max: number, step: number, val: number, onChange: (v: number) => void) => {
      const group = document.createElement("div");
      group.className = "slider-group";

      const labelRow = document.createElement("div");
      labelRow.className = "slider-label-row";
      labelRow.innerHTML = `<span>${label}</span><span class="slider-value">${val}</span>`;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "char-slider";
      slider.min = min.toString();
      slider.max = max.toString();
      slider.step = step.toString();
      slider.value = val.toString();

      const valEl = labelRow.querySelector(".slider-value") as HTMLElement;

      slider.addEventListener("input", (e) => {
        const v = parseFloat((e.target as HTMLInputElement).value);
        valEl.textContent = v.toString();
        onChange(v);
      });

      group.appendChild(labelRow);
      group.appendChild(slider);
      return group;
    };

    // Position X Slider
    const xSliderGroup = createSlider("Posisi X", 0, 1920, 1, char.position.x, async (xVal) => {
      char.position.x = xVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, char.facial, char.position);
    });

    // Position Y Slider
    const ySliderGroup = createSlider("Posisi Y", 0, 1080, 1, char.position.y, async (yVal) => {
      char.position.y = yVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, char.facial, char.position);
    });

    // Scale Slider
    const scaleSliderGroup = createSlider("Skala Ukuran", 0.1, 2.0, 0.01, char.position.scale, async (scaleVal) => {
      char.position.scale = scaleVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, char.facial, char.position);
    });

    // Costume Dropdown
    const costumeGroup = document.createElement("div");
    costumeGroup.className = "slider-group";
    costumeGroup.innerHTML = `<div class="slider-label-row"><span>Kostum/Baju</span></div>`;
    const costumeSelect = document.createElement("select");
    costumeSelect.className = "char-dropdown";
    costumes.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = `Costume ${c}`;
      if (c === char.costumeId) opt.selected = true;
      costumeSelect.appendChild(opt);
    });
    costumeSelect.addEventListener("change", async (e) => {
      const costumeVal = (e.target as HTMLSelectElement).value;
      char.costumeId = costumeVal;
      await advplayer.updateSandboxCharacter(charId, costumeVal, char.motion, char.facial, char.position);
    });
    costumeGroup.appendChild(costumeSelect);

    // Motion Dropdown
    const motionGroup = document.createElement("div");
    motionGroup.className = "slider-group";
    motionGroup.innerHTML = `<div class="slider-label-row"><span>Motion</span></div>`;
    const motionSelect = document.createElement("select");
    motionSelect.className = "char-dropdown";
    BodyMotion.forEach(bm => {
      const opt = document.createElement("option");
      opt.value = bm.MotionName;
      opt.textContent = bm.MotionName;
      if (bm.MotionName === char.motion) opt.selected = true;
      motionSelect.appendChild(opt);
    });
    motionSelect.addEventListener("change", async (e) => {
      const motionVal = (e.target as HTMLSelectElement).value;
      char.motion = motionVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, motionVal, char.facial, char.position);
    });
    motionGroup.appendChild(motionSelect);

    // Facial Expression Dropdown
    const facialGroup = document.createElement("div");
    facialGroup.className = "slider-group";
    facialGroup.innerHTML = `<div class="slider-label-row"><span>Facial Ekspresi</span></div>`;
    const facialSelect = document.createElement("select");
    facialSelect.className = "char-dropdown";
    FacialExpression.forEach(fe => {
      const opt = document.createElement("option");
      opt.value = fe.Id.toString();
      opt.textContent = `Expression ${fe.Id} (Brow: ${fe.EyeBrow.replace("eyebrow/", "")}, Eye: ${fe.Eye.replace("eye/", "")}, Mouth: ${fe.Mouth.replace("mouth/", "")})`;
      if (fe.Id.toString() === char.facial) opt.selected = true;
      facialSelect.appendChild(opt);
    });
    facialSelect.addEventListener("change", async (e) => {
      const facialVal = (e.target as HTMLSelectElement).value;
      char.facial = facialVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, facialVal, char.position);
    });
    facialGroup.appendChild(facialSelect);

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger";
    deleteBtn.style.marginTop = "6px";
    deleteBtn.textContent = "Hapus Karakter";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Hapus karakter ${charInfo.name} dari panggung?`)) {
        advplayer.removeSandboxCharacter(charId);
        renderCharacterControllers();
      }
    });

    presetPane.appendChild(xSliderGroup);
    presetPane.appendChild(ySliderGroup);
    presetPane.appendChild(scaleSliderGroup);
    presetPane.appendChild(costumeGroup);
    presetPane.appendChild(motionGroup);
    presetPane.appendChild(facialGroup);
    presetPane.appendChild(deleteBtn);

    // ==================== CUSTOM TAB PANE ====================
    const charInstance = advplayer.getCharacterInstance(charId) as any;
    const activeGesture = charInstance ? charInstance.activeGesture : { L: '', R: '' };

    // 1. Hand Gestures
    const gesturesTitle = document.createElement("div");
    gesturesTitle.className = "custom-section-title";
    gesturesTitle.textContent = "Hand Gestures";
    customPane.appendChild(gesturesTitle);

    const gestureTypes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    (['L', 'R'] as const).forEach(side => {
      const row = document.createElement("div");
      row.className = "gesture-row";

      const label = document.createElement("span");
      label.className = "gesture-side-label";
      label.textContent = side === 'L' ? 'Left' : 'Right';
      row.appendChild(label);

      gestureTypes.forEach(type => {
        const btn = document.createElement("button");
        btn.className = "gesture-btn";
        btn.textContent = type;
        if (activeGesture[side] === type) {
          btn.classList.add("active");
        }

        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (activeGesture[side] === type) {
            activeGesture[side] = '';
            await advplayer.resetHandGestures(charId);
            if (activeGesture.L) await advplayer.setHandGesture(charId, 'L', activeGesture.L);
            if (activeGesture.R) await advplayer.setHandGesture(charId, 'R', activeGesture.R);
          } else {
            activeGesture[side] = type;
            await advplayer.setHandGesture(charId, side, type);
          }
          // Refresh local styling for instant smooth feedback
          row.querySelectorAll(".gesture-btn").forEach(b => b.classList.remove("active"));
          if (activeGesture[side] === type) {
            btn.classList.add("active");
          }
        });

        row.appendChild(btn);
      });
      customPane.appendChild(row);
    });

    // 2. Bone Transform Sliders
    const bonesTitle = document.createElement("div");
    bonesTitle.className = "custom-section-title";
    bonesTitle.style.marginTop = "8px";
    bonesTitle.textContent = "Bone Rotations";
    customPane.appendChild(bonesTitle);

    const bones = advplayer.getBones(charId);
    if (bones && bones.length > 0) {
      const categories: Record<string, any[]> = {
        "Fingers": [],
        "Arms": [],
        "Head & Face": [],
        "Torso": [],
        "Legs": [],
        "Others": []
      };

      bones.forEach((bone: any) => {
        const name = (bone.data.name as string).toLowerCase();
        if (/thumb|index|middle|ring|pinky|finger|yubi/.test(name)) {
          categories["Fingers"].push(bone);
        } else if (/arm|elbow|wrist|shoulder|hand/.test(name)) {
          categories["Arms"].push(bone);
        } else if (/head|neck|eye|brow|mouth|lip|hair|ear|jaw|cheek/.test(name)) {
          categories["Head & Face"].push(bone);
        } else if (/spine|hip|chest|pelvis|bust|root/.test(name)) {
          categories["Torso"].push(bone);
        } else if (/leg|knee|foot|ankle|toe/.test(name)) {
          categories["Legs"].push(bone);
        } else {
          categories["Others"].push(bone);
        }
      });

      Object.keys(categories).forEach(catName => {
        const group = categories[catName];
        if (group.length === 0) return;

        const details = document.createElement("details");
        details.style.marginBottom = "6px";
        
        const summary = document.createElement("summary");
        summary.style.fontWeight = "600";
        summary.style.cursor = "pointer";
        summary.style.color = "#a78bfa";
        summary.style.fontSize = "12px";
        summary.style.padding = "2px 0";
        summary.textContent = `${catName} (${group.length})`;
        details.appendChild(summary);

        group.forEach((bone: any) => {
          const boneName = bone.data.name;
          const item = document.createElement("div");
          item.className = "slider-item";
          item.style.marginTop = "4px";
          const currentRotation = bone.rotation || 0;

          item.innerHTML = `
            <div class="slider-label-row">
              <span style="font-size: 11px; color: #8c858e;">${boneName}</span>
              <span class="slider-value" style="font-size: 11px; color: #f3f0f5;">${currentRotation.toFixed(1)}°</span>
            </div>
            <input type="range" class="char-slider" min="-180" max="180" step="0.5" value="${currentRotation}">
          `;
          details.appendChild(item);

          const slider = item.querySelector("input") as HTMLInputElement;
          const valEl = item.querySelector(".slider-value") as HTMLElement;

          slider.addEventListener("input", async (e) => {
            e.stopPropagation();
            const rot = parseFloat(slider.value);
            valEl.textContent = `${rot.toFixed(1)}°`;
            await advplayer.setBoneTransform(charId, boneName, rot);
          });
        });

        customPane.appendChild(details);
      });
    }

    // 3. Animation Scrubbers
    const animsTitle = document.createElement("div");
    animsTitle.className = "custom-section-title";
    animsTitle.style.marginTop = "8px";
    animsTitle.textContent = "Animation Scrubbers";
    customPane.appendChild(animsTitle);

    const animations = advplayer.getAnimations(charId);
    if (animations && animations.length > 0) {
      const grouped: Record<string, string[]> = {};
      animations.forEach((anim: any) => {
        const name = anim.name as string;
        const prefix = name.includes("/") ? name.split("/")[0] : "other";
        if (!grouped[prefix]) grouped[prefix] = [];
        grouped[prefix].push(name);
      });

      let trackCounter = 10;

      Object.keys(grouped).sort().forEach(group => {
        const animNames = grouped[group];
        const details = document.createElement("details");
        details.style.marginBottom = "6px";
        
        const summary = document.createElement("summary");
        summary.style.fontWeight = "600";
        summary.style.cursor = "pointer";
        summary.style.color = "#a78bfa";
        summary.style.fontSize = "12px";
        summary.style.padding = "2px 0";
        summary.textContent = `${group} (${animNames.length})`;
        details.appendChild(summary);

        animNames.forEach(animName => {
          const trackIdx = trackCounter++;
          const item = document.createElement("div");
          item.className = "slider-item";
          item.style.marginTop = "4px";
          const shortName = animName.includes("/") ? animName.split("/")[1] : animName;

          const savedProgress = charInstance?.activeAnimationScrubbers.get(animName) || 0;
          const savedPercentage = Math.round(savedProgress * 100);

          item.innerHTML = `
            <div class="slider-label-row">
              <span style="font-size: 11px; color: #8c858e;">${shortName}</span>
              <span class="slider-value" style="font-size: 11px; color: #f3f0f5;">${savedPercentage}%</span>
            </div>
            <input type="range" class="char-slider" min="0" max="100" step="1" value="${savedPercentage}">
          `;
          details.appendChild(item);

          const slider = item.querySelector("input") as HTMLInputElement;
          const valEl = item.querySelector(".slider-value") as HTMLElement;

          slider.addEventListener("input", async (e) => {
            e.stopPropagation();
            const progress = parseInt(slider.value) / 100;
            valEl.textContent = `${slider.value}%`;
            await advplayer.scrubAnimation(charId, trackIdx, animName, progress);
          });
        });

        customPane.appendChild(details);
      });
    }

    // 4. Reset Pose Button
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn-secondary";
    resetBtn.style.marginTop = "10px";
    resetBtn.textContent = "Reset Pose";
    resetBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await advplayer.resetToSetupPose(charId);
      renderCharacterControllers();
    });
    customPane.appendChild(resetBtn);

    // Assemble all to body
    body.appendChild(tabsHeader);
    body.appendChild(presetPane);
    body.appendChild(customPane);

    card.appendChild(header);
    card.appendChild(body);
    characterControllersContainer.appendChild(card);
  });
};

const initCharacterTab = async () => {
  try {
    // 1. Fetch Spine manifest
    const res = await fetch(resPath.spineMaster);
    spineList = await res.json() as Array<{ Id: number, CharacterId: number, CompanyId: number }>;

    // 2. Build CharacterId to costume IDs map
    charCostumesMap.clear();
    const uniqueCharIds = new Set<string>();

    spineList.forEach(spine => {
      const spineIdStr = spine.Id.toString();
      const charId = spine.CharacterId.toString();
      const costumeId = spineIdStr.slice(3); // e.g. "10101" -> "01"

      uniqueCharIds.add(charId);

      if (!charCostumesMap.has(charId)) {
        charCostumesMap.set(charId, []);
      }
      charCostumesMap.get(charId)!.push(costumeId);
    });

    // 3. Populate #add-character-select dropdown grouped by theater
    if (addCharacterSelect) {
      addCharacterSelect.innerHTML = '<option value="" disabled selected>Select Character...</option>';

      // Group characters by theater
      const theaterGroups: Record<string, { charId: string; name: string }[]> = {};

      uniqueCharIds.forEach(charId => {
        const charInfo = CHARACTER_MAP[charId];
        const theater = charInfo ? charInfo.theater : "Unknown";
        const name = charInfo ? charInfo.name : `Character ${charId}`;

        if (!theaterGroups[theater]) {
          theaterGroups[theater] = [];
        }
        theaterGroups[theater].push({ charId, name });
      });

      // Order the theater groups
      const orderedTheaters = [
        ...THEATER_ORDER.filter(t => theaterGroups[t]),
        ...Object.keys(theaterGroups).filter(t => !THEATER_ORDER.includes(t))
      ];

      orderedTheaters.forEach(theater => {
        const group = theaterGroups[theater];
        const optgroup = document.createElement("optgroup");
        optgroup.label = theater;

        // Sort characters alphabetically within this theater
        group.sort((a, b) => a.name.localeCompare(b.name));

        group.forEach(({ charId, name }) => {
          const option = document.createElement("option");
          option.value = charId;
          option.textContent = `${name} (${charId})`;
          optgroup.appendChild(option);
        });

        addCharacterSelect.appendChild(optgroup);
      });
    }
  } catch (error) {
    console.error("Failed to load Spine manifest:", error);
    if (addCharacterSelect) {
      addCharacterSelect.innerHTML = '<option value="" disabled selected>Failed to load characters</option>';
    }
  }
};

addCharacterBtn?.addEventListener("click", async () => {
  const charId = addCharacterSelect.value;
  if (!charId) {
    alert("Pilih karakter terlebih dahulu.");
    return;
  }

  // Check if character is already on stage
  const activeChars = advplayer.getSandboxState().characters;
  if (activeChars.some(c => c.charId === charId)) {
    alert("Karakter sudah ada di panggung.");
    return;
  }

  // Determine default costume
  const costumes = charCostumesMap.get(charId) || ["01"];
  const costumeId = costumes[0] || "01";

  // Set defaults
  const motion = "body/normal";
  const facial = "100";
  const position = { x: 960, y: 1080, scale: 0.79 };

  try {
    addCharacterBtn.disabled = true;
    addCharacterBtn.textContent = "Loading...";

    await advplayer.updateSandboxCharacter(charId, costumeId, motion, facial, position);
    renderCharacterControllers();
  } catch (error) {
    console.error("Failed to add character:", error);
    alert("Gagal memuat aset karakter Spine.");
  } finally {
    addCharacterBtn.disabled = false;
    addCharacterBtn.textContent = "Add";
  }
});

// Load standard manifests & set initial state
await initBackgroundTab();
await initCharacterTab();

// Load default visual scene (moved here after character and background info are initialized)
await advplayer.applySandboxState(defaultSandboxState);
