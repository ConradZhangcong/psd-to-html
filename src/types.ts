export interface FontInfo {
  fontName: string;
  postScriptName: string;
  fontSize?: number;
  fillColor?: { r: number; g: number; b: number; a: number };
}

export interface TextSegment {
  text: string;
  fontName: string;
  fontSize: number;
  color: { r: number; g: number; b: number; a: number };
  alignment: string;
  letterSpacing?: number;
  lineHeight?: number;
}

export interface LayerImageData {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface LayerInfo {
  id: string;
  index: number;
  name: string;
  type: 'text' | 'image' | 'group' | 'div';
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  text?: {
    content: string;
    fontName: string;
    fontSize: number;
    color: { r: number; g: number; b: number; a: number };
    alignment?: string;
    letterSpacing?: number;
    lineHeight?: number;
    segments?: TextSegment[];
  };
  imagePath?: string;
  imageData?: LayerImageData;
  children?: LayerInfo[];
}
