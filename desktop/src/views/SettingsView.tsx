import { useState } from "react";
import { RULES_PLAIN } from "../lib/copy";
import { applySettings, loadSettings, saveSettings, type ShellSettings } from "../lib/settings";

export function SettingsView() {
  const [settings, setSettings] = useState<ShellSettings>(() => {
    const loaded = loadSettings();
    applySettings(loaded);
    return loaded;
  });

  function update(next: ShellSettings): void {
    setSettings(next);
    saveSettings(next);
  }

  return (
    <section className="settings-block" data-testid="settings">
      <h2>Settings</h2>
      <label>
        <input
          type="checkbox"
          checked={settings.mute}
          onChange={(event) => update({ ...settings, mute: event.target.checked })}
        />
        Mute sounds
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(event) => update({ ...settings, reducedMotion: event.target.checked })}
        />
        Reduced motion
      </label>
      <h2>Rules</h2>
      <ol data-testid="rules">
        {RULES_PLAIN.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <p className="quiet">Product UI is a view of attention.dump. It does not store experiments.</p>
    </section>
  );
}
