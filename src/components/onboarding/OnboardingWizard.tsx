import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, MessageSquare, MonitorCog, Palette, Sparkles, Settings, Wifi } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { discordPresenceService } from '../../services/discordPresence';

const STEPS = ['welcome', 'theme', 'discord', 'startup', 'finish'] as const;
type Step = typeof STEPS[number];

const stepLabels: Record<Step, string> = {
  welcome: 'Welcome',
  theme: 'Choose Theme',
  discord: 'Connect Discord',
  startup: 'Startup Preference',
  finish: 'Done',
};

export function OnboardingWizard() {
  const onboardingOpen = useAppStore((s) => s.onboardingOpen);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const themes = useAppStore((s) => s.themes);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);

  const [step, setStep] = useState<number>(0);
  const [selectedTheme, setSelectedTheme] = useState(themes[0]?.id || '');
  const [launchOnStartup, setLaunchOnStartup] = useState(true);
  const [skipDiscord, setSkipDiscord] = useState(false);

  const currentStep = STEPS[step];

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const finish = () => {
    if (selectedTheme) setActiveTheme(selectedTheme);
    updateSettings((s) => ({ ...s, launchOnStartup }));
    if (!skipDiscord) {
      const liveProfile = useAppStore.getState().profiles.find((p) => p.status === 'live');
      if (liveProfile) discordPresenceService.start(liveProfile).catch(() => {});
    }
    completeOnboarding();
  };

  return (
    <AnimatePresence>
      {onboardingOpen && (
        <motion.div
          className="onboarding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="onboarding-modal"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="onboarding-steps">
              {STEPS.map((s, i) => (
                <div key={s} className={`onboarding-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                  {i < step ? <Check size={10} /> : <span>{i + 1}</span>}
                </div>
              ))}
            </div>

            <div className="onboarding-body">
              {currentStep === 'welcome' && <WelcomeStep />}
              {currentStep === 'theme' && (
                <ThemeStep themes={themes} selected={selectedTheme} onSelect={setSelectedTheme} />
              )}
              {currentStep === 'discord' && (
                <DiscordStep skip={skipDiscord} onSkipChange={setSkipDiscord} />
              )}
              {currentStep === 'startup' && (
                <StartupStep enabled={launchOnStartup} onChange={setLaunchOnStartup} />
              )}
              {currentStep === 'finish' && <FinishStep />}
            </div>

            <div className="onboarding-footer">
              {step > 0 ? (
                <button className="ui-button ui-button--ghost" onClick={prev}>Back</button>
              ) : <div />}
              {step < STEPS.length - 1 ? (
                <button className="ui-button ui-button--primary" onClick={next}>
                  Continue <ChevronRight size={14} />
                </button>
              ) : (
                <button className="ui-button ui-button--primary" onClick={finish}>
                  <Sparkles size={14} /> Get Started
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WelcomeStep() {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Sparkles size={32} /></div>
      <h2>Welcome to My Presence</h2>
      <p>Customize your Discord status with rich presence — show what you're playing, watching, or listening to with custom artwork, timers, and buttons.</p>
      <div className="onboarding-features">
        {['Custom Profiles', 'Rich Artwork', 'Live Preview', 'Custom Themes'].map((f) => (
          <div key={f} className="onboarding-feature"><Check size={12} /><span>{f}</span></div>
        ))}
      </div>
    </div>
  );
}

function ThemeStep({ themes, selected, onSelect }: {
  themes: { id: string; name: string; backgroundType: string; solidColor: string; gradientStart: string; gradientEnd: string }[];
  selected: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Palette size={32} /></div>
      <h2>Choose Your Theme</h2>
      <p>Pick a look that fits your style. You can always change it later.</p>
      <div className="onboarding-theme-grid">
        {themes.map((theme) => {
          const bg = theme.backgroundType === 'gradient'
            ? `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`
            : theme.solidColor;
          return (
            <button
              key={theme.id}
              className={`onboarding-theme-card ${selected === theme.id ? 'selected' : ''}`}
              onClick={() => onSelect(theme.id)}
              style={{ background: bg }}
            >
              <span className="onboarding-theme-name">{theme.name}</span>
              {selected === theme.id && <span className="onboarding-theme-check"><Check size={12} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiscordStep({ skip, onSkipChange }: { skip: boolean; onSkipChange: (v: boolean) => void }) {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><MessageSquare size={32} /></div>
      <h2>Connect Discord</h2>
      <p>My Presence works with Discord to show your rich presence. Make sure Discord is running in the background.</p>
      <div className="onboarding-option">
        <label className="choice-card" style={{ width: '100%' }}>
          <input type="checkbox" checked={skip} onChange={(e) => onSkipChange(e.target.checked)} className="choice-input" />
          <span className="checkbox-indicator" />
          <span className="choice-copy">
            <span className="choice-label">Skip for now</span>
            <span className="choice-description">I'll connect Discord later from Settings</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function StartupStep({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><MonitorCog size={32} /></div>
      <h2>Startup Preference</h2>
      <p>Start My Presence automatically when Windows starts?</p>
      <div className="onboarding-option">
        <label className="choice-card active" style={{ width: '100%' }}>
          <input type="radio" name="startup" checked={enabled} onChange={() => onChange(true)} className="choice-input" />
          <span className="radio-indicator" />
          <span className="choice-copy">
            <span className="choice-label">Enable</span>
            <span className="choice-description">Start automatically when I log in</span>
          </span>
        </label>
        <label className="choice-card" style={{ width: '100%' }}>
          <input type="radio" name="startup" checked={!enabled} onChange={() => onChange(false)} className="choice-input" />
          <span className="radio-indicator" />
          <span className="choice-copy">
            <span className="choice-label">Not Now</span>
            <span className="choice-description">I'll enable this later in Settings</span>
          </span>
        </label>
      </div>
    </div>
  );
}

function FinishStep() {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Check size={32} style={{ color: 'var(--green)' }} /></div>
      <h2>You're All Set!</h2>
      <p>Your presence is ready to go. Create profiles, customize themes, and show off what you're doing on Discord.</p>
    </div>
  );
}