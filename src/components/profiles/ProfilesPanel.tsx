import { Copy, Heart, Paintbrush, Palette, Plus, Search, Settings2, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { formatRelative } from '../../lib/utils';
import { SearchInput } from '../ui/forms';
import type { PresenceProfile } from '../../lib/types';

export function ProfilesPanel() {
  const profiles = useAppStore((state) => state.profiles);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const selectProfile = useAppStore((state) => state.selectProfile);
  const createProfile = useAppStore((state) => state.createProfile);
  const duplicateProfile = useAppStore((state) => state.duplicateProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const activeTab = useAppStore((state) => state.activeTab);
  const setActiveTab = useAppStore((state) => state.setActiveTab);

  const [profileToDelete, setProfileToDelete] = useState<PresenceProfile | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInputRef.current?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); createProfile(); setActiveTab('editor'); }
      if (e.key === 'Escape') {
        if (profileToDelete) setProfileToDelete(null);
        else if (search) setSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createProfile, setActiveTab, profileToDelete, search, setSearch]);

  const filtered = useMemo(
    () => profiles.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.details.toLowerCase().includes(search.toLowerCase())),
    [profiles, search]
  );

  const sortedByRecent = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [filtered]
  );

  const favorites = useMemo(() => sortedByRecent.filter((p) => p.favorite), [sortedByRecent]);
  const recent = useMemo(() => sortedByRecent.filter((p) => !p.favorite).slice(0, 5), [sortedByRecent]);
  const rest = useMemo(() => sortedByRecent.filter((p) => !p.favorite).slice(5), [sortedByRecent]);

  const sections = useMemo(() => {
    const groups: { label: string; items: PresenceProfile[] }[] = [];
    if (search) {
      groups.push({ label: 'Results', items: filtered });
    } else {
      if (favorites.length) groups.push({ label: 'Favorites', items: favorites });
      if (recent.length) groups.push({ label: 'Recent', items: recent });
      if (rest.length) groups.push({ label: 'Templates', items: rest });
      if (!favorites.length && !recent.length && !rest.length) {
        groups.push({ label: 'Library', items: [] });
      }
    }
    return groups;
  }, [search, filtered, favorites, recent, rest]);

  const handleSelectProfile = (id: string) => { selectProfile(id); setActiveTab('editor'); };

  const hasProfiles = favorites.length > 0 || recent.length > 0 || rest.length > 0 || filtered.length > 0;

  return (
    <>
      <aside className="profiles-panel">
        <div className="panel-header">
          <p className="eyebrow">Profiles</p>
          <h2>Library</h2>
        </div>

        <SearchInput
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Find a profile..."
          shortcutHint="⌘K"
        />

        <div className="profile-list" ref={listRef}>
          {!hasProfiles ? (
            <div className="premium-empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-state-icon" style={{ width: 36, height: 36 }}>
                <Search size={16} />
              </div>
              <h3 className="empty-state-title" style={{ fontSize: 13 }}>No matches</h3>
              <p className="empty-state-description" style={{ fontSize: 12, marginTop: 2 }}>
                No profiles match "{search}".
              </p>
              <div className="empty-state-action" style={{ marginTop: 8 }}>
                <button className="ui-button ui-button--secondary ui-button--sm" onClick={() => setSearch('')}>
                  Clear Search
                </button>
              </div>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.label}>
                {!search && (
                  <div className="profile-section-header">
                    <span>{section.label}</span>
                    <div className="profile-section-divider" />
                  </div>
                )}
                {section.items.map((profile) => (
                  <motion.button
                    layout
                    key={profile.id}
                    className={`profile-card ${profile.id === selectedProfileId ? 'active' : ''}`}
                    onClick={() => handleSelectProfile(profile.id)}
                    whileHover={{ scale: 1.01, y: -2, transition: { duration: 0.12 } }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {profile.id === selectedProfileId && (
                      <motion.div layoutId="profile-indicator" className="profile-indicator" />
                    )}
                    <div className="profile-avatar">
                      {profile.status === 'live' && <span className="live-badge" />}
                      <span className="avatar-initials">{profile.name.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="profile-copy">
                      <div className="profile-title-line">
                        <strong>{profile.name}</strong>
                        <time dateTime={profile.updatedAt} className="profile-updated">{formatRelative(profile.updatedAt)}</time>
                      </div>
                      <p className="profile-subtitle">{profile.status === 'live' ? 'Live presence' : profile.details || 'No status set'}</p>
                    </div>
                    <div className="profile-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={profile.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(profile.id); }}
                      >
                        {profile.favorite ? <Heart size={14} fill="currentColor" style={{ color: 'var(--red)' }} /> : <Star size={14} />}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title="Duplicate"
                        onClick={(e) => { e.stopPropagation(); duplicateProfile(profile.id); setActiveTab('editor'); }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Delete"
                        onClick={(e) => { e.stopPropagation(); setProfileToDelete(profile); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="panel-nav">
          <button
            className={activeTab === 'assets' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('assets')}
          >
            {activeTab === 'assets' && <motion.div layoutId="nav-indicator" className="nav-indicator" />}
            <span className="nav-icon"><Palette size={16} /></span>
            <div className="nav-copy">
              <div className="nav-title">Assets</div>
              <div className="nav-subtitle">Manage images</div>
            </div>
          </button>
          <button
            className={activeTab === 'background' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('background')}
          >
            {activeTab === 'background' && <motion.div layoutId="nav-indicator" className="nav-indicator" />}
            <span className="nav-icon"><Paintbrush size={16} /></span>
            <div className="nav-copy">
              <div className="nav-title">Background</div>
              <div className="nav-subtitle">Customize appearance</div>
            </div>
          </button>
          <button
            className={activeTab === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveTab('settings')}
          >
            {activeTab === 'settings' && <motion.div layoutId="nav-indicator" className="nav-indicator" />}
            <span className="nav-icon"><Settings2 size={16} /></span>
            <div className="nav-copy">
              <div className="nav-title">Settings</div>
              <div className="nav-subtitle">App preferences</div>
            </div>
          </button>
        </div>

        <button className="floating-add-button" style={{ marginTop: 12 }} onClick={() => { createProfile(); setActiveTab('editor'); }}>
          <Plus size={18} />
          New Profile
        </button>
      </aside>

      <AnimatePresence>
        {profileToDelete && (
          <div className="modal-overlay" onClick={() => setProfileToDelete(null)}>
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="modal-header">
                <div className="modal-danger-icon"><Trash2 size={14} /></div>
                <h3 className="modal-title">Delete Profile</h3>
              </div>
              <p className="modal-description">
                Delete <strong>{profileToDelete.name}</strong>? This cannot be undone.
              </p>
              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn-cancel" onClick={() => setProfileToDelete(null)}>Cancel</button>
                <button type="button" className="modal-btn modal-btn-confirm" onClick={() => { deleteProfile(profileToDelete.id); setProfileToDelete(null); }}>Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}