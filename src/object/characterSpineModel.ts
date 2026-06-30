import { Container, Sprite, Assets } from "pixi.js";
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { CharacterAppearanceTypes, CharacterPositions } from "../types/Episode";
import LoopMotion from "../constant/LoopMotion";
import ChangeBodyMotion from "../constant/ChangeBodyMotion";
import BodyMotion from "../constant/BodyMotion";
import FacialExpression from "../constant/FacialExpression";
import HeadDirection from "../constant/HeadDirection";

export interface characterAnimation {
    bodyAnimationName : string,
    eyebrowAnimationName : string, //EyeBrow
    eyeMotionName : string, //Eye
    eyeAnimationName : string, //EyeBlink
    mouthAnimationName : string,
    headAnimationName : string,
    cheekAnimationName : string,
    headMotionName : string,
    FacialExpressionMasterId? : number
}

export interface ILoopMotion {
    Id: number;
    TargetCharacterBaseId: string;
    LoopSpeed: number;
    Height: number;
    Size: number; // 1 | 2
}

export class AdventureAnimationStandCharacter {

    protected _model : Spine;
    protected _spineId : number | undefined;
    protected _charId : string = '';
    protected _slotNumber : number = 0;
    protected _characterPosition : CharacterPositions = CharacterPositions.None;
    protected _appearanceType : CharacterAppearanceTypes = CharacterAppearanceTypes.FadeIn
    protected _motions : Partial<characterAnimation> = {}
    protected _loopMotionData: ILoopMotion | undefined
    protected _eyeBlinkTimeout : number | NodeJS.Timeout | undefined;

    public activeGesture = { L: "", R: "" };
    public activeAnimationScrubbers = new Map<string, number>();

    constructor(spineId : number) {
        this._spineId = spineId;
        this._charId = `${this._spineId}`.slice(0, 3);
        //create spine model
        this._model = Spine.from({
            skeleton : `spine_${spineId}`,
            atlas : `spine_atlas_${spineId}`
        });
        this._model.label = this._charId;
        this._loopMotionData = LoopMotion.find((lm) => lm.TargetCharacterBaseId === this._charId);
        // clac the y position
        switch(this._loopMotionData?.Size ?? 1){
            case 1:
                this._model.scale.set(0.77);
                this._model.y = 1000;
                break;
            case 2:
                this._model.scale.set(0.79);
                this._model.y = (1080 + ((158 - this._loopMotionData!.Height) * 9)) || 1080;
                break;
            default:
                this._model.scale.set(0.79);
                this._model.y = 1080;
                break;
        }
    }

    addTo<T extends Container>(parent : T, order: number = 0){
        parent.addChild(this._model);
        this._model.zIndex = order;
    }

    changeSlotNumber(slotNumber : number){
        this._slotNumber = slotNumber;
    }

    changePosition(position : CharacterPositions){
        switch(position){
            case CharacterPositions.Center:
                this._model.x = 1920/2;
                this._model.zIndex = 0;
                break;
            case CharacterPositions.InnerLeft:
                this._model.x = 1920/2 - 320;
                this._model.zIndex = 1
                break;
            case CharacterPositions.InnerRight:
                this._model.x = 1920/2 + 320;
                this._model.zIndex = -1
                break;
            case CharacterPositions.OuterLeft:
                this._model.x = 1920/2 - 495;
                this._model.zIndex = 1
                break;
            case CharacterPositions.OuterRight:
                this._model.x = 1920/2 + 495;
                this._model.zIndex = -1
                break;
            default:
                this._model.x = 1920/2;
                break;
        }
    }

    setScale(size : number = 0.75){
        this._model.scale.set(size);
    }

    setCharacterLayer(layer : number){
        this._model.zIndex = layer;
    }
    
    SetAllAnimation(
        characterAnimation : Partial<characterAnimation>,
        _loopMotionSpeed : number = this._loopMotionData?.LoopSpeed || 1,
    ){
        const { 
            bodyAnimationName, 
            eyebrowAnimationName, 
            eyeAnimationName, 
            eyeMotionName, 
            mouthAnimationName, 
            cheekAnimationName, 
            headAnimationName, 
            headMotionName,
            FacialExpressionMasterId
        } = characterAnimation

        if(bodyAnimationName){    
            let motion = ChangeBodyMotion.find(({BeforeMotionName, AfterMotionName}) => BeforeMotionName == this._motions.bodyAnimationName && AfterMotionName == bodyAnimationName);
            // esoteric官方的mixDuration必须在第一次update前设置才可以生效，这里关闭autoUpdate，设置完mixDuration后再打开
            this._model.autoUpdate = false;
            let entry = this._model.state.setAnimation(1, bodyAnimationName, false)
            entry.mixDuration = motion ? motion.Second : 0.3;
            this._model.update(0);
            this._model.autoUpdate = true;
        }

        if(eyebrowAnimationName && this.checkhasAnimation(eyebrowAnimationName) && eyebrowAnimationName !== this._motions.eyebrowAnimationName){
            const anim = this._model.state.setAnimation(2, eyebrowAnimationName, false);
            anim.timeScale = 0;
        }

        if(eyeMotionName){
            const anim = this._model.state.setAnimation(3, eyeMotionName, false);
            anim.trackTime = 1;
        }
        
        //如果是新表情 則重設眨眼動作
        if(FacialExpressionMasterId){
            clearTimeout(this._eyeBlinkTimeout);
        }

        //如果有眨眼動作則重設眨眼動作並且眨眼, 如果沒有眨眼動作則沿用用上一次
        if(eyeAnimationName){
            clearTimeout(this._eyeBlinkTimeout);
            // Disabled eye blinking as requested
            // this._eyeBlinkAnimation(4, eyeAnimationName, 3.5);
        }

        if(eyeMotionName && !eyeAnimationName){
            this._model.state.setEmptyAnimation(4);
        }
        
        if(mouthAnimationName){
            this._model.state.setAnimation(5, mouthAnimationName, true);
        }

        if(cheekAnimationName){
            this._model.state.setAnimation(6, cheekAnimationName, true);
        }

        if(headAnimationName){
            this._model.state.setAnimation(7, headAnimationName, false);
        }

        if(headMotionName){
            this._model.state.setAnimation(8, headMotionName, false);
        }

        this._motions = { ...this._motions, ...characterAnimation };
    }

    _eyeBlinkAnimation(trackIndex: number, animationName: string, time : number = 1){
        this._model.state.setAnimation(trackIndex, animationName, false);
        const track = this._model.state.tracks[trackIndex];
        if (track) {
            track.listener = {
                complete : () => {
                    this._eyeBlinkTimeout = setTimeout(()=>{
                        clearTimeout(this._eyeBlinkTimeout);
                        this._eyeBlinkAnimation(trackIndex, animationName, time);
                    }, time * 1000)
                }
            }
        }
    }

    onLipSync() : void{
        if(this._model.state.tracks[5]){
            this._model.state.tracks[5].loop = true;
        }
    }

    offLipSync() : void{
        let lipTrack = this._model.state.tracks[5];
        if(lipTrack){
            lipTrack.loop = false;
            lipTrack.timeScale = 0;
            lipTrack.trackTime = 0;
        }
    }

    hideCharacter(){
        //還原bodyAnimation + 要停止update
        clearTimeout(this._eyeBlinkTimeout);
        const clearTrack =  this._model.state.setEmptyAnimation(1, 0);
        clearTrack.listener = {
            complete: () => {
                if(this._model.visible){
                    this._model.autoUpdate = false;
                    this._model.visible = false;
                }
            }
        }
    }

    checkhasAnimation(animationName : string){
        return this._model.skeleton.data.findAnimation(animationName) !== null;
    }

    showCharacter(visible : boolean = true){
        if (!this._model.autoUpdate){
            this._model.update(0);
            this._model.autoUpdate = true; // 如果不放在 if 里面，在场上且没新动作的角色动画会越来越快
        }
        this._model.visible = visible;
    }

    destory(){
        this._model.destroy();
    }

    get slotNumber(){
        return this._slotNumber;
    }

    get spineId(){
        return this._spineId;
    }

    set visible(bool : boolean){
        this._model.visible = bool;
    }

    get visible(){
        return this._model.visible;
    }

    get zIndex(): number {
        return this._model.zIndex;
    }

    set zIndex(val: number) {
        this._model.zIndex = val;
    }

    get charId(){
        return this._charId;
    }

    get model() {
        return this._model;
    }

    get costumeId(): string {
        return String(this._spineId).slice(3);
    }

    get currentMotion(): string {
        return this._motions.bodyAnimationName || "";
    }

    get currentFacial(): number {
        return this._motions.FacialExpressionMasterId || 0;
    }

    get currentHeadDirection(): string {
        return this._motions.headAnimationName || "";
    }

    get sandboxState() {
        return {
            charId: this.charId,
            costumeId: this.costumeId,
            motion: this.currentMotion,
            facial: String(this.currentFacial),
            headDirection: this.currentHeadDirection,
            position: {
                x: this._model.x,
                y: this._model.y,
                scale: this._model.scale.x
            },
            zIndex: this.zIndex
        };
    }

    setPositionCoords(x: number, y: number) {
        this._model.x = x;
        this._model.y = y;
    }

    setHeadDirection(direction: string | number) {
        let directionName = "";
        if (typeof direction === "number" || !isNaN(Number(direction))) {
            const id = typeof direction === "number" ? direction : parseInt(direction, 10);
            const found = HeadDirection.find((hd) => hd.Id === id);
            if (found) {
                directionName = found.DirectionName;
            }
        } else {
            directionName = direction as string;
        }

        if (directionName && this.checkhasAnimation(directionName)) {
            this._model.state.setAnimation(7, directionName, false);
            this._motions.headAnimationName = directionName;
        }
    }

    setBodyMotion(motion: string | number) {
        let motionName = "";
        if (typeof motion === "number" || !isNaN(Number(motion))) {
            const id = typeof motion === "number" ? motion : parseInt(motion, 10);
            const found = BodyMotion.find((bm) => bm.Id === id);
            if (found) {
                motionName = found.MotionName;
            }
        } else {
            motionName = motion as string;
        }

        if (motionName && this.checkhasAnimation(motionName)) {
            let beforeMotionName = this._motions.bodyAnimationName;
            let mixDuration = 0.3;
            if (beforeMotionName) {
                let changeMotion = ChangeBodyMotion.find(({BeforeMotionName, AfterMotionName}) => 
                    BeforeMotionName === beforeMotionName && AfterMotionName === motionName
                );
                if (changeMotion) {
                    mixDuration = changeMotion.Second;
                }
            }
            this._model.autoUpdate = false;
            let entry = this._model.state.setAnimation(1, motionName, false);
            entry.mixDuration = mixDuration;
            this._model.update(0);
            this._model.autoUpdate = true;
            this._motions.bodyAnimationName = motionName;
        }
    }

    setFacialExpression(expression: string | number) {
        let expressionData;
        if (typeof expression === "number" || !isNaN(Number(expression))) {
            const id = typeof expression === "number" ? expression : parseInt(expression, 10);
            expressionData = FacialExpression.find((fe) => fe.Id === id);
        }

        if (expressionData) {
            const characterAnimation: Partial<characterAnimation> = {};
            characterAnimation.eyebrowAnimationName = expressionData.EyeBrow;
            characterAnimation.eyeMotionName = expressionData.Eye;
            characterAnimation.eyeAnimationName = expressionData.EyeBlink ?? undefined;
            characterAnimation.cheekAnimationName = expressionData.Cheek;
            characterAnimation.mouthAnimationName = expressionData.Mouth;
            characterAnimation.FacialExpressionMasterId = expressionData.Id;
            
            this.SetAllAnimation(characterAnimation);
        }
    }

    // --- Deep Spine APIs for Custom Mode ---

    getBones() {
        return this._model.skeleton.bones;
    }

    setBoneTransform(boneName: string, rotation?: number, scaleX?: number, scaleY?: number) {
        const bone = this._model.skeleton.findBone(boneName);
        if (!bone) return;
        if (rotation !== undefined) bone.rotation = rotation;
        if (scaleX !== undefined) bone.scaleX = scaleX;
        if (scaleY !== undefined) bone.scaleY = scaleY;
    }

    getAnimations() {
        return this._model.skeleton.data.animations;
    }

    scrubAnimation(trackIndex: number, animName: string, progressRatio: number) {
        const anim = this._model.skeleton.data.findAnimation(animName);
        if (!anim) return;

        const entry = this._model.state.setAnimation(trackIndex, animName, false);
        entry.timeScale = 0; // pause playback
        entry.trackTime = progressRatio * anim.duration;
        this.activeAnimationScrubbers.set(animName, progressRatio);
    }

    resetToSetupPose() {
        clearTimeout(this._eyeBlinkTimeout);
        // Clear all tracks
        this._model.state.clearTracks();
        this._model.skeleton.setToSetupPose();
        this._motions = {};
        this.activeGesture = { L: "", R: "" };
        this.activeAnimationScrubbers.clear();
    }

    setHandGesture(side: 'L' | 'R', type: string) {
        const slotRegex = new RegExp(side + "[A-H]2?$");
        const targetSuffix = side + type;

        for (const slot of this._model.skeleton.slots) {
            const slotName = slot.data.name;
            if (!slotRegex.test(slotName)) continue;

            const isActive = slotName.endsWith(targetSuffix) || slotName.endsWith(targetSuffix + "2");
            const alphaValue = isActive ? 1 : 0;

            Object.defineProperty(slot.color, 'a', {
                get() { return alphaValue; },
                set() { /* blocked — engine can't reset this */ },
                configurable: true,
                enumerable: true,
            });
        }

        (this._model as any).spineAttachmentsDirty = true;
        this.activeGesture[side] = type;
    }

    resetHandGestures() {
        const slotRegex = /[LR][A-H]2?$/;
        for (const slot of this._model.skeleton.slots) {
            if (!slotRegex.test(slot.data.name)) continue;
            // Restore normal property behavior
            delete (slot.color as any).a;
        }
        (this._model as any).spineAttachmentsDirty = true;
        this.activeGesture.L = "";
        this.activeGesture.R = "";
    }
}

export class CustomStaticCharacter {
    protected _model : Sprite;
    protected _charId : string;
    protected _slotNumber : number = 0;
    
    constructor(charId: string, textureKey: string) {
        this._charId = charId;
        const texture = Assets.get(textureKey);
        this._model = new Sprite(texture);
        this._model.anchor.set(0.5, 0.5);
        this._model.label = this._charId;
        this._model.x = 1920 / 2;
        this._model.y = 1080 / 2;
        this._model.scale.set(0.5);
    }

    addTo<T extends Container>(parent : T, order: number = 0){
        parent.addChild(this._model);
        this._model.zIndex = order;
    }

    changeSlotNumber(slotNumber : number){
        this._slotNumber = slotNumber;
    }

    changePosition(position: any) {
        // no-op
    }

    setScale(size : number = 0.5){
        this._model.scale.set(size);
    }

    setPositionCoords(x: number, y: number) {
        this._model.x = x;
        this._model.y = y;
    }

    showCharacter(visible : boolean = true){
        this._model.visible = visible;
    }

    destory(){
        this._model.destroy();
    }

    get slotNumber(){
        return this._slotNumber;
    }

    get spineId(){
        return 0;
    }

    set visible(bool : boolean){
        this._model.visible = bool;
    }

    get visible(){
        return this._model.visible;
    }

    get zIndex(): number {
        return this._model.zIndex;
    }

    set zIndex(val: number) {
        this._model.zIndex = val;
    }

    get charId(){
        return this._charId;
    }

    get model() {
        return this._model;
    }

    get costumeId(): string {
        return "";
    }

    get currentMotion(): string {
        return "";
    }

    get currentFacial(): number {
        return 0;
    }

    get currentHeadDirection(): string {
        return "";
    }

    get sandboxState() {
        return {
            charId: this.charId,
            costumeId: this.costumeId,
            motion: this.currentMotion,
            facial: String(this.currentFacial),
            headDirection: this.currentHeadDirection,
            position: {
                x: this._model.x,
                y: this._model.y,
                scale: this._model.scale.x
            },
            isCustomImage: true,
            zIndex: this.zIndex
        };
    }

    offLipSync() {}
    onLipSync() {}
    hideCharacter() {
        this._model.visible = false;
    }
    setBodyMotion(motion: any) {}
    setFacialExpression(facial: any) {}
    setHeadDirection(dir: any) {}
    getBones() { return []; }
    setBoneTransform() {}
    getAnimations() { return []; }
    scrubAnimation() {}
    resetToSetupPose() {}
    setHandGesture() {}
    resetHandGestures() {}
}

