/**
 * Utility for exporting and importing Sandbox scenes as JSON files.
 */

export interface ISandboxExportedState {
  backgroundId: string;
  dialogue: {
    speakerName: string;
    dialogueText: string;
  };
  characters: Array<{
    charId: string;
    costumeId: string;
    motion: string;
    facial: string;
    headDirection?: string;
    position: {
      x: number;
      y: number;
      scale: number;
    };
  }>;
}

/**
 * Packs the current visual stage state and triggers a JSON file download in browser.
 */
export function exportSceneToJson(currentState: ISandboxExportedState) {
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sandbox_scene_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (error) {
    console.error("Failed to export sandbox scene:", error);
  }
}

/**
 * Reads a JSON file via FileReader, validates its schema, and returns the parsed state.
 */
export function importSceneFromJson(jsonFile: File): Promise<ISandboxExportedState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const resultText = event.target?.result as string;
        if (!resultText) {
          throw new Error("File is empty or could not be read.");
        }

        const parsedData = JSON.parse(resultText);

        // Basic schema validation
        if (typeof parsedData !== "object" || parsedData === null) {
          throw new Error("Invalid format: JSON must be an object.");
        }

        if (typeof parsedData.backgroundId !== "string") {
          throw new Error("Invalid format: backgroundId must be a string.");
        }

        if (typeof parsedData.dialogue !== "object" || parsedData.dialogue === null) {
          throw new Error("Invalid format: dialogue must be an object.");
        }

        if (typeof parsedData.dialogue.speakerName !== "string" || typeof parsedData.dialogue.dialogueText !== "string") {
          throw new Error("Invalid format: dialogue speakerName and dialogueText must be strings.");
        }

        if (!Array.isArray(parsedData.characters)) {
          throw new Error("Invalid format: characters must be an array.");
        }

        // Validate each character record
        for (const char of parsedData.characters) {
          if (typeof char.charId !== "string" || typeof char.costumeId !== "string") {
            throw new Error("Invalid format: character charId and costumeId must be strings.");
          }
          if (typeof char.motion !== "string" || typeof char.facial !== "string") {
            throw new Error("Invalid format: character motion and facial must be strings.");
          }
          if (char.headDirection !== undefined && typeof char.headDirection !== "string") {
            throw new Error("Invalid format: character headDirection must be a string.");
          }
          if (typeof char.position !== "object" || char.position === null) {
            throw new Error("Invalid format: character position must be an object.");
          }
          if (typeof char.position.x !== "number" || typeof char.position.y !== "number" || typeof char.position.scale !== "number") {
            throw new Error("Invalid format: character coordinates (x, y, scale) must be numbers.");
          }
        }

        resolve(parsedData as ISandboxExportedState);
      } catch (error: any) {
        reject(new Error(`JSON schema validation failed: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };

    reader.readAsText(jsonFile);
  });
}
