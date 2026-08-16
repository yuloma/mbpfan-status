#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DST="${HOME}/.local/bin/mbpfan-status"
AUTO_DST="${HOME}/.config/autostart/mbpfan-status.desktop"
EXT_DST="${HOME}/.local/share/gnome-shell/extensions/mbpfan-status@local"

install_applet() {
  mkdir -p "${HOME}/.local/bin" "${HOME}/.config/autostart"
  install -m 0755 "${ROOT}/mbpfan-status" "${BIN_DST}"
  sed "s|%h|${HOME}|g" "${ROOT}/packaging/mbpfan-status.desktop" >"${AUTO_DST}"
  echo "Installed applet → ${BIN_DST}"
  echo "Autostart        → ${AUTO_DST}"
}

install_extension() {
  mkdir -p "${EXT_DST}"
  install -m 0644 "${ROOT}/gnome-shell-extension/extension.js" "${EXT_DST}/extension.js"
  install -m 0644 "${ROOT}/gnome-shell-extension/metadata.json" "${EXT_DST}/metadata.json"
  echo "Installed GNOME extension → ${EXT_DST}"
  echo "Enable with: gnome-extensions enable mbpfan-status@local  (then log out/in on Wayland)"
}

uninstall_all() {
  rm -f "${BIN_DST}" "${AUTO_DST}"
  rm -rf "${EXT_DST}"
  pkill -f "${HOME}/.local/bin/mbpfan-status" 2>/dev/null || true
  echo "Removed mbpfan-status files (and stopped running applet if any)."
}

case "${1:-}" in
  --extension)
    install_applet
    install_extension
    ;;
  --uninstall)
    uninstall_all
    ;;
  ""|--applet)
    install_applet
    ;;
  *)
    echo "Usage: $0 [--applet|--extension|--uninstall]" >&2
    exit 1
    ;;
esac
