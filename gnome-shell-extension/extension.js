import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const POLL_SECONDS = 2;
const APPLESMC_GLOB = '/sys/devices/platform/applesmc.*/';

function readText(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const [, bytes] = file.load_contents(null);
        return new TextDecoder('utf-8').decode(bytes).trim();
    } catch (_e) {
        return null;
    }
}

function readInt(path) {
    const t = readText(path);
    if (t === null)
        return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
}

function findApplesmcDir() {
    try {
        const parent = Gio.File.new_for_path('/sys/devices/platform');
        const enumr = parent.enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumr.next_file(null)) !== null) {
            const name = info.get_name();
            if (name.startsWith('applesmc.'))
                return `/sys/devices/platform/${name}`;
        }
    } catch (_e) {
        // fall through
    }
    return null;
}

function findCoretempHwmon() {
    try {
        const base = Gio.File.new_for_path('/sys/class/hwmon');
        const enumr = base.enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumr.next_file(null)) !== null) {
            const name = info.get_name();
            const dir = `/sys/class/hwmon/${name}`;
            if (readText(`${dir}/name`) === 'coretemp')
                return dir;
        }
    } catch (_e) {
        // fall through
    }
    return null;
}

function readPkgTempC() {
    // Prefer Intel package temp from coretemp (what mbpfan uses).
    const hwmon = findCoretempHwmon();
    if (hwmon) {
        try {
            const dir = Gio.File.new_for_path(hwmon);
            const enumr = dir.enumerate_children(
                'standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            let maxC = null;
            let label = 'CPU';
            while ((info = enumr.next_file(null)) !== null) {
                const name = info.get_name();
                const m = name.match(/^temp(\d+)_input$/);
                if (!m)
                    continue;
                const idx = m[1];
                const milli = readInt(`${hwmon}/temp${idx}_input`);
                if (milli === null)
                    continue;
                const c = Math.round(milli / 1000);
                const lab = readText(`${hwmon}/temp${idx}_label`) || `temp${idx}`;
                if (lab.toLowerCase().includes('package'))
                    return {c, label: lab};
                if (maxC === null || c > maxC) {
                    maxC = c;
                    label = lab;
                }
            }
            if (maxC !== null)
                return {c: maxC, label};
        } catch (_e) {
            // fall through
        }
    }

    const pkg = readInt('/sys/class/thermal/thermal_zone1/temp');
    if (pkg !== null)
        return {c: Math.round(pkg / 1000), label: 'pkg'};

    return {c: null, label: '?'};
}

function readFans(smc) {
    const fans = [];
    if (!smc)
        return fans;
    for (let i = 1; i <= 4; i++) {
        const input = readInt(`${smc}/fan${i}_input`);
        if (input === null)
            continue;
        fans.push({
            index: i,
            label: readText(`${smc}/fan${i}_label`) || `fan${i}`,
            rpm: input,
            target: readInt(`${smc}/fan${i}_output`),
            manual: readInt(`${smc}/fan${i}_manual`),
            min: readInt(`${smc}/fan${i}_min`),
            max: readInt(`${smc}/fan${i}_max`),
        });
    }
    return fans;
}

function serviceActive() {
    try {
        const proc = Gio.Subprocess.new(
            ['systemctl', 'is-active', 'mbpfan'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        const [, stdout] = proc.communicate_utf8(null, null);
        return stdout.trim() === 'active';
    } catch (_e) {
        return false;
    }
}

function fanBySide(fans, side) {
    const needle = side.toLowerCase();
    return fans.find(f => f.label.toLowerCase().includes(needle)) || null;
}

const MbpfanIndicator = GObject.registerClass(
class MbpfanIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'mbpfan Status');

        this._smc = findApplesmcDir();

        this._label = new St.Label({
            text: 'mbpfan …',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'system-status-icon',
        });
        this.add_child(this._label);

        this._svcItem = new PopupMenu.PopupMenuItem('Service: …', {reactive: false});
        this._leftItem = new PopupMenu.PopupMenuItem('Left fan: …', {reactive: false});
        this._rightItem = new PopupMenu.PopupMenuItem('Right fan: …', {reactive: false});
        this._tempItem = new PopupMenu.PopupMenuItem('Temperature: …', {reactive: false});
        this._manualItem = new PopupMenu.PopupMenuItem('Control: …', {reactive: false});

        this.menu.addMenuItem(this._svcItem);
        this.menu.addMenuItem(this._leftItem);
        this.menu.addMenuItem(this._rightItem);
        this.menu.addMenuItem(this._tempItem);
        this.menu.addMenuItem(this._manualItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const refresh = new PopupMenu.PopupMenuItem('Refresh now');
        refresh.connect('activate', () => this._update());
        this.menu.addMenuItem(refresh);

        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, POLL_SECONDS, () => {
                this._update();
                return GLib.SOURCE_CONTINUE;
            });
        this._update();
    }

    _update() {
        const active = serviceActive();
        const fans = readFans(this._smc);
        const left = fanBySide(fans, 'left');
        const right = fanBySide(fans, 'right');
        const temp = readPkgTempC();

        const l = left ? left.rpm : '—';
        const r = right ? right.rpm : '—';
        const t = temp.c !== null ? `${temp.c}°` : '—';
        const mark = active ? '●' : '○';

        this._label.text = `${mark} L${l} R${r} ${t}`;

        this._svcItem.label.text = active
            ? 'Service: mbpfan active'
            : 'Service: mbpfan inactive';
        this._leftItem.label.text = left
            ? `Left (${left.label}): ${left.rpm} rpm` +
              (left.target !== null ? ` → ${left.target}` : '')
            : 'Left fan: n/a';
        this._rightItem.label.text = right
            ? `Right (${right.label}): ${right.rpm} rpm` +
              (right.target !== null ? ` → ${right.target}` : '')
            : 'Right fan: n/a';
        this._tempItem.label.text = temp.c !== null
            ? `Temperature (${temp.label}): ${temp.c}°C`
            : 'Temperature: n/a';

        const manual = left?.manual ?? right?.manual;
        this._manualItem.label.text = manual === 1
            ? 'Control: mbpfan (manual)'
            : manual === 0
                ? 'Control: firmware (auto)'
                : 'Control: unknown';

        return GLib.SOURCE_CONTINUE;
    }

    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        super.destroy();
    }
});

export default class MbpfanStatusExtension extends Extension {
    enable() {
        this._indicator = new MbpfanIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
