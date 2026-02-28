# Gateway-Architektur für Qwen Code Interactive Mode

## Übersicht

Diese Architektur ermöglicht die Erweiterung des Qwen Code Interactive Mode um externe Gateways wie Discord, WhatsApp oder Terminal-zu-Terminal-Verbindungen. Gateways können **zusätzlich** zur lokalen CLI-Eingabe verwendet werden.

## Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    Qwen Code Interactive Mode                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  KeypressProvider│  │  GatewayIntegration │  │  useGeminiStream │ │
│  │  (Terminal Input)│  │  (Gateway Input)    │  │  (Command Processing)│ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Gateway Manager     │
                    │  (Koordiniert Gateways) │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────┐           ┌─────▼─────┐          ┌──────▼──────┐
    │ Discord │           │ WhatsApp  │          │  Terminal   │
    │ Gateway │           │  Gateway  │          │   Gateway   │
    │ (10s Poll)│          │ (10s Poll) │          │ (File/Pipe) │
    └─────────┘           └───────────┘          └─────────────┘
```

## Komponenten

### 1. BaseGateway (`BaseGateway.ts`)

Abstrakte Basisklasse für alle Gateway-Implementierungen:

```typescript
abstract class BaseGateway implements Gateway {
  abstract readonly type: string;
  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(message: CliToGatewayMessage): Promise<void>;
  
  // Helper-Methoden
  protected startPolling(pollFn: () => Promise<GatewayToCliMessage[]>): void;
  protected notifyMessageHandlers(message: GatewayToCliMessage): void;
  protected setStatus(status: GatewayStatus): void;
}
```

### 2. DiscordGateway (`DiscordGateway.ts`)

Verbindet mit Discord über die REST API:

- **Polling-Intervall**: 10 Sekunden (konfigurierbar)
- **Authentifizierung**: Discord Bot Token
- **Nachrichtenfilter**: User ID + Channel ID

### 3. WhatsAppGateway (`WhatsAppGateway.ts`)

Unterstützt verschiedene WhatsApp API-Provider:

- **Twilio WhatsApp API**
- **Meta WhatsApp Business Platform**
- **Web Bridge** (whatsapp-web.js)

### 4. TerminalGateway (`TerminalGateway.ts`)

Ermöglicht Terminal-zu-Terminal-Kommunikation für Tests:

- **Datei-basiert**: Liest/schreibt in Dateien
- **Pipe-basiert**: Verwendet FIFO-Pipes
- **Polling-Intervall**: Konfigurierbar (Standard: 10s)

### 5. GatewayManager (`GatewayManager.ts`)

Verwaltet mehrere Gateway-Instanzen:

```typescript
const manager = createGatewayManager({
  gateways: [
    { type: 'discord', enabled: true, config: {...} },
    { type: 'terminal', enabled: true, config: {...} },
  ]
});

await manager.start();
```

### 6. GatewayIntegration (`GatewayIntegration.ts`)

Verbindet Gateway Manager mit dem Interactive Mode:

```typescript
const integration = new GatewayIntegration(gatewayManager);

integration.onInput((content) => {
  // Eingabe in Interactive Mode einspeisen
});

integration.sendOutput('Hello from CLI');
```

## Konfiguration

### settings.json

```json
{
  "gateways": {
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "allowedUserId": "123456789",
      "allowedChannelId": "987654321",
      "pollingIntervalMs": 10000
    },
    "whatsapp": {
      "enabled": false,
      "provider": "meta",
      "token": "YOUR_WHATSAPP_TOKEN",
      "senderNumber": "+491234567890",
      "recipientNumber": "+490987654321",
      "pollingIntervalMs": 10000
    },
    "terminal": {
      "enabled": true,
      "inputPipe": "/tmp/qwen_input",
      "outputPipe": "/tmp/qwen_output",
      "useFileBased": true,
      "pollingIntervalMs": 1000
    }
  }
}
```

### Umgebungsvariablen

```bash
# Discord
export DISCORD_TOKEN="your_bot_token"
export DISCORD_USER_ID="your_user_id"
export DISCORD_CHANNEL_ID="channel_id"

# WhatsApp (Meta)
export WHATSAPP_TOKEN="your_access_token"
export WHATSAPP_SENDER_NUMBER="+491234567890"
export WHATSAPP_RECIPIENT_NUMBER="+490987654321"
```

## Test-Szenarien

### 1. Terminal-zu-Terminal Test mit echter Qwen Code CLI

**Schnellstart (automatisch):**
```bash
cd packages/cli/src/gateways
./start-cli-with-gateway.sh demo
```

Dies öffnet zwei Terminal-Fenster:
- Fenster 1: Qwen Code CLI mit Gateway-Support
- Fenster 2: Gateway Client zum Senden von Befehlen

**Manueller Start:**
```bash
# Terminal 1: Setup durchführen
cd packages/cli/src/gateways
./start-cli-with-gateway.sh setup

# Terminal 1: Qwen CLI starten
./start-cli-with-gateway.sh start

# Terminal 2: Gateway Client starten
./start-cli-with-gateway.sh client
```

**Befehle im Client senden:**
```bash
# Im Client-Terminal eingeben:
> /help
> /about
> Schreibe eine Funktion die Primzahlen prüft
```

**Aufräumen:**
```bash
./start-cli-with-gateway.sh cleanup
```

### 2. Terminal-zu-Terminal Test (einfache Version)

```bash
# Terminal 1: CLI starten
mkfifo /tmp/qwen_input /tmp/qwen_output
qwen --gateway=terminal \
     --input-pipe=/tmp/qwen_input \
     --output-pipe=/tmp/qwen_output

# Terminal 2: Befehle senden
echo "ls -la" > /tmp/qwen_input

# Terminal 2: Ausgaben lesen
cat /tmp/qwen_output
```

### 2. Automatisierter Test mit Node.js

```javascript
// test-gateway.js
const fs = require('fs');

const INPUT_PIPE = '/tmp/qwen_input';
const OUTPUT_PIPE = '/tmp/qwen_output';

// Befehl senden
fs.writeFileSync(INPUT_PIPE, 'echo "Hello from test"\n');

// Ausgabe lesen (mit Timeout)
setTimeout(() => {
  const output = fs.readFileSync(OUTPUT_PIPE, 'utf-8');
  console.log('Received:', output);
}, 2000);
```

### 3. Discord Test

```bash
# Discord Bot Token setzen
export DISCORD_TOKEN="your_bot_token"
export DISCORD_USER_ID="your_user_id"
export DISCORD_CHANNEL_ID="your_channel_id"

# CLI mit Discord Gateway starten
qwen --gateway=discord
```

## Nachrichtenformate

### Gateway → CLI (Eingabe)

```typescript
interface GatewayToCliMessage {
  id: string;              // Eindeutige Nachrichten-ID
  source: string;          // 'discord', 'whatsapp', 'terminal'
  senderId: string;        // Absender-ID
  content: string;         // Nachrichtentext
  timestamp: number;       // Zeitstempel
  metadata?: object;       // Optionale Metadaten
}
```

### CLI → Gateway (Ausgabe)

```typescript
interface CliToGatewayMessage {
  id: string;              // Eindeutige Nachrichten-ID
  target: string;          // Ziel-Gateway
  recipientId?: string;    // Ziel-Empfänger
  type: 'output' | 'error' | 'status' | 'tool_result';
  content: string;         // Nachrichteninhalt
  timestamp: number;       // Zeitstempel
  metadata?: object;       // Optionale Metadaten
}
```

## Erweiterung um weitere Gateways

### Neues Gateway erstellen

```typescript
import { BaseGateway } from './BaseGateway.js';

export class CustomGateway extends BaseGateway {
  readonly type = 'custom';

  async initialize(): Promise<void> {
    // Initialisierungslogik
    this.setStatus('connected');
  }

  async start(): Promise<void> {
    // Start-Logik (z.B. Polling starten)
    this.startPolling(async () => await this.pollMessages());
  }

  async stop(): Promise<void> {
    // Cleanup-Logik
    this.stopPolling();
    this.setStatus('disconnected');
  }

  async send(message: CliToGatewayMessage): Promise<void> {
    // Sende-Logik
  }

  private async pollMessages(): Promise<GatewayToCliMessage[]> {
    // Polling-Logik
    return [];
  }
}
```

### Gateway im Manager registrieren

```typescript
// In GatewayManager.ts initializeFromConfig() erweitern:
case 'custom':
  gateway = new CustomGateway({
    // Konfiguration
  });
  break;
```

## Sicherheitsaspekte

1. **Authentifizierung**: Jeder Gateway-Typ erfordert Token/credentials
2. **Autorisierung**: Discord/WhatsApp filtern nach User/Channel IDs
3. **Input-Validierung**: Alle Gateway-Eingaben werden wie Terminal-Eingaben behandelt
4. **Rate Limiting**: Polling-Intervalle verhindern API-Überlastung

## Performance

- **Polling-Intervall**: Standard 10 Sekunden (balance zwischen Latenz und API-Last)
- **Nachrichten-Queue**: Verhindert Nachrichtenverlust bei kurzen Unterbrechungen
- **Broadcast-Optimierung**: Paralleles Senden an alle Gateways

## Troubleshooting

### Gateway verbindet nicht

1. Token/Credentials prüfen
2. Netzwerkverbindung testen
3. Firewall-Einstellungen prüfen

### Nachrichten werden nicht empfangen

1. Polling-Intervall verringern
2. User/Channel IDs prüfen
3. Gateway-Status mit `getGatewayStatuses()` prüfen

### Ausgabe erscheint nicht im Gateway

1. `enableOutput()` wurde aufgerufen?
2. Gateway-Status ist 'connected'?
3. Output-Pipe/Channel existiert?
