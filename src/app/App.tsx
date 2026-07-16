import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Plus } from 'lucide-react';
import { Shell } from '../components/layout/Shell';
import { ErrorBoundary } from '../components/layout/ErrorBoundary';
import { PresenceEditor } from '../components/editor/PresenceEditor';
import { ProfilesPanel } from '../components/profiles/ProfilesPanel';
import { AssetsView } from '../components/settings/AssetsView';
import { SettingsView } from '../components/settings/SettingsView';
import { BackgroundView } from '../components/theme/BackgroundView';
import { BackgroundEngine } from '../components/theme/BackgroundEngine';
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard';
import { useAppStore, useProfile } from '../lib/store';

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
};

export function App() {
  const activeTab = useAppStore((state) => state.activeTab);
  const profiles = useAppStore((state) => state.profiles);
  const createProfile = useAppStore((state) => state.createProfile);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const profile = useProfile();

  return (
    <ErrorBoundary>
      <BackgroundEngine />
      <Shell>
        <OnboardingWizard />
        <div className="app-grid">
          <ProfilesPanel />

          <main className="workspace-panel">
            <div className="workspace-body">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...pageTransition}>
                  {activeTab === 'editor' && (
                    profile ? (
                      <PresenceEditor profile={profile} />
                    ) : (
                      <div className="empty-state centered">
                        <div className="empty-state-icon">
                          <Activity size={24} />
                        </div>
                        <h3 className="empty-state-title">No Profiles</h3>
                        <p className="empty-state-description">
                          Create a profile to start configuring your Discord activity.
                        </p>
                        <div className="empty-state-action">
                          <button className="ui-button ui-button--primary ui-button--md" onClick={() => { createProfile(); setActiveTab('editor'); }}>
                            <Plus size={14} />
                            Create First Profile
                          </button>
                        </div>
                      </div>
                    )
                  )}
                  {activeTab === 'assets' ? <AssetsView /> : null}
                  {activeTab === 'background' ? <BackgroundView /> : null}
                  {activeTab === 'settings' ? <SettingsView /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </Shell>
    </ErrorBoundary>
  );
}