declare module 'three/examples/jsm/postprocessing/EffectComposer' {
    export class EffectComposer {
      constructor(renderer: any);
      addPass(pass: any): void;
      render(delta?: number): void;
      setSize(width: number, height: number): void;
    }
  }
  
  declare module 'three/examples/jsm/postprocessing/RenderPass' {
    export class RenderPass {
      constructor(scene: any, camera: any);
    }
  }
  
  declare module 'three/examples/jsm/postprocessing/UnrealBloomPass' {
    export class UnrealBloomPass {
      constructor(resolution: any, strength: number, radius: number, threshold: number);
    }
  }
  
  declare module 'three/examples/jsm/postprocessing/OutputPass' {
    export class OutputPass {
      constructor();
    }
  }
  
  declare module 'three/examples/jsm/objects/Reflector' {
    export class Reflector {
      constructor(geometry: any, options: any);
      position: any;
      rotation: any;
    }
  }
  