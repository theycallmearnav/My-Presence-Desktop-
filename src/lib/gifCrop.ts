import { parseGIF, decompressFrames, type ParsedFrame } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type GifCropParams = {
  /** Natural pixel size of the source GIF. */
  naturalW: number;
  naturalH: number;
  /** Scale that makes the GIF "cover" the editor box at zoom = 1. */
  coverScale: number;
  /** Zoom multiplier chosen in the editor. */
  zoom: number;
  /** Pan offset (in editor-box pixels). */
  offset: { x: number; y: number };
  /** The square editor box size the offsets/scale are expressed in. */
  box: number;
  /** Output square size to re-encode at. */
  output: number;
};

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Crop + zoom an animated GIF while keeping it animated. Decodes every frame,
 * composites them (honouring frame disposal), applies the same crop transform
 * the still-image editor uses, and re-encodes a fresh animated GIF.
 *
 * Returns the encoded GIF bytes, ready to upload as image/gif.
 */
export async function cropAnimatedGif(bytes: ArrayBuffer, params: GifCropParams): Promise<Uint8Array> {
  const { naturalW, naturalH, coverScale, zoom, offset, box, output } = params;

  const parsed = parseGIF(bytes);
  const frames: ParsedFrame[] = decompressFrames(parsed, true);
  if (!frames.length) throw new Error('That GIF has no frames.');

  const W = parsed.lsd.width;
  const H = parsed.lsd.height;

  // Persistent canvas we composite each frame onto (GIF disposal is stateful).
  const stage = makeCanvas(W, H);
  const stageCtx = stage.getContext('2d', { willReadFrequently: true });
  // Small scratch canvas to turn a frame's raw patch into something drawable.
  const patchCanvas = makeCanvas(W, H);
  const patchCtx = patchCanvas.getContext('2d', { willReadFrequently: true });
  // Output canvas we draw the cropped region into, one frame at a time.
  const out = makeCanvas(output, output);
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!stageCtx || !patchCtx || !outCtx) throw new Error('Could not prepare the GIF canvas.');
  outCtx.imageSmoothingQuality = 'high';

  // Same math as the still cropper: scale the source to cover, then pan.
  const scale = coverScale * zoom;
  const drawW = naturalW * scale;
  const drawH = naturalH * scale;
  const boxToOut = output / box;
  const dx = ((box - drawW) / 2 + offset.x) * boxToOut;
  const dy = ((box - drawH) / 2 + offset.y) * boxToOut;
  const outW = drawW * boxToOut;
  const outH = drawH * boxToOut;

  const enc = GIFEncoder();
  let prev: ParsedFrame | null = null;

  for (const frame of frames) {
    // Honour the previous frame's disposal before drawing this one.
    if (prev && prev.disposalType === 2) {
      const { left, top, width, height } = prev.dims;
      stageCtx.clearRect(left, top, width, height);
    }

    const { left, top, width, height } = frame.dims;
    const patchData = new ImageData(new Uint8ClampedArray(frame.patch), width, height);
    patchCtx.clearRect(0, 0, W, H);
    patchCtx.putImageData(patchData, left, top);
    stageCtx.drawImage(patchCanvas, 0, 0);

    // Draw the cropped/zoomed region of the composited frame into the output.
    outCtx.clearRect(0, 0, output, output);
    outCtx.drawImage(stage, dx, dy, outW, outH);

    const { data } = outCtx.getImageData(0, 0, output, output);
    const rgba = new Uint8Array(data.buffer);
    const palette = quantize(rgba, 256, { format: 'rgba4444', oneBitAlpha: true });
    const index = applyPalette(rgba, palette, 'rgba4444');
    const transparentIndex = palette.findIndex((c) => c.length > 3 && c[3] === 0);

    enc.writeFrame(index, output, output, {
      palette,
      delay: frame.delay || 100,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
      dispose: 2
    });

    prev = frame;
    // Yield so a long GIF doesn't lock up the UI thread while encoding.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  enc.finish();
  return enc.bytes();
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
