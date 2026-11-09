import { useSettings } from '../context/SettingsContext.jsx';

export default function MusicToggle({ className = '' }) {
  const { settings, update } = useSettings();
  return (
    <button
      type="button"
      className={`music-toggle ${className}`}
      aria-pressed={settings.musicEnabled}
      onClick={() => update({ musicEnabled: !settings.musicEnabled })}
    >
      <span aria-hidden="true">{settings.musicEnabled ? '♫' : '♪'}</span>
      Music {settings.musicEnabled ? 'on' : 'off'}
    </button>
  );
}
