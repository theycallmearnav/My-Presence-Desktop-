import { Upload, Search, Trash2, FileImage, Film, FolderOpen } from 'lucide-react';
import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../lib/store';
import { SearchInput } from '../ui/forms';

export function AssetsView() {
  const assets = useAppStore((state) => state.assets);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);

  const filtered = useMemo(
    () => assets.filter((asset) => asset.name.toLowerCase().includes(search.toLowerCase())),
    [assets, search]
  );

  const handleImport = useCallback(async () => {
    const bridge = window.myPresenceDesktop;
    if (bridge?.uploadImage) {
      await bridge.uploadImage();
    }
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof assets> = {};
    for (const asset of filtered) {
      const key = asset.kind === 'library' ? 'Library' : asset.kind === 'large' ? 'Large Images' : 'Small Images';
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="assets-view">
      <div className="assets-header">
        <div>
          <p className="eyebrow">Assets</p>
          <h3>Image & Video Library</h3>
        </div>
        <button className="ui-button ui-button--primary ui-button--sm" onClick={handleImport}>
          <Upload size={12} /> Import
        </button>
      </div>

      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder="Search assets..."
      />

      {Object.keys(grouped).length === 0 ? (
        <div className="assets-empty">
          <FolderOpen size={32} />
          <h4>No assets found</h4>
          {search ? (
            <p>No assets match "{search}"</p>
          ) : (
            <p>Import images to use them in your profiles</p>
          )}
        </div>
      ) : (
        Object.entries(grouped).map(([groupName, groupAssets]) => (
          <div key={groupName} className="assets-group">
            <h4 className="assets-group-label">{groupName}</h4>
            <div className="assets-grid">
              {groupAssets.map((asset) => (
                <div key={asset.id} className="asset-card">
                  <div className="asset-card-preview" style={{ background: `linear-gradient(135deg, ${asset.accent}, #0F172A)` }}>
                    {asset.kind === 'small' ? <FileImage size={16} /> : <Film size={16} />}
                  </div>
                  <div className="asset-card-body">
                    <strong>{asset.name}</strong>
                    <span>{asset.kind}</span>
                  </div>
                  <button className="asset-card-delete" title="Delete asset">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
