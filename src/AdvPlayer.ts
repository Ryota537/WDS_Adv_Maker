import { Container, Assets } from "pixi.js";
//views
import { BackgroundView } from "./views/BackgroundView";
import { CharacterView } from "./views/CharacterView";
import { EffectView } from "./views/EffectView";
import { TextView } from "./views/TextView";
//constant
import { baseAssets, Layer } from "./constant/advConstant";
//utils
import { createEmptySprite } from "./utils/emptySprite";
import { exportSceneToJson, importSceneFromJson } from "./utils/sandboxStorage";

export class AdvPlayer extends Container<any> {
  //init
  protected _inited: boolean = false;
  protected _isSandboxMode: boolean = false;

  get isSandboxMode(): boolean {
    return this._isSandboxMode;
  }

  set isSandboxMode(val: boolean) {
    this._isSandboxMode = val;
  }

  //View
  protected _backgroundView!: BackgroundView;
  protected _characterView!: CharacterView;
  protected _effectView!: EffectView;
  protected _textView!: TextView;

  constructor() {
    super();

    //advPlayer setting
    this.addChild(createEmptySprite({ empty: true, color: 0x000000 }));
    this.sortableChildren = true;
    this.eventMode = "static";
  }

  public static async create<C extends Container>(pixiapp?: C): Promise<AdvPlayer> {
    const self = new this();
    if (pixiapp) {
      self.addTo(pixiapp);
    }
    await self.init();
    return self;
  }

  public async init() {
    // Load player base assets bundle
    Assets.addBundle('baseAssets', baseAssets);
    await Assets.loadBundle('baseAssets');

    //views
    this._textView = new TextView().addTo(this, Layer.TextLayer);
    this._effectView = new EffectView().addTo(this, Layer.EffectLayer);
    this._characterView = new CharacterView().addTo(this._effectView, Layer.CharacterLayer);
    this._backgroundView = new BackgroundView().addTo(this._effectView, Layer.BackgroundLayer);

    this._inited = true;
  }

  public addTo<C extends Container>(parent: C): AdvPlayer {
    parent.addChild(this);
    return this;
  }

  public async clear() {
    this._backgroundView.clear();
    this._characterView.clear();
    this._effectView.clear();
    this._textView.clear();
  }

  public async setSandboxBackground(bgId: string) {
    await this._backgroundView.setSandboxBackground(bgId);
  }

  public async updateSandboxCharacter(
    charId: string,
    costumeId: string,
    motion: string,
    facial: string,
    headDirection: string,
    position: { x: number, y: number, scale: number }
  ) {
    await this._characterView.updateSandboxCharacter(charId, costumeId, motion, facial, headDirection, position);
  }

  public removeSandboxCharacter(charId: string) {
    this._characterView.removeSandboxCharacter(charId);
  }

  public setSandboxText(speakerName: string, dialogueText: string) {
    this._textView.setSandboxText(speakerName, dialogueText);
  }

  public setDialogueBoxVisible(visible: boolean) {
    this._textView.setDialogueBoxVisible(visible);
  }

  public setDialogueRTL(enabled: boolean) {
    this._textView.setRTLMode(enabled);
  }

  public setSandboxSepia(visible: boolean) {
    this._effectView.setSepia(visible);
  }

  public setSandboxWhiteBlur(visible: boolean) {
    this._effectView.setWhiteBlur(visible);
  }

  public getSandboxSepia(): boolean {
    return this._effectView.getSepia();
  }

  public getSandboxWhiteBlur(): boolean {
    return this._effectView.getWhiteBlur();
  }

  public getSandboxState() {
    return {
      backgroundId: this._backgroundView.currentBGId,
      dialogue: {
        ...this._textView.sandboxText,
        visible: this._textView.getDialogueBoxVisible(),
        rtl: this._textView.getRTLMode()
      },
      characters: this._characterView.getSandboxCharactersState(),
      effects: {
        sepia: this.getSandboxSepia(),
        whiteBlur: this.getSandboxWhiteBlur()
      }
    };
  }

  public async applySandboxState(state: any) {
    if (!state) return;

    // Restore Background
    if (state.backgroundId) {
      await this.setSandboxBackground(state.backgroundId);
    }

    // Restore Text/Dialogue
    if (state.dialogue) {
      this.setDialogueBoxVisible(state.dialogue.visible !== false);
      this.setDialogueRTL(!!state.dialogue.rtl);
      this.setSandboxText(state.dialogue.speakerName || '', state.dialogue.dialogueText || '');
    }

    // Restore Effects
    if (state.effects) {
      this.setSandboxSepia(!!state.effects.sepia);
      this.setSandboxWhiteBlur(!!state.effects.whiteBlur);
    } else {
      this.setSandboxSepia(false);
      this.setSandboxWhiteBlur(false);
    }

    // Restore Characters
    this._characterView.clear();
    if (Array.isArray(state.characters)) {
      for (const char of state.characters) {
        await this.updateSandboxCharacter(
          char.charId,
          char.costumeId,
          char.motion,
          char.facial,
          char.headDirection || "head/normal",
          char.position
        );
      }
    }
  }

  public getBones(charId: string) {
    return this._characterView.getBones(charId);
  }

  public setBoneTransform(charId: string, boneName: string, rotation?: number, scaleX?: number, scaleY?: number) {
    this._characterView.setBoneTransform(charId, boneName, rotation, scaleX, scaleY);
  }

  public getAnimations(charId: string) {
    return this._characterView.getAnimations(charId);
  }

  public scrubAnimation(charId: string, trackIndex: number, animName: string, progressRatio: number) {
    this._characterView.scrubAnimation(charId, trackIndex, animName, progressRatio);
  }

  public resetToSetupPose(charId: string) {
    this._characterView.resetToSetupPose(charId);
  }

  public setHandGesture(charId: string, side: 'L' | 'R', type: string) {
    this._characterView.setHandGesture(charId, side, type);
  }

  public resetHandGestures(charId: string) {
    this._characterView.resetHandGestures(charId);
  }

  public getCharacterInstance(charId: string) {
    return this._characterView.getCharacterInstance(charId);
  }

  public exportSceneToJson() {
    exportSceneToJson(this.getSandboxState());
  }

  public importSceneFromJson = async (jsonFile: File) => {
    try {
      const state = await importSceneFromJson(jsonFile);
      await this.applySandboxState(state);
      return true;
    } catch (error) {
      console.error("Failed to import scene from JSON:", error);
      throw error;
    }
  };

  public async exportSceneToImage() {
    const pixiapp = (globalThis as any).__PIXI_APP__;
    if (!pixiapp || !pixiapp.renderer) {
      console.error("PixiJS Application/Renderer not found.");
      return;
    }

    try {
      // Force render the stage immediately
      pixiapp.render();

      // Extract image directly from the canvas
      const base64 = pixiapp.canvas.toDataURL('image/png');

      // Create download link and trigger download
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", base64);
      downloadAnchor.setAttribute("download", "wds_sandbox_capture.png");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (error) {
      console.error("Failed to export scene to image:", error);
    } finally {
      pixiapp.render();
    }
  }
}
