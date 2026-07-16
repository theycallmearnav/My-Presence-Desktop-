import { useCallback, useRef, useState } from 'react';
import { Check, Image, Import, Plus, Upload, Video, X } from 'lucide-react';
import { useAppStore, useActiveTheme } from '../../lib/store';
import type { BackgroundType, Theme } from '../../lib/types';
import { TextInput } from '../ui/forms';

const TYPE_OPTIONS: { value: BackgroundType; label: string; icon: typeof Image }[] = [
  { value: 'solid', label: 'Solid Color', icon: Image },
  { value: 'gradient', label: 'Gradient', icon: Image },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
];

export function BackgroundView() {
  const themes = useAppStore((s) => s.themes);
  const settings = useAppStore((s) => s.settings);
  const createTheme = useAppStore((s) => s.createTheme);
  const deleteTheme = useAppStore((s) => s.deleteTheme);
  const updateTheme = useAppStore((s) => s.updateTheme);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);
  const importTheme = useAppStore((s) => s.importTheme);
  const resetDefaultTheme = useAppStore((s) => s.resetDefaultTheme);
  const activeTheme = useActiveTheme();

  const [importError, setImportError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = useCallback(async (themeId: string) => {
    const bridge = window.myPresenceDesktop;
    if (!bridge?.uploadImage) {
      fileInputRef.current?.click();
      return;
    }
    const result = await bridge.uploadImage();
    if (result.ok) {
      updateTheme(themeId, (t) => ({ ...t, imageUrl: result.url, backgroundType: 'image' }));
    }
  }, [updateTheme]);

  const handleLocalImagePick = useCallback(async (themeId: string) => {
    const bridge = window.myPresenceDesktop;
    if (!bridge?.uploadImage) {
      // Fallback for browser: use blob URL but warn
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          updateTheme(themeId, (t) => ({ ...t, imageUrl: url, backgroundType: 'image' }));
        }
      };
      input.click();
      return;
    }
    // Use electron bridge for persistent upload
    const result = await bridge.uploadImage();
    if (result.ok) {
      updateTheme(themeId, (t) => ({ ...t, imageUrl: result.url, backgroundType: 'image' }));
    }
  }, [updateTheme]);

  const handleVideoPick = useCallback(async (themeId: string) => {
    const bridge = window.myPresenceDesktop;
    if (!bridge?.uploadVideo) {
      // Fallback for browser: use blob URL but warn
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/mp4,video/webm,video/quicktime';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          updateTheme(themeId, (t) => ({ ...t, videoUrl: url, backgroundType: 'video' }));
        }
      };
      input.click();
      return;
    }
    // Use electron bridge for persistent upload
    const result = await bridge.uploadVideo();
    if (result.ok) {
      updateTheme(themeId, (t) => ({ ...t, videoUrl: result.url, backgroundType: 'video' }));
    }
  }, [updateTheme]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ok = importTheme(reader.result as string);
        setImportError(ok ? '' : 'Invalid theme file');
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importTheme]);

  const handleCreateAndActivate = useCallback(() => {
    createTheme();
    const newThemeId = useAppStore.getState().themes[0]?.id;
    if (newThemeId) setActiveTheme(newThemeId);
  }, [createTheme, setActiveTheme]);

  const handleDrop = useCallback(async (e: React.DragEvent, themeId: string) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const bridge = window.myPresenceDesktop;
      if (bridge?.uploadImageBytes) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        const result = await bridge.uploadImageBytes(base64, file.type);
        if (result.ok) {
          updateTheme(themeId, (t) => ({ ...t, imageUrl: result.url, backgroundType: 'image' }));
        }
      } else {
        const url = URL.createObjectURL(file);
        updateTheme(themeId, (t) => ({ ...t, imageUrl: url, backgroundType: 'image' }));
      }
    } else if (file.type.startsWith('video/')) {
      const bridge = window.myPresenceDesktop;
      if (bridge?.uploadVideo) {
        // We need to write the file to a temp location first for the dialog
        // For drag-drop, we can create a temporary file
        const url = URL.createObjectURL(file);
        updateTheme(themeId, (t) => ({ ...t, videoUrl: url, backgroundType: 'video' }));
      } else {
        const url = URL.createObjectURL(file);
        updateTheme(themeId, (t) => ({ ...t, videoUrl: url, backgroundType: 'video' }));
      }
    }
  }, [updateTheme]);

  const isVideoType = activeTheme && (activeTheme.backgroundType === 'video');

  return (
    <div className="bg-view">
      {/* Current Background Preview */}
      <section className="bg-section bg-section-hero">
        <div
          className="bg-hero-preview"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => activeTheme && handleDrop(e, activeTheme.id)}
        >
          <BackgroundPreview theme={activeTheme} />
          {(activeTheme?.backgroundType === 'image' || activeTheme?.backgroundType === 'video') && (
            <div className={`bg-drop-overlay ${dragOver ? 'drag-over' : ''}`}>
              <Upload size={24} />
              <span>Drop file to change background</span>
            </div>
          )}
        </div>
      </section>

      {/* Type Selector */}
      <section className="bg-section">
        <h3 className="bg-section-label">Choose Background</h3>
        <div className="bg-type-grid">
          {TYPE_OPTIONS.map((type) => {
            const isActive = activeTheme?.backgroundType === type.value;
            return (
              <button
                key={type.value}
                className={`bg-type-card ${isActive ? 'active' : ''}`}
                onClick={() => activeTheme && updateTheme(activeTheme.id, (t) => ({ ...t, backgroundType: type.value as BackgroundType }))}
              >
                <type.icon size={18} />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Controls per type */}
      {activeTheme && (
        <section className="bg-section bg-section-controls">
          {activeTheme.backgroundType === 'solid' && (
            <div className="bg-color-picker-row">
              <input type="color" value={activeTheme.solidColor} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, solidColor: e.target.value }))} />
              <span className="bg-hex">{activeTheme.solidColor}</span>
            </div>
          )}

          {activeTheme.backgroundType === 'gradient' && (
            <>
              <div className="bg-color-picker-row">
                <label>Start</label>
                <input type="color" value={activeTheme.gradientStart} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, gradientStart: e.target.value }))} />
                <span className="bg-hex">{activeTheme.gradientStart}</span>
              </div>
              <div className="bg-color-picker-row">
                <label>End</label>
                <input type="color" value={activeTheme.gradientEnd} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, gradientEnd: e.target.value }))} />
                <span className="bg-hex">{activeTheme.gradientEnd}</span>
              </div>
              <div className="bg-slider-row">
                <label>Angle</label>
                <input type="range" min={0} max={360} value={activeTheme.gradientAngle} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, gradientAngle: Number(e.target.value) }))} />
                <span className="bg-slider-val">{activeTheme.gradientAngle}°</span>
              </div>
            </>
          )}

          {activeTheme.backgroundType === 'image' && (
            <div className="bg-upload-area">
              <div className="bg-upload-buttons">
                <button className="ui-button ui-button--outline ui-button--md" onClick={() => handleFilePick(activeTheme.id)}>
                  <Upload size={14} /> Upload Image
                </button>
                <button className="ui-button ui-button--outline ui-button--md" onClick={() => handleLocalImagePick(activeTheme.id)}>
                  <Image size={14} /> Browse Files
                </button>
              </div>
              <TextInput value={activeTheme.imageUrl} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, imageUrl: e.target.value }))} placeholder="Paste image URL..." />
            </div>
          )}

          {isVideoType && (
            <div className="bg-upload-area">
              <button className="ui-button ui-button--outline ui-button--md" onClick={() => handleVideoPick(activeTheme.id)}>
                <Video size={14} /> Upload Video
              </button>
              <TextInput value={activeTheme.videoUrl} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, videoUrl: e.target.value }))} placeholder="Paste video URL..." />
              <div className="bg-video-toggles">
                <label className="bg-toggle">
                  <input type="checkbox" checked={activeTheme.loop} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, loop: e.target.checked }))} />
                  <span>Loop</span>
                </label>
                <label className="bg-toggle">
                  <input type="checkbox" checked={activeTheme.muted} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, muted: e.target.checked }))} />
                  <span>Mute</span>
                </label>
                <label className="bg-toggle">
                  <input type="checkbox" checked={!activeTheme.muted} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, muted: !e.target.checked, volume: e.target.checked ? 50 : 0 }))} />
                  <span>Audio</span>
                </label>
              </div>
              <button className="ui-button ui-button--ghost ui-button--sm" onClick={resetDefaultTheme} title="Restore default wallpaper">
                Restore Default
              </button>
            </div>
          )}

          {/* Effects */}
          <div className="bg-effects">
            <h4 className="bg-effects-label">Effects</h4>
            <div className="bg-slider-row">
              <label>Blur</label>
              <input type="range" min={0} max={40} value={activeTheme.blurAmount} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, blurAmount: Number(e.target.value) }))} />
              <span className="bg-slider-val">{activeTheme.blurAmount}px</span>
            </div>
            <div className="bg-slider-row">
              <label>Brightness</label>
              <input type="range" min={20} max={200} value={activeTheme.brightness} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, brightness: Number(e.target.value) }))} />
              <span className="bg-slider-val">{activeTheme.brightness}%</span>
            </div>
            <div className="bg-slider-row">
              <label>Opacity</label>
              <input type="range" min={0} max={100} value={activeTheme.opacity} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, opacity: Number(e.target.value) }))} />
              <span className="bg-slider-val">{activeTheme.opacity}%</span>
            </div>
            {isVideoType && !activeTheme.muted && (
              <div className="bg-slider-row">
                <label>Volume</label>
                <input type="range" min={0} max={100} value={activeTheme.volume} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, volume: Number(e.target.value) }))} />
                <span className="bg-slider-val">{activeTheme.volume}%</span>
              </div>
            )}
            <label className="bg-toggle">
              <input type="checkbox" checked={activeTheme.noiseOverlay} onChange={(e) => updateTheme(activeTheme.id, (t) => ({ ...t, noiseOverlay: e.target.checked }))} />
              <span>Noise Overlay</span>
            </label>
          </div>
        </section>
      )}

      {/* Recent / Saved */}
      <section className="bg-section">
        <div className="bg-recent-header">
          <h3 className="bg-section-label">Saved Backgrounds</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="bg-action-btn" onClick={handleImport} title="Import Background">
              <Import size={14} /> Import
            </button>
            <button className="bg-action-btn" onClick={handleCreateAndActivate} title="New Background">
              <Plus size={14} /> New
            </button>
          </div>
        </div>

        {themes.length > 0 ? (
          <div className="bg-recent-grid">
            {themes.map((theme) => {
              const isActive = settings.activeThemeId === theme.id;
              return (
                <div key={theme.id} className={`bg-recent-card ${isActive ? 'active' : ''}`} onClick={() => setActiveTheme(theme.id)}>
                  <div className="bg-recent-preview">
                    <BackgroundPreview theme={theme} />
                    {isActive && <span className="bg-active-badge"><Check size={10} /></span>}
                  </div>
                  <div className="bg-recent-info">
                    <span className="bg-recent-name">{theme.name}</span>
                    <span className="bg-recent-type">{theme.backgroundType}</span>
                  </div>
                  <button className="bg-recent-delete" onClick={(e) => { e.stopPropagation(); deleteTheme(theme.id); }} title="Delete">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-empty">
            <p>No saved backgrounds</p>
          </div>
        )}
      </section>

      {importError && <div className="bg-toast error">{importError}</div>}
    </div>
  );
}

function BackgroundPreview({ theme }: { theme: Theme | undefined }) {
  if (!theme) {
    return <div className="bg-preview-empty-state"><Image size={32} /><span>No background</span></div>;
  }
  if ((theme.backgroundType === 'video' || theme.backgroundType === 'video-url') && theme.videoUrl) {
    return <video src={theme.videoUrl} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (theme.backgroundType === 'image' && theme.imageUrl) {
    return <img src={theme.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (theme.backgroundType === 'gradient') {
    return <div style={{ width: '100%', height: '100%', background: `linear-gradient(${theme.gradientAngle}deg, ${theme.gradientStart}, ${theme.gradientEnd})` }} />;
  }
  return <div style={{ width: '100%', height: '100%', background: theme.solidColor }} />;
}