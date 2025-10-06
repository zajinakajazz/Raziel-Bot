# Raziel — Discord Producer Bot (Clover4Media)

This is a minimal, production-ready starter for Raziel. It registers slash commands automatically on startup and provides:
- `/ping` — health check
- `/hello` — quick greeting
- `/todo add` and `/todo list` — simple in‑memory tasks
- `/status` — summarizes recent tasks

## Deploy on Railway

1. Create a new Service (Empty Service).
2. Upload this folder or ZIP.
3. In Railway → **Variables**, add:
   - `DISCORD_TOKEN` = your bot token from Discord Developer Portal.
4. In Railway → **Settings → Start Command**, set:
   ```
   node index.mjs
   ```
5. Click **Deploy**. Watch logs for `Raziel online as ...`.

## Discord Developer Portal checklist

- Application → **Bot → Privileged Gateway Intents**:
  - Presence Intent ✅
  - Server Members Intent ✅
  - Message Content Intent ✅
- OAuth2 → URL Generator:
  - Scopes: `bot`, `applications.commands`
  - Bot Permissions: View Channels, Send Messages, Read Message History, Embed Links, Attach Files, Use Slash Commands
- Invite the bot to your server with the generated URL.

## Notes
- This starter uses an in‑memory store (clears on restart). Connect a DB later for persistence.