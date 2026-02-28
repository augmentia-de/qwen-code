# Gateway-Konfiguration

## Übersicht

Qwen Code unterstützt externe Gateways für die Kommunikation über:
- **Discord** - Discord Channel als Eingabe/Ausgabe
- **WhatsApp** - WhatsApp Business API (Twilio/Meta)
- **Terminal** - Terminal-zu-Terminal Kommunikation

## Gateway-Aktivierung

### Über Umgebungsvariablen (empfohlen)

Umgebungsvariablen haben **Priorität** über settings.json:

```bash
# Gateway global aktivieren
export QWEN_GATEWAYS_ENABLED=true

# Einzelne Gateways aktivieren
export QWEN_GATEWAY_DISCORD_ENABLED=true
export QWEN_GATEWAY_WHATSAPP_ENABLED=false
export QWEN_GATEWAY_TERMINAL_ENABLED=true
```

**Tipp:** `.env` Datei im Projekt-Hauptverzeichnis erstellen:
```bash
cd /home/torsten/dev/my-projects/qwen-code
cp .env.example .env
# .env bearbeiten und Werte eintragen
```

### Über settings.json

```json
{
  "gateways": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowedUserId": "YOUR_USER_ID",
      "allowedChannelId": "CHANNEL_ID",
      "pollingIntervalMs": 10000
    },
    "terminal": {
      "enabled": true,
      "inputPipe": "/tmp/qwen_cli_input",
      "outputPipe": "/tmp/qwen_cli_output",
      "useFileBased": true,
      "pollingIntervalMs": 1000
    }
  }
}
```

---

## Discord Gateway

### 1. Discord Bot erstellen

1. Gehe zu **[Discord Developer Portal](https://discord.com/developers/applications)**
2. Klicke auf **"New Application"**
3. Gib einen Namen ein und klicke **"Create"**
4. Gehe im linken Menü zu **"Bot"**
5. Klicke auf **"Add Bot"** → **"Yes, do it!"**
6. Unter **"Token"** klicke auf **"Copy"** oder **"Reset Token"**
   - ⚠️ **Token geheim halten!** Niemals committen oder teilen

### 2. Bot zum Server einladen

1. Gehe zu **"OAuth2"** → **"URL Generator"**
2. Wähle bei **Scopes**: `bot`
3. Wähle bei **Bot Permissions**:
   - `Send Messages`
   - `Read Message History`
   - `Embed Links` (optional)
4. Kopiere die generierte URL unten
5. Öffne die URL im Browser
6. Wähle deinen Discord Server und klicke **"Authorize"**

### 3. User ID und Channel ID ermitteln

**Developer Mode aktivieren:**
- Discord → Einstellungen (Zahnrad) → **Erweitert**
- **Entwicklermodus** aktivieren

**User ID (deine eigene):**
- Rechtsklick auf deinen Benutzernamen
- **"ID kopieren"** auswählen
- Beispiel: `123456789012345678`

**Channel ID:**
- Rechtsklick auf den gewünschten Text-Channel
- **"ID kopieren"** auswählen
- Beispiel: `987654321098765432`

### 4. Konfiguration

#### Option A: Umgebungsvariablen

Erstelle eine `.env` Datei im Projekt-Hauptverzeichnis oder exportiere im Terminal:

```bash
# Vom Projekt-Hauptverzeichnis
cd /home/torsten/dev/my-projects/qwen-code
cp .env.example .env
nano .env  # Token und IDs eintragen

# Hinweis: .env ist in .gitignore und wird nicht committet!

# Oder direkt im Terminal:
# Discord Gateway aktivieren
export QWEN_GATEWAY_DISCORD_ENABLED=true

# Bot Token (vom Discord Developer Portal)
export QWEN_GATEWAY_DISCORD_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GJKLmN.opqrstUVWXYZabcdefGHIJKL

# Deine Discord User ID
export QWEN_GATEWAY_DISCORD_USER_ID=123456789012345678

# Channel ID wo Nachrichten verarbeitet werden
export QWEN_GATEWAY_DISCORD_CHANNEL_ID=987654321098765432

# Polling Intervall in ms (optional, Standard: 10000)
export QWEN_GATEWAY_DISCORD_POLLING_INTERVAL_MS=10000
```

#### Option B: settings.json

Bearbeite `~/.qwen/settings.json`:

```json
{
  "gateways": {
    "discord": {
      "enabled": true,
      "token": "MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GJKLmN.opqrstUVWXYZabcdefGHIJKL",
      "allowedUserId": "123456789012345678",
      "allowedChannelId": "987654321098765432",
      "pollingIntervalMs": 10000
    }
  }
}
```

### 5. Starten

```bash
# Vom Projekt-Hauptverzeichnis
cd /home/torsten/dev/my-projects/qwen-code
./start-cli-with-gateway.sh setup
./start-cli-with-gateway.sh start
```

### 6. Testen

Schreibe im Discord Channel:
```
hello
```

Die CLI sollte nach ca. 10 Sekunden (Polling-Intervall) die Nachricht empfangen und antworten.

---

## WhatsApp Gateway

### Unterstützte Provider

- **Twilio WhatsApp API**
- **Meta WhatsApp Business Platform**
- **Web Bridge** (whatsapp-web.js)

### Konfiguration (Umgebungsvariablen)

```bash
# WhatsApp Gateway aktivieren
export QWEN_GATEWAY_WHATSAPP_ENABLED=true

# Provider: twilio, meta, oder web-bridge
export QWEN_GATEWAY_WHATSAPP_PROVIDER=meta

# Access Token vom Provider
export QWEN_GATEWAY_WHATSAPP_TOKEN=your_access_token

# Absender-Nummer (deine WhatsApp Business Nummer)
export QWEN_GATEWAY_WHATSAPP_SENDER_NUMBER=+491234567890

# Empfänger-Nummer (optional, für 1:1 Kommunikation)
export QWEN_GATEWAY_WHATSAPP_RECIPIENT_NUMBER=+490987654321

# API URL (optional, provider-spezifisch)
export QWEN_GATEWAY_WHATSAPP_API_URL=https://graph.facebook.com/v17.0

# Polling Intervall (optional, Standard: 10000ms)
export QWEN_GATEWAY_WHATSAPP_POLLING_INTERVAL_MS=10000
```

---

## Terminal Gateway

### Konfiguration (Umgebungsvariablen)

```bash
# Terminal Gateway aktivieren
export QWEN_GATEWAY_TERMINAL_ENABLED=true

# Input-Datei/Pipe für Befehle an CLI
export QWEN_GATEWAY_TERMINAL_INPUT_PIPE=/tmp/qwen_cli_input

# Output-Datei/Pipe für Ausgaben von CLI
export QWEN_GATEWAY_TERMINAL_OUTPUT_PIPE=/tmp/qwen_cli_output

# Datei-basiert (true) oder Pipe-basiert (false)
export QWEN_GATEWAY_TERMINAL_USE_FILE_BASED=true

# Polling Intervall (optional, Standard: 1000ms)
export QWEN_GATEWAY_TERMINAL_POLLING_INTERVAL_MS=1000
```

### Manuelles Setup

```bash
# Input/Output Dateien erstellen
mkfifo /tmp/qwen_cli_input /tmp/qwen_cli_output

# CLI starten
export QWEN_GATEWAY_TERMINAL_ENABLED=true
export QWEN_GATEWAY_TERMINAL_INPUT_PIPE=/tmp/qwen_cli_input
export QWEN_GATEWAY_TERMINAL_OUTPUT_PIPE=/tmp/qwen_cli_output
qwen

# In einem zweiten Terminal Befehle senden
echo "hello" > /tmp/qwen_cli_input
cat /tmp/qwen_cli_output
```

---

## Umgebungsvariablen Referenz

### Globale Einstellungen

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `QWEN_GATEWAYS_ENABLED` | Gateways global aktivieren/deaktivieren | `true` |
| `QWEN_GATEWAYS_POLLING_INTERVAL_MS` | Standard-Polling-Intervall für alle Gateways | `10000` |

### Discord

| Variable | Beschreibung | Erforderlich |
|----------|-------------|--------------|
| `QWEN_GATEWAY_DISCORD_ENABLED` | Discord Gateway aktivieren | Ja |
| `QWEN_GATEWAY_DISCORD_TOKEN` | Discord Bot Token | Ja |
| `QWEN_GATEWAY_DISCORD_USER_ID` | Deine Discord User ID | Ja |
| `QWEN_GATEWAY_DISCORD_CHANNEL_ID` | Channel ID für Nachrichten | Ja |
| `QWEN_GATEWAY_DISCORD_POLLING_INTERVAL_MS` | Polling-Intervall in ms | Nein (10000) |

### WhatsApp

| Variable | Beschreibung | Erforderlich |
|----------|-------------|--------------|
| `QWEN_GATEWAY_WHATSAPP_ENABLED` | WhatsApp Gateway aktivieren | Ja |
| `QWEN_GATEWAY_WHATSAPP_PROVIDER` | Provider: `twilio`, `meta`, `web-bridge` | Ja |
| `QWEN_GATEWAY_WHATSAPP_TOKEN` | Access Token | Ja |
| `QWEN_GATEWAY_WHATSAPP_SENDER_NUMBER` | Absender-Nummer | Ja |
| `QWEN_GATEWAY_WHATSAPP_RECIPIENT_NUMBER` | Empfänger-Nummer | Nein |
| `QWEN_GATEWAY_WHATSAPP_API_URL` | API Base URL | Nein |
| `QWEN_GATEWAY_WHATSAPP_POLLING_INTERVAL_MS` | Polling-Intervall in ms | Nein (10000) |

### Terminal

| Variable | Beschreibung | Erforderlich |
|----------|-------------|--------------|
| `QWEN_GATEWAY_TERMINAL_ENABLED` | Terminal Gateway aktivieren | Ja |
| `QWEN_GATEWAY_TERMINAL_INPUT_PIPE` | Pfad zur Input-Datei/Pipe | Ja |
| `QWEN_GATEWAY_TERMINAL_OUTPUT_PIPE` | Pfad zur Output-Datei/Pipe | Ja |
| `QWEN_GATEWAY_TERMINAL_USE_FILE_BASED` | Datei-basiert (true/false) | Nein (true) |
| `QWEN_GATEWAY_TERMINAL_POLLING_INTERVAL_MS` | Polling-Intervall in ms | Nein (1000) |

---

## Prioritäten-Reihenfolge

Wenn mehrere Konfigurationsquellen existieren:

1. **Umgebungsvariablen** (höchste Priorität)
2. **settings.json**
3. **Standardwerte** (niedrigste Priorität)

### Beispiel

```bash
# settings.json hat:
# "discord": { "enabled": false, "token": "old_token" }

# Umgebungsvariable setzt:
export QWEN_GATEWAY_DISCORD_ENABLED=true
export QWEN_GATEWAY_DISCORD_TOKEN=new_token

# Ergebnis: Discord ist AKTIV mit new_token
```

---

## Troubleshooting

### Gateway wird nicht initialisiert

**Prüfen:**
```bash
# Umgebungsvariablen anzeigen
env | grep QWEN_GATEWAY

# Gateway-Status im Log prüfen
tail -f /tmp/qwen-gateway.log
```

### Discord: Nachrichten werden nicht empfangen

**Mögliche Ursachen:**
- Bot ist nicht im Channel
- User ID oder Channel ID falsch
- Token ungültig

**Lösung:**
```bash
# Bot im Channel prüfen
# Rechtsklick auf Channel → ID kopieren → mit Config vergleichen

# Token validieren
curl -H "Authorization: Bot YOUR_TOKEN" https://discord.com/api/v10/users/@me
```

### Terminal: Output erscheint nicht

**Prüfen:**
```bash
# Existieren die Dateien?
ls -la /tmp/qwen_cli_input /tmp/qwen_cli_output

# Output manuell lesen
tail -f /tmp/qwen_cli_output
```

---

## Sicherheitshinweise

⚠️ **Wichtig:**

1. **Tokens niemals committen!**
   - Verwende `.env` Dateien (nicht versionieren)
   - Oder Umgebungsvariablen im Terminal setzen

2. **`.env` zur `.gitignore` hinzufügen:**
   ```
   .env
   *.env
   ```

3. **Discord Bot Permissions minimieren:**
   - Nur notwendige Permissions aktivieren
   - Regelmäßig überprüfen

4. **User/Channel IDs beschränken:**
   - Nur vertrauenswürdige User/Channels zulassen
   - `allowedUserId` und `allowedChannelId` setzen
