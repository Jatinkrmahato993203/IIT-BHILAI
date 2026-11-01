import { progressOf } from '../../domain/story/engine';
import type { MotionPref, Wallpaper } from '../../domain/settings';
import { useOs } from '../../os/OsContext';
import type { AppProps } from '../../shell/appRegistry';

export default function ControlPanel(_props: AppProps) {
  const os = useOs();
  const s = os.settings;

  const confirm = (title: string, text: string[], ok: string) =>
    os.message({ title, icon: 'warning', text, buttons: [{ label: ok, value: 'yes' }, { label: 'Cancel', value: 'no', primary: true }], cancelValue: 'no' });

  return (
    <div className="app control">
      <fieldset>
        <legend>Display</legend>
        <div className="field-row-stacked">
          <label htmlFor="cp-wall">Wallpaper</label>
          <select id="cp-wall" data-autofocus="true" value={s.wallpaper} onChange={(e) => os.updateSettings({ wallpaper: e.target.value as Wallpaper })}>
            <option value="teal">(None) — Teal</option>
            <option value="clouds">Sky</option>
            <option value="night">Midnight</option>
            <option value="floppy">Floppy pattern</option>
          </select>
        </div>
        <div className="field-row-stacked">
          <label htmlFor="cp-scale">Text size</label>
          <select id="cp-scale" value={s.textScale} onChange={(e) => os.updateSettings({ textScale: Number(e.target.value) as 100 | 125 | 150 })}>
            <option value={100}>Normal (100%)</option>
            <option value={125}>Large (125%)</option>
            <option value={150}>Extra large (150%)</option>
          </select>
        </div>
      </fieldset>
      <fieldset>
        <legend>Accessibility</legend>
        <div className="field-row-stacked">
          <label htmlFor="cp-motion">Animations</label>
          <select id="cp-motion" value={s.motion} onChange={(e) => os.updateSettings({ motion: e.target.value as MotionPref })}>
            <option value="system">Follow my system setting</option>
            <option value="reduce">Reduce motion</option>
            <option value="full">Full animations</option>
          </select>
        </div>
        <div className="field-row">
          <input id="cp-focus" type="checkbox" checked={s.highContrastFocus} onChange={(e) => os.updateSettings({ highContrastFocus: e.target.checked })} />
          <label htmlFor="cp-focus">Extra-visible keyboard focus</label>
        </div>
        <div className="field-row">
          <input id="cp-sound" type="checkbox" checked={s.sound} onChange={(e) => os.updateSettings({ sound: e.target.checked })} />
          <label htmlFor="cp-sound">System sounds (never needed for clues)</label>
        </div>
        <div className="field-row">
          <input id="cp-boot" type="checkbox" checked={s.skipBootAnimation} onChange={(e) => os.updateSettings({ skipBootAnimation: e.target.checked })} />
          <label htmlFor="cp-boot">Fast startup (skip boot animation)</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Storage &amp; reset</legend>
        <p className="small">
          {os.storageKind === 'indexeddb'
            ? 'Files and progress are stored only in this browser (IndexedDB). Nothing is uploaded. Clearing site data erases them.'
            : 'Session-only mode: this browser is not allowing storage. Everything will be lost when the tab closes.'}
        </p>
        <p className="small">Mystery milestones found: {progressOf(os.story)} of 5.</p>
        <div className="cp-buttons">
          <button
            onClick={async () => {
              if ((await confirm('Replay mystery', ['Reset story progress and hide the secret folder again?', 'Your files and edits are kept.'], 'Replay')) === 'yes') await os.resetStory();
            }}
          >
            Replay mystery
          </button>
          <button
            onClick={async () => {
              if ((await confirm('Reset files', ['Restore drive C: to how it was found?', 'This permanently deletes files you created or edited. Open windows will be closed (you will be asked about unsaved work).'], 'Reset files')) === 'yes') await os.resetFilesystem();
            }}
          >
            Reset files
          </button>
          <button
            onClick={async () => {
              if ((await confirm('Reset everything', ['Erase all files, progress and settings and start fresh?', 'This cannot be undone.'], 'Reset everything')) === 'yes') {
                await os.resetFilesystem();
                await os.resetStory();
                os.updateSettings({ sound: false, motion: 'system', textScale: 100, wallpaper: 'teal', highContrastFocus: false, skipBootAnimation: false });
              }
            }}
          >
            Reset everything
          </button>
          <button onClick={() => os.arrangeWindows()}>Rescue: arrange windows</button>
        </div>
      </fieldset>
    </div>
  );
}
