# mbpfan-status

Small Ubuntu/GNOME top-bar widget for [mbpfan](https://github.com/linux-on-mac/mbpfan) on Apple MacBooks.

Shows:

- `●` / `○` — `mbpfan` service active / inactive
- `L####` / `R####` — left / right fan RPM
- `NN°` — CPU package temperature (`coretemp`)

Click the indicator for a short menu (service, RPM targets, control mode).

## Requirements

- Ubuntu with GNOME and **Ubuntu AppIndicators** enabled
- `mbpfan` installed and running
- Kernel modules `applesmc` + `coretemp`
- Python 3 + PyGObject (`python3-gi`, Gtk 3)

```bash
sudo apt install mbpfan python3-gi gir1.2-gtk-3.0
sudo systemctl enable --now mbpfan
```

## Install (tray applet)

```bash
git clone git@github.com:yuloma/mbpfan-status.git
cd mbpfan-status
./install.sh
```

This copies the applet to `~/.local/bin/mbpfan-status` and enables autostart.

Start now (if not already running):

```bash
python3 ~/.local/bin/mbpfan-status &
```

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
