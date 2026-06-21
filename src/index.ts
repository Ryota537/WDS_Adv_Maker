import { getUrlParams } from "./utils/UrlParams";
import { AdvPlayer } from "./AdvPlayer";
import { createApp } from "./utils/createApp";
import { resPath } from "./utils/resPath";
import { Assets } from "pixi.js";
import { saveCustomBackground, getCustomBackgrounds, deleteCustomBackground } from "./utils/customBgStorage";
import { CHARACTER_MAP } from "./constant/charList";
import BodyMotion from "./constant/BodyMotion";
import FacialExpression from "./constant/FacialExpression";

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

// Intercept AdvPlayer applySandboxState to update preview and character controllers appropriately
const originalApplySandboxState = advplayer.applySandboxState.bind(advplayer);
(advplayer as any).applySandboxState = async (state: any) => {
  await originalApplySandboxState(state);
  if (state) {
    if (state.backgroundId) {
      updateActiveBgPreview(state.backgroundId);
    }
    renderCharacterControllers();
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

// ==========================================
// Character Controller Panel Integration
// ==========================================

const addCharacterSelect = document.getElementById("add-character-select") as HTMLSelectElement;
const addCharacterBtn = document.getElementById("add-character-btn") as HTMLButtonElement;
const characterControllersContainer = document.getElementById("character-controllers-container");

let spineList: Array<{ Id: number, CharacterId: number, CompanyId: number }> = [];
const charCostumesMap = new Map<string, string[]>();

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

    // Body (collapsible, visible by default)
    const body = document.createElement("div");
    body.className = "char-card-body";

    // Collapsible toggle handler
    header.addEventListener("click", () => {
      const isHidden = body.style.display === "none";
      body.style.display = isHidden ? "flex" : "none";
      toggleIndicator.textContent = isHidden ? "▼" : "▲";
    });

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
      return { element: group, slider };
    };

    // Position X Slider
    const { element: xSliderGroup } = createSlider("Posisi X", 0, 1920, 1, char.position.x, async (xVal) => {
      char.position.x = xVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, char.facial, char.position);
    });

    // Position Y Slider
    const { element: ySliderGroup } = createSlider("Posisi Y", 0, 1080, 1, char.position.y, async (yVal) => {
      char.position.y = yVal;
      await advplayer.updateSandboxCharacter(charId, char.costumeId, char.motion, char.facial, char.position);
    });

    // Scale Slider
    const { element: scaleSliderGroup } = createSlider("Skala Ukuran", 0.1, 2.0, 0.01, char.position.scale, async (scaleVal) => {
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
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Hapus karakter ${charInfo.name} dari panggung?`)) {
        advplayer.removeSandboxCharacter(charId);
        renderCharacterControllers();
      }
    });

    // Append all to body
    body.appendChild(xSliderGroup);
    body.appendChild(ySliderGroup);
    body.appendChild(scaleSliderGroup);
    body.appendChild(costumeGroup);
    body.appendChild(motionGroup);
    body.appendChild(facialGroup);
    body.appendChild(deleteBtn);

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

    // 3. Populate #add-character-select dropdown
    if (addCharacterSelect) {
      addCharacterSelect.innerHTML = '<option value="" disabled selected>Select Character...</option>';
      
      const sortedCharIds = Array.from(uniqueCharIds).sort((a, b) => {
        const nameA = CHARACTER_MAP[a]?.name || `Unknown (${a})`;
        const nameB = CHARACTER_MAP[b]?.name || `Unknown (${b})`;
        return nameA.localeCompare(nameB);
      });

      sortedCharIds.forEach(charId => {
        const charInfo = CHARACTER_MAP[charId];
        if (charInfo) {
          const option = document.createElement("option");
          option.value = charId;
          option.textContent = `${charInfo.name} (${charId})`;
          addCharacterSelect.appendChild(option);
        }
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
