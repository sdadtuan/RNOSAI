# Chat SD desktop

Electron window for Chat SD. The chat UI stays on the deployed site.

```bash
cd services/ops-desktop
npm install
npm start
```

The window has no address bar. Closing it hides the window in the tray. **Thoát** quits the process.

Default URL: `https://rs.pttads.vn/crm/csd/chat?shell=desktop`

Override with `OPS_DESKTOP_CHAT_URL`.

Saved files go to `~/RNOSAI/CSD-Chat/`. The page only uses the file bridge when `window.rnosDesktop` is present. A normal browser still opens files in a tab.

Shell updates run only when `OPS_DESKTOP_UPDATE_URL` is set to a real generic feed. There is no default update URL.
