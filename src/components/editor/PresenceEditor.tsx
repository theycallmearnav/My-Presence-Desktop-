import { ChevronDown, Clock3, Crop, ExternalLink, FileText, Image, Lightbulb, Link, Play, RefreshCcw, Square, Trash2, Type, Upload, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAppStore } from '../../lib/store';
import type { ActivityType, ImageFit, PresenceProfile, TimestampMode } from '../../lib/types';
import { ImageCropModal } from './ImageCropModal';
import { discordPresenceService } from '../../services/discordPresence';
import { validateUrl } from '../../lib/utils';
import { effectiveTimestampMode, TIMESTAMP_MODE_OPTIONS } from '../../lib/timestamps';
import { TextInput, SelectInput, DateTimePicker, SwitchField, CheckboxField, RadioGroup, FormField } from '../ui/forms';

type Props = { profile: PresenceProfile };

const activityTypes: ActivityType[] = ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'];
type ImageSlot = 'largeImage' | 'smallImage';

const SECTION_CONFIG = [
  { key: 'basics', icon: Type, title: 'The Basics', description: 'Name and activity type shown in your profile' },
  { key: 'status', icon: FileText, title: 'Status Text', description: 'The two lines of text displayed under your activity' },
  { key: 'images', icon: Image, title: 'Artwork', description: 'Large and small images with hover text' },
  { key: 'buttons', icon: Link, title: 'Buttons', description: 'Up to two clickable buttons with custom labels' },
  { key: 'timer', icon: Clock3, title: 'Timer', description: 'Show elapsed time, countdown, or local time' },
  { key: 'advanced', icon: ExternalLink, title: 'Advanced', description: 'Application ID, party, secrets, and internal notes' },
] as const;

export function PresenceEditor({ profile }: Props) {
  const updateProfile = useAppStore((state) => state.updateProfile);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [uploading, setUploading] = useState<ImageSlot | null>(null);
  const [resolving, setResolving] = useState<ImageSlot | null>(null);
  const [editingSlot, setEditingSlot] = useState<ImageSlot | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basics: true, status: false, images: false, buttons: false, timer: false, advanced: false
  });

  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const patch = <K extends keyof PresenceProfile>(key: K, value: PresenceProfile[K]) => {
    const next = { ...profile, [key]: value, updatedAt: new Date().toISOString() };
    updateProfile(profile.id, (current) => ({ ...current, [key]: value }));
    resyncIfLive(next);
  };

  const patchNested = <T,>(key: keyof PresenceProfile, value: T) => {
    const next = { ...profile, [key]: value, updatedAt: new Date().toISOString() };
    updateProfile(profile.id, (current) => ({ ...current, [key]: value }));
    resyncIfLive(next);
  };

  const resyncIfLive = (next: PresenceProfile) => {
    if (next.status === 'live') void discordPresenceService.start(next);
  };

  const setImage = (slot: ImageSlot, url: string) => {
    updateProfile(profile.id, (current) => {
      const next = { ...current, assets: { ...current.assets, [slot]: url } };
      resyncIfLive(next);
      return next;
    });
  };

  const fitKeyFor = (slot: ImageSlot): 'largeFit' | 'smallFit' =>
    slot === 'largeImage' ? 'largeFit' : 'smallFit';

  const applyImageEdit = (slot: ImageSlot, result: { url?: string; fit?: ImageFit }) => {
    updateProfile(profile.id, (current) => {
      const assets = { ...current.assets };
      if (result.url) assets[slot] = result.url;
      if (result.fit) assets[fitKeyFor(slot)] = result.fit;
      const next = { ...current, assets };
      resyncIfLive(next);
      return next;
    });
  };

  const setButtons = (buttons: PresenceProfile['buttons']) => {
    updateProfile(profile.id, (current) => {
      const next = { ...current, buttons };
      resyncIfLive(next);
      return next;
    });
  };

  const resolveImageLink = async (slot: ImageSlot) => {
    const value = profile.assets[slot]?.trim();
    if (!value || !/^https?:\/\//i.test(value)) return;
    const isPageHost = /(^|\.)(tenor\.com|pinterest\.[a-z.]+|pin\.it|giphy\.com)(\/|$)/i.test(value);
    if (/\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(value) && !isPageHost) return;
    const bridge = window.myPresenceDesktop;
    if (!bridge?.resolveImageUrl) return;
    setUploadError('');
    setResolving(slot);
    try {
      const result = await bridge.resolveImageUrl(value);
      if (result.ok) { if (result.changed) setImage(slot, result.url); }
      else setUploadError(result.error);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not open that link.');
    } finally {
      setResolving(null);
    }
  };

  const handleUpload = async (slot: ImageSlot) => {
    setUploadError('');
    const bridge = window.myPresenceDesktop;
    if (!bridge?.uploadImage) { setUploadError('Uploading only works in the desktop app.'); return; }
    setUploading(slot);
    try {
      const result = await bridge.uploadImage();
      if (result.ok) setImage(slot, result.url);
      else if (!('canceled' in result)) setUploadError(result.error);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const timestampMode = effectiveTimestampMode(profile.timestamps);
  const hasTimer = timestampMode !== 'none';
  const setTimestampMode = (mode: TimestampMode) => patchNested('timestamps', { ...profile.timestamps, mode });

  const isLive = profile.status === 'live';

  return (
    <div className="presence-editor">
      <div className="editor-sticky-header">
        <div className="editor-header-left">
          <h2 className="editor-title">Edit Presence</h2>
          <span className="editor-subtitle">{profile.name || 'Untitled Profile'}</span>
        </div>
        <div className="editor-header-actions">
          <button className="ui-button ui-button--ghost ui-button--sm" onClick={() => { patch('status', 'idle'); void discordPresenceService.stop(); }} disabled={!isLive}>
            <XCircle size={14} />
            <span>Stop</span>
          </button>
          <button className="ui-button ui-button--ghost ui-button--sm" onClick={() => void discordPresenceService.stop()}>
            <RefreshCcw size={14} />
            <span>Clear</span>
          </button>
          {isLive ? (
            <button className="ui-button ui-button--danger ui-button--md live-indicator" onClick={() => { patch('status', 'idle'); void discordPresenceService.stop(); }}>
              <Square size={14} />
              <span>Live - Click to Stop</span>
              <span className="live-pulse" />
            </button>
          ) : (
            <button className="ui-button ui-button--primary ui-button--md" onClick={() => { patch('status', 'live'); void discordPresenceService.start({ ...profile, status: 'live' }); }}>
              <Play size={14} />
              <span>Go Live</span>
            </button>
          )}
        </div>
      </div>

      <div className="editor-content">
        <AnimatePresence mode="popLayout">
          {SECTION_CONFIG.map(({ key, icon: Icon, title, description }) => (
            <EditorSection
              key={key}
              icon={Icon}
              title={title}
              description={description}
              isOpen={openSections[key]}
              onToggle={() => toggleSection(key)}
            >
              {renderSectionContent(key)}
            </EditorSection>
          ))}
        </AnimatePresence>
      </div>

      {editingSlot && (
        <ImageCropModal
          url={profile.assets[editingSlot]}
          fit={(editingSlot === 'largeImage' ? profile.assets.largeFit : profile.assets.smallFit) ?? 'fill'}
          onApply={(result) => applyImageEdit(editingSlot, result)}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  );

  function renderSectionContent(key: string) {
    switch (key) {
      case 'basics':
        return (
          <div className="editor-grid two">
            <FormField label="Preset name">
              <TextInput value={profile.name} onChange={(e) => patch('name', e.target.value)} placeholder="e.g. Gaming, Working" />
            </FormField>
            <FormField label="Shows up as">
              <SelectInput value={profile.activityType} onChange={(value) => patch('activityType', value as ActivityType)} options={activityTypes.map((t) => ({ value: t, label: t }))} />
            </FormField>
          </div>
        );
      case 'status':
        return (
          <div className="editor-grid two">
            <FormField label="Top line">
              <TextInput value={profile.details} onChange={(e) => patch('details', e.target.value)} placeholder="e.g. Playing Minecraft" />
            </FormField>
            <FormField label="Bottom line">
              <TextInput value={profile.state} onChange={(e) => patch('state', e.target.value)} placeholder="e.g. Building a castle" />
            </FormField>
          </div>
        );
      case 'images':
        return (
          <>
            <div className="asset-workbench">
              <ImageUploader label="Large artwork" value={profile.assets.largeImage} uploading={uploading === 'largeImage'} disabled={uploading !== null} onUpload={() => handleUpload('largeImage')} onClear={() => setImage('largeImage', '')} onAdjust={() => setEditingSlot('largeImage')} hoverText={profile.assets.largeText} linkUrl={profile.assets.largeUrl} />
              <ImageUploader label="Small artwork" value={profile.assets.smallImage} uploading={uploading === 'smallImage'} disabled={uploading !== null} onUpload={() => handleUpload('smallImage')} onClear={() => setImage('smallImage', '')} onAdjust={() => setEditingSlot('smallImage')} compact hoverText={profile.assets.smallText} linkUrl={profile.assets.smallUrl} />
            </div>
            {uploadError && <p className="editor-error">{uploadError}</p>}
            <p className="editor-hint"><Lightbulb size={12} /> Paste a Giphy, Tenor, Pinterest, or direct image link</p>
            <div className="editor-grid two" style={{ marginTop: 6 }}>
              <FormField label="Large link">
                <TextInput value={profile.assets.largeImage} onChange={(e) => setImage('largeImage', e.target.value)} onBlur={() => void resolveImageLink('largeImage')} placeholder="Upload or paste link…" />
              </FormField>
              <FormField label="Small link">
                <TextInput value={profile.assets.smallImage} onChange={(e) => setImage('smallImage', e.target.value)} onBlur={() => void resolveImageLink('smallImage')} placeholder="Upload or paste link…" />
              </FormField>
            </div>
            <div className="editor-grid two" style={{ marginTop: 12 }}>
              <FormField label="Large hover text">
                <TextInput value={profile.assets.largeText} onChange={(e) => updateProfile(profile.id, (current) => { const next = { ...current, assets: { ...current.assets, largeText: e.target.value } }; resyncIfLive(next); return next; })} placeholder="e.g. Playing Minecraft" />
              </FormField>
              <FormField label="Small hover text">
                <TextInput value={profile.assets.smallText} onChange={(e) => updateProfile(profile.id, (current) => { const next = { ...current, assets: { ...current.assets, smallText: e.target.value } }; resyncIfLive(next); return next; })} placeholder="e.g. Building a castle" />
              </FormField>
            </div>
            <div className="editor-grid two" style={{ marginTop: 12 }}>
              <FormField label="Large click URL">
                <TextInput value={profile.assets.largeUrl ?? ''} onChange={(e) => updateProfile(profile.id, (current) => { const next = { ...current, assets: { ...current.assets, largeUrl: e.target.value } }; resyncIfLive(next); return next; })} placeholder="https://" />
              </FormField>
              <FormField label="Small click URL">
                <TextInput value={profile.assets.smallUrl ?? ''} onChange={(e) => updateProfile(profile.id, (current) => { const next = { ...current, assets: { ...current.assets, smallUrl: e.target.value } }; resyncIfLive(next); return next; })} placeholder="https://" />
              </FormField>
            </div>
          </>
        );
      case 'buttons':
        return (
          <>
            <div style={{ marginBottom: 6 }}>
              <SwitchField label="Show buttons" description={profile.buttonsEnabled ? 'Buttons appear on your status' : 'Buttons are hidden'} checked={profile.buttonsEnabled} onChange={(checked) => { updateProfile(profile.id, (current) => { const next = { ...current, buttonsEnabled: checked }; resyncIfLive(next); return next; }); }} />
            </div>
            {profile.buttonsEnabled && profile.buttons.map((button, index) => {
              const urlError = validateUrl(button.url);
              return (
                <div key={button.id} className="button-row">
                  <div className="editor-grid two" style={{ marginBottom: 6 }}>
                    <FormField label={`Button ${index + 1} text`}>
                      <TextInput value={button.label} onChange={(e) => { const b = [...profile.buttons]; b[index] = { ...button, label: e.target.value }; setButtons(b); }} placeholder="e.g. Visit my channel" />
                    </FormField>
                    <FormField label="Link" message={urlError} tone={urlError ? 'error' : 'default'}>
                      <TextInput value={button.url} onChange={(e) => { const b = [...profile.buttons]; b[index] = { ...button, url: e.target.value }; setButtons(b); }} placeholder="https://" />
                    </FormField>
                  </div>
                  <div className="discord-button-preview">
                    <span>{button.label || `Button ${index + 1}`}</span>
                    <ExternalLink size={11} />
                  </div>
                </div>
              );
            })}
          </>
        );
      case 'timer':
        return (
          <div className="timing-panel">
            <div className="timer-preview">
              <Clock3 size={14} style={{ color: 'var(--text-tertiary)' }} />
              <div>
                <strong>{hasTimer ? 'Timer is on' : 'No timer set'}</strong>
                <p style={{ fontSize: 11, margin: 0 }}>{timerSummary(profile, timestampMode)}</p>
              </div>
            </div>
            <RadioGroup name={`ts-${profile.id}`} label="Timer starts from" options={TIMESTAMP_MODE_OPTIONS} value={timestampMode} onChange={(value) => setTimestampMode(value as TimestampMode)} />
            {timestampMode === 'custom' && (
              <div className="editor-grid two" style={{ marginTop: 6 }}>
                <FormField label="Started at">
                  <DateTimePicker value={profile.timestamps.start} onChange={(val) => patchNested('timestamps', { ...profile.timestamps, start: val })} />
                </FormField>
                <FormField label="End time">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <CheckboxField label="Set an end time" checked={Boolean(profile.timestamps.endEnabled)} onChange={(checked) => patchNested('timestamps', { ...profile.timestamps, endEnabled: checked })} />
                    {profile.timestamps.endEnabled && <DateTimePicker value={profile.timestamps.end} onChange={(val) => patchNested('timestamps', { ...profile.timestamps, end: val })} />}
                  </div>
                </FormField>
              </div>
            )}
          </div>
        );
      case 'advanced':
        return (
          <>
            <div className="editor-grid two">
              <FormField label="Application ID">
                <TextInput value={profile.applicationId} onChange={(e) => patch('applicationId', e.target.value)} placeholder="Discord Application ID" />
              </FormField>
              <FormField label="Instance">
                <SwitchField label="" description={profile.instance ? 'Shows as a game instance' : 'Shows as a regular activity'} checked={profile.instance} onChange={(checked) => patch('instance', checked)} />
              </FormField>
            </div>
            <div className="editor-grid two" style={{ marginTop: 6 }}>
              <FormField label="Party ID">
                <TextInput value={profile.party.id} onChange={(e) => patchNested('party', { ...profile.party, id: e.target.value })} placeholder="Party ID" />
              </FormField>
              <FormField label="Party Size">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" min={1} max={99} value={profile.party.currentSize} onChange={(e) => patchNested('party', { ...profile.party, currentSize: Number(e.target.value) })} style={{ width: 60, height: 32 }} className="input" />
                  <span style={{ color: 'var(--text-tertiary)' }}> / </span>
                  <input type="number" min={1} max={99} value={profile.party.maxSize} onChange={(e) => patchNested('party', { ...profile.party, maxSize: Number(e.target.value) })} style={{ width: 60, height: 32 }} className="input" />
                </div>
              </FormField>
            </div>
            <div className="editor-grid two" style={{ marginTop: 6 }}>
              <FormField label="Join Secret">
                <TextInput value={profile.secrets.join} onChange={(e) => patchNested('secrets', { ...profile.secrets, join: e.target.value })} placeholder="Join secret" />
              </FormField>
              <FormField label="Spectate Secret">
                <TextInput value={profile.secrets.spectate} onChange={(e) => patchNested('secrets', { ...profile.secrets, spectate: e.target.value })} placeholder="Spectate secret" />
              </FormField>
            </div>
            <div className="editor-grid two" style={{ marginTop: 6 }}>
              <FormField label="Match Secret">
                <TextInput value={profile.secrets.match} onChange={(e) => patchNested('secrets', { ...profile.secrets, match: e.target.value })} placeholder="Match secret" />
              </FormField>
            </div>
            <div style={{ marginTop: 6 }}>
              <FormField label="Notes">
                <TextInput value={profile.notes} onChange={(e) => patch('notes', e.target.value)} placeholder="Internal notes…" style={{ minHeight: 60 }} />
              </FormField>
            </div>
          </>
        );
      default:
        return null;
    }
  }
}

function EditorSection({ icon: Icon, title, description, isOpen, onToggle, children }: {
  icon: typeof Type; title: string; description: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <motion.div layout className={`editor-section ${isOpen ? 'open' : ''}`}>
      <motion.div layout className="editor-section-header" onClick={onToggle}>
        <div className="editor-section-header-left">
          <div className="editor-section-icon"><Icon size={16} /></div>
          <div className="editor-section-titles">
            <span className="editor-section-title">{title}</span>
            <span className="editor-section-description">{description}</span>
          </div>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="editor-section-chevron">
          <ChevronDown size={14} />
        </motion.div>
      </motion.div>
      <motion.div
        layout
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0, marginTop: isOpen ? 16 : 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: isOpen ? 'visible' : 'hidden' }}
      >
        {isOpen && <div className="editor-section-body">{children}</div>}
      </motion.div>
    </motion.div>
  );
}

function ImageUploader({ label, value, uploading, disabled, onUpload, onClear, onAdjust, compact = false, hoverText, linkUrl }: {
  label: string; value: string; uploading: boolean; disabled: boolean; onUpload: () => void; onClear: () => void; onAdjust: () => void; compact?: boolean; hoverText?: string; linkUrl?: string;
}) {
  const isImageUrl = /^https?:\/\//i.test(value);
  const hasLink = linkUrl && /^https?:\/\//i.test(linkUrl);
  const openLink = () => {
    if (hasLink) window.open(linkUrl, '_blank', 'noopener');
    else if (isImageUrl) window.open(value, '_blank', 'noopener');
  };
  return (
    <div className={`asset-uploader ${compact ? 'compact' : ''}`}>
      <div className="asset-uploader-preview" onClick={openLink} style={{ cursor: isImageUrl ? 'pointer' : 'default' }} title={hoverText || (isImageUrl ? value : '')}>
        {isImageUrl ? <img src={value} alt={label} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} /> : value ? <span className="asset-placeholder-text">{value.slice(0, 2).toUpperCase()}</span> : <Image size={20} />}
      </div>
      <div className="asset-uploader-body">
        <div className="asset-uploader-info">
          <strong style={{ fontSize: 13 }}>{label}</strong>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block' }}>{value ? (isImageUrl ? 'Image ready' : value) : 'No picture yet'}</span>
        </div>
        <div className="asset-uploader-actions">
          <button className="ui-button ui-button--outline ui-button--sm" onClick={onUpload} disabled={disabled}>
            {uploading ? <Loader2 size={12} className="spinning" /> : <Upload size={12} />}
            <span>{uploading ? ' Uploading…' : ' Upload'}</span>
          </button>
          {isImageUrl && <button className="ui-button ui-button--ghost ui-button--sm" onClick={onAdjust} disabled={disabled}><Crop size={12} /></button>}
          {value && <button className="ui-button ui-button--ghost ui-button--sm" onClick={onClear} disabled={disabled}><Trash2 size={12} /></button>}
        </div>
      </div>
    </div>
  );
}

function timerSummary(profile: PresenceProfile, mode: TimestampMode): string {
  switch (mode) {
    case 'none': return 'No timer will show on your status.';
    case 'sinceConnection': return 'Counts up from when you go live.';
    case 'sinceUpdate': return 'Counts up, resetting on each update.';
    case 'sinceAppStart': return 'Counts up from app launch.';
    case 'localTime': return 'Shows your current local time.';
    case 'custom':
      return profile.timestamps.endEnabled && profile.timestamps.end
        ? 'Counts down to your end time.'
        : profile.timestamps.start
          ? 'Counts up from your start time.'
          : 'Pick a start time to show the timer.';
  }
}