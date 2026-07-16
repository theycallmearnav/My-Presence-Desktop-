import { Loader2, Move, RotateCcw, X, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageFit } from '../../lib/types';
import { base64ToArrayBuffer, bytesToBase64, cropAnimatedGif } from '../../lib/gifCrop';
import { Button } from '../ui/Button';

type Props = {
  /** The current direct image URL being edited. */
  url: string;
  /** Current fit for this slot (used as the starting point for GIFs). */
  fit: ImageFit;
  /** Called with the new URL (stills, after re-upload) and/or fit (GIFs). */
  onApply: (result: { url?: string; fit?: ImageFit }) => void;
  onClose: () => void;
};

// The editor works on a fixed square that mirrors Discord's artwork box.
const BOX = 320;
// What we re-upload cropped stills at — a crisp square Discord is happy with.
const OUTPUT = 512;

export function ImageCropModal({ url, fit, onApply, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [mime, setMime] = useState<string>('');
  const [animated, setAnimated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Pan (in box pixels) + zoom multiplier for the still-image cropper.
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gifFit, setGifFit] = useState<ImageFit>(fit);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const dragState = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  // Load the image via the desktop bridge as a data URL (CORS-safe for canvas).
  useEffect(() => {
    let cancelled = false;
    const bridge = window.myPresenceDesktop;
    setLoading(true);
    setError('');
    (async () => {
      if (!bridge?.fetchImageAsDataUrl) {
        // Browser fallback: use the URL directly (crop won't work, but Fit will).
        if (!cancelled) {
          setDataUrl(url);
          setMime(/\.gif(\?|#|$)/i.test(url) ? 'image/gif' : 'image/png');
          setAnimated(/\.gif(\?|#|$)/i.test(url));
          setLoading(false);
        }
        return;
      }
      const result = await bridge.fetchImageAsDataUrl(url);
      if (cancelled) return;
      if (result.ok) {
        setDataUrl(result.dataUrl);
        setMime(result.mime);
        setAnimated(result.animated);
      } else {
        setError(result.error);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const isGif = mime === 'image/gif';
  // Everything is crop + zoom now, including animated GIFs — we re-encode the
  // GIF frame-by-frame so it stays animated after cropping.
  const cropMode = true;

  // The scale that makes the image "cover" the box at zoom = 1.
  const coverScale = useMemo(() => {
    if (!natural.w || !natural.h) return 1;
    return Math.max(BOX / natural.w, BOX / natural.h);
  }, [natural]);

  const onImgLoad = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Clamp panning so you can't drag the image off the covered area.
  const clampOffset = useCallback(
    (x: number, y: number, z: number) => {
      const scale = coverScale * z;
      const w = natural.w * scale;
      const h = natural.h * scale;
      const maxX = Math.max(0, (w - BOX) / 2);
      const maxY = Math.max(0, (h - BOX) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y))
      };
    },
    [coverScale, natural]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cropMode) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const { startX, startY, ox, oy } = dragState.current;
    setOffset(clampOffset(ox + (e.clientX - startX), oy + (e.clientY - startY), zoom));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragState.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleZoom = (z: number) => {
    setZoom(z);
    setOffset((o) => clampOffset(o.x, o.y, z));
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Draw the visible crop into a canvas and re-upload it. Animated GIFs are
  // re-encoded frame-by-frame so they stay animated; everything else is a
  // single flattened frame.
  const applyCrop = async () => {
    const el = imgRef.current;
    if (!el) return;
    setSaving(true);
    setError('');
    try {
      const bridge = window.myPresenceDesktop;
      if (!bridge?.uploadImageBytes) {
        throw new Error('Saving the crop needs the desktop app.');
      }

      let base64: string;
      let outMime: string;

      if (isGif && animated) {
        // Re-encode the animated GIF with the chosen crop/zoom/pan applied.
        const sourceBase64 = dataUrl.split(',')[1] ?? '';
        const bytes = await cropAnimatedGif(base64ToArrayBuffer(sourceBase64), {
          naturalW: natural.w,
          naturalH: natural.h,
          coverScale,
          zoom,
          offset,
          box: BOX,
          output: OUTPUT
        });
        base64 = bytesToBase64(bytes);
        outMime = 'image/gif';
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not prepare the image.');

        const scale = coverScale * zoom;
        const drawW = natural.w * scale;
        const drawH = natural.h * scale;
        // Top-left of the image relative to the box, then scale box→output.
        const boxToOut = OUTPUT / BOX;
        const dx = (BOX - drawW) / 2 + offset.x;
        const dy = (BOX - drawH) / 2 + offset.y;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(el, dx * boxToOut, dy * boxToOut, drawW * boxToOut, drawH * boxToOut);

        outMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        base64 = canvas.toDataURL(outMime, 0.92).split(',')[1];
      }

      const result = await bridge.uploadImageBytes(base64, outMime);
      if (!result.ok) {
        throw new Error('error' in result ? result.error : 'Upload failed.');
      }
      onApply({ url: result.url, fit: 'fill' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the crop.');
    } finally {
      setSaving(false);
    }
  };

  const applyFit = () => {
    onApply({ fit: gifFit });
    onClose();
  };

  return (
    <div className="crop-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="crop-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="crop-modal-head">
          <div>
            <p className="eyebrow">Adjust picture</p>
            <h3>{cropMode ? 'Crop & zoom' : 'Fit your GIF'}</h3>
          </div>
          <button className="crop-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="crop-stage crop-loading">
            <Loader2 className="spin" size={26} />
            <span>Loading image…</span>
          </div>
        ) : error && !dataUrl ? (
          <div className="crop-stage crop-loading">
            <span className="crop-error">{error}</span>
          </div>
        ) : (
          <>
            <div
              className={cropMode ? 'crop-stage' : 'crop-stage no-drag'}
              style={{ width: BOX, height: BOX }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {cropMode ? (
                <img
                  ref={imgRef}
                  src={dataUrl}
                  alt="Crop source"
                  className="crop-image"
                  draggable={false}
                  onLoad={onImgLoad}
                  style={{
                    width: natural.w * coverScale * zoom,
                    height: natural.h * coverScale * zoom,
                    transform: `translate(${offset.x}px, ${offset.y}px)`
                  }}
                />
              ) : (
                <img
                  ref={imgRef}
                  src={dataUrl}
                  alt="Fit source"
                  className={gifFit === 'fill' ? 'crop-gif fill' : 'crop-gif fit'}
                  draggable={false}
                  onLoad={onImgLoad}
                />
              )}
              <div className="crop-grid-overlay" aria-hidden="true" />
            </div>

            {cropMode ? (
              <div className="crop-controls">
                <div className="crop-zoom-row">
                  <ZoomIn size={16} />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => handleZoom(Number(e.target.value))}
                    aria-label="Zoom"
                  />
                  <button type="button" className="crop-reset" onClick={reset}>
                    <RotateCcw size={13} /> Reset
                  </button>
                </div>
                <p className="crop-hint">
                  <Move size={13} /> Drag the picture to reposition · zoom to fill the square.
                </p>
              </div>
            ) : (
              <div className="crop-controls">
                <div className="crop-fit-toggle" role="group" aria-label="GIF fit">
                  <button
                    type="button"
                    className={gifFit === 'fill' ? 'is-active' : ''}
                    onClick={() => setGifFit('fill')}
                  >
                    Fill square
                    <small>Crops edges, no bars</small>
                  </button>
                  <button
                    type="button"
                    className={gifFit === 'fit' ? 'is-active' : ''}
                    onClick={() => setGifFit('fit')}
                  >
                    Fit whole
                    <small>Shows all, may add bars</small>
                  </button>
                </div>
                <p className="crop-hint">GIFs stay animated — pick how they sit in Discord's square.</p>
              </div>
            )}

            {error ? <p className="crop-error">{error}</p> : null}

            <div className="crop-actions">
              <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              {cropMode ? (
                <Button variant="primary" size="md" onClick={applyCrop} disabled={saving || !natural.w}>
                  {saving ? <Loader2 size={14} className="spin" /> : null}
                  {saving ? 'Saving…' : 'Apply crop'}
                </Button>
              ) : (
                <Button variant="primary" size="md" onClick={applyFit}>
                  Apply fit
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
