declare const PI: number;
declare const displayWidth: number;
declare const displayHeight: number;
declare const width: number;
declare const height: number;

declare function random(): number;
declare function random(max: number): number;
declare function random(min: number, max: number): number;
declare function random<T>(values: T[]): T;

declare function sin(value: number): number;
declare function cos(value: number): number;
declare function createCanvas(width: number, height: number): void;
declare function pixelDensity(value: number): void;
declare function createImage(width: number, height: number): P5Image;
declare function image(img: P5Image, x: number, y: number, width?: number, height?: number): void;
declare function background(gray: number): void;
declare function clear(): void;
declare function noLoop(): void;
declare function loop(): void;
declare function stroke(r: number, g?: number, b?: number, a?: number): void;
declare function strokeWeight(value: number): void;
declare function point(x: number, y: number): void;
declare function textSize(size: number): void;
declare function text(value: string, x: number, y: number): void;
declare function fill(r: number, g?: number, b?: number, a?: number): void;
declare function noStroke(): void;
declare function saveJSON(data: unknown, filename: string): void;
declare function createButton(label: string): P5Button;
declare function createFileInput(callback: (file: P5File) => void, multiple?: boolean): P5FileInput;

interface P5Image {
  pixels: number[];
  loadPixels(): void;
  updatePixels(): void;
}

interface P5Element {
  position(x: number, y: number): void;
}

interface P5Button extends P5Element {
  mousePressed(callback: () => void): void;
}

interface P5FileInput extends P5Element {}

interface P5File {
  name: string;
  data: unknown;
  type?: string;
  subtype?: string;
  size?: number;
}
