# Gateway Debug-Logging

## Log-Datei

Alle Gateway-Ereignisse werden in `/tmp/qwen-gateway.log` protokolliert.

## Log-Level

| Level | Beschreibung |
|-------|-------------|
| `INFO` | Allgemeine Informationen (Start, Stop, etc.) |
| `DEBUG` | Detaillierte Debug-Informationen |
| `WARN` | Warnungen |
| `ERROR` | Fehler |
| `GATEWAY_IN` | Eingehende Gateway-Nachrichten |
| `GATEWAY_OUT` | Ausgehende Gateway-Nachrichten |
| `CLI_IN` | CLI-Eingaben (Keyboard/Gateway) |
| `CLI_OUT` | CLI-Ausgaben (an Terminal/Gateway) |

## Log-Datei anzeigen

```bash
# Live-Mitlesen
tail -f /tmp/qwen-gateway.log

# Letzte 50 Zeilen
tail -n 50 /tmp/qwen-gateway.log

# Nach Fehlern suchen
grep ERROR /tmp/qwen-gateway.log

# Nach Gateway-Eingängen suchen
grep GATEWAY_IN /tmp/qwen-gateway.log
```

## Typische Probleme und Lösungen

### Problem: CLI bleibt nach Eingabe hängen

**Symptome:**
- Gateway-Eingabe kommt an (`GATEWAY_IN`)
- Keypresses werden simuliert (`CLI_IN`)
- Aber keine Antwort von CLI

**Diagnose:**
```bash
# Logs prüfen
tail -f /tmp/qwen-gateway.log | grep -E '(GATEWAY_IN|CLI_IN|CLI_OUT)'

# Typisches Muster bei Hänger:
# [GATEWAY_IN] INPUT: "/help"
# [CLI_IN] gateway: "/help"
# ... keine weiteren Einträge ...
```

**Mögliche Ursachen:**
1. **Input-Pipe wird nicht geleert**: Die CLI liest die gleiche Nachricht mehrfach
   - Lösung: `useFileBased: true` sicherstellen
   - Input-Pipe nach dem Lesen leeren

2. **Keypress-Handler nicht verbunden**: Gateway-Eingaben erreichen den InputPrompt nicht
   - Lösung: Prüfen ob `injectGatewayInput` aufgerufen wird
   - Debug-Modus aktivieren: `DEBUG=true qwen`

3. **CLI wartet auf Eingabe**: Stream ist blockiert
   - Lösung: Terminal neustarten
   - Raw-Mode prüfen

### Problem: Gateway-Ausgaben kommen nicht an

**Symptome:**
- CLI produziert Output
- Aber Output erscheint nicht im Gateway

**Diagnose:**
```bash
# Nach CLI-Ausgaben suchen
grep CLI_OUT /tmp/qwen-gateway.log

# Nach Gateway-Ausgaben suchen
grep GATEWAY_OUT /tmp/qwen-gateway.log

# Typisches Muster bei funktionierendem Output:
# [CLI_OUT] Content-Event empfangen: "Hello..."
# [GATEWAY_OUT] Sende an Gateway (output): "Hello..."
# [GATEWAY_OUT] terminal OUTPUT: "[timestamp] Hello..."
```

**Mögliche Ursachen:**
1. **Gateway nicht verbunden**: Status ist nicht 'connected'
   - Lösung: `grep "Gateway-Status" /tmp/qwen-gateway.log`
   - Gateway neu initialisieren

2. **Output-Pipe nicht verfügbar**: Pipe existiert nicht oder ist voll
   - Lösung: `ls -la /tmp/qwen_cli_output`
   - Pipe neu erstellen

## Debug-Modus aktivieren

```bash
# Mit Debug-Logging starten
DEBUG=true qwen

# Oder mit Gateway-spezifischem Debug
DEBUG=NON_INTERACTIVE_CLI,GATEWAY_STARTUP,KEYPRESS qwen
```

## Log-Einträge (Beispiel)

```
[2025-02-28T12:00:00.000Z] [INFO] === Gateway Initialisierung gestartet ===
[2025-02-28T12:00:00.001Z] [INFO] Log-Pfad: /tmp/qwen-gateway.log
[2025-02-28T12:00:00.002Z] [INFO] TerminalGateway wird initialisiert: input=/tmp/qwen_cli_input, output=/tmp/qwen_cli_output
[2025-02-28T12:00:00.003Z] [INFO] TerminalGateway erfolgreich initialisiert
[2025-02-28T12:00:00.004Z] [INFO] Gateway-Service erfolgreich gestartet mit 1 Gateway(s)
[2025-02-28T12:00:01.000Z] [DEBUG] Polling für neue Nachrichten gestartet
[2025-02-28T12:00:01.001Z] [DEBUG] Input Pipe gelesen: 15 Bytes, letzte Position: 0
[2025-02-28T12:00:01.002Z] [DEBUG] Neue Zeilen gefunden: 1
[2025-02-28T12:00:01.003Z] [GATEWAY_IN] [terminal] INPUT: "/help"
[2025-02-28T12:00:01.004Z] [INFO] Gateway-Eingabe empfangen: /help...
[2025-02-28T12:00:01.005Z] [DEBUG] injectGatewayInput aufgerufen: "/help..."
[2025-02-28T12:00:01.006Z] [DEBUG] Starte Verarbeitung von Gateway-Eingabe
[2025-02-28T12:00:01.007Z] [DEBUG] Simuliere 5 Keypresses
[2025-02-28T12:00:01.050Z] [CLI_IN] [gateway] CLI_INPUT: "/help"
[2025-02-28T12:00:01.051Z] [DEBUG] Gateway-Eingabe verarbeitet
[2025-02-28T12:00:02.000Z] [CLI_OUT] Content-Event empfangen: "Available commands..."
[2025-02-28T12:00:02.001Z] [GATEWAY_OUT] Sende an Gateway (output): "Available commands..."
[2025-02-28T12:00:02.002Z] [GATEWAY_OUT] [terminal] OUTPUT: "[timestamp] Available commands..."
```

## Performance-Optimierung

Bei zu vielen Log-Einträgen:

```bash
# Nur Fehler loggen
# In GatewayLogger.ts: level-Filter hinzufügen

# Log-Rotation einrichten
logrotate /etc/logrotate.d/qwen-gateway
```

## Log-Datei zurücksetzen

```bash
# Log leeren
> /tmp/qwen-gateway.log

# Log löschen (wird neu erstellt)
rm /tmp/qwen-gateway.log
```
