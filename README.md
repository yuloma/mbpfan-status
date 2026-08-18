# mbpfan-status

Small Ubuntu panel widget for [mbpfan](https://github.com/linux-on-mac/mbpfan) on Apple MacBooks.

- **GNOME:** AppIndicator text in the top bar
- **XFCE:** text chip embedded in the top panel (position is configurable)

Shows:

- `●` / `○` — `mbpfan` service active / inactive
- `L####` / `R####` — left / right fan RPM
- `NN°` — CPU package temperature (`coretemp`)

Click the indicator for a short menu (service, RPM targets, control mode).

![mbpfan-status in the Ubuntu GNOME top bar showing left/right fan RPM and CPU temperature](docs/top-bar-example.png)

Example: `● L3676 R3680 61°` — service active, left/right fans, package temperature.

## Requirements

- Ubuntu with GNOME (**Ubuntu AppIndicators**) or XFCE (top panel)
- `mbpfan` installed and running
- Kernel modules `applesmc` + `coretemp`
- Python 3 + PyGObject (`python3-gi`, Gtk 3, Dbusmenu)

```bash
sudo apt install mbpfan python3-gi gir1.2-gtk-3.0 gir1.2-dbusmenu-glib-0.4
sudo systemctl enable --now mbpfan
```

## Install (tray applet)

```bash
git clone git@github.com:yuloma/mbpfan-status.git
cd mbpfan-status
./install.sh
```

This copies the applet to `~/.local/bin/mbpfan-status` and enables autostart.
If `~/.config/mbpfan-status/config.ini` does not exist, a default copy is installed.

Start now (if not already running):

```bash
python3 ~/.local/bin/mbpfan-status &
```

## XFCE panel position

On XFCE the chip is embedded in the top panel, left of the workspace pager / tray.

Edit `~/.config/mbpfan-status/config.ini` (created on first install). Changes apply within a couple of seconds; no restart needed.

```ini
[xfce]
pager_reserve = 200   ; larger = further left (clears the workspace buttons)
gap = 8               ; extra space between chip and pager
offset_x = 0          ; extra nudge: positive = left, negative = right
min_width = 190
height = 26           ; match your panel height
```

If the chip overlaps the first workspace button, raise `pager_reserve` (try `220` or `240`). If there is too much empty space, lower it.

## Optional: GNOME Shell extension

Native panel text (no AppIndicator). After install, log out/in on Wayland:

```bash
./install.sh --extension
gnome-extensions enable mbpfan-status@local
```

Use either the tray applet **or** the extension to avoid duplicates.

## Uninstall

```bash
./install.sh --uninstall
```

## License

MIT
