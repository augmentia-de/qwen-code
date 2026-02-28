# Gateway Test Schnellstart

## Test mit echter Qwen Code CLI (empfohlen)

### Option 1: Automatische Demo (empfohlen)

```bash
cd packages/cli/src/gateways
./start-cli-with-gateway.sh demo
```

Dies öffnet **zwei Terminal-Fenster** automatisch:
- Fenster 1: Qwen Code CLI mit Gateway-Support
- Fenster 2: Gateway Client zum Senden von Befehlen

### Option 2: Manueller Start

**Terminal 1: Setup und CLI Start**
```bash
cd packages/cli/src/gateways
./start-cli-with-gateway.sh setup
./start-cli-with-gateway.sh start
```

**Terminal 2: Client Start**
```bash
cd packages/cli/src/gateways
./start-cli-with-gateway.sh client
```

### Befehle testen

Im Client-Terminal eingeben:

```
> /help
> /about
> /stats
> Erkläre mir wie du funktionierst
```

Die CLI-Antworten erscheinen im Client-Terminal.

### Aufräumen

```bash
./start-cli-with-gateway.sh cleanup
```

### Option 3: Mit tmux

```bash
# tmux Session starten
tmux new-session -s gateway_test

# Pane teilen
Ctrl+b, dann %

# Links: CLI
./test-gateway.sh cli

# Rechts: Client (neues Pane auswählen mit Ctrl+b, dann Pfeiltaste)
./test-gateway.sh client
```

## Test-Befehle

Im Client-Terminal eingeben:

```
> ls
> pwd
> date
> echo hello
> help
> quit
```

## Ausgabe-Beispiel

```
=== CLI Mode ===
Listening on /tmp/qwen_test_input
Writing to /tmp/qwen_test_output

[CLI] Empfangen: ls
[CLI] Sende: total 24
drwxr-xr-x  5 user user 4096 Feb 28 10:00 .
...

=== Client Mode ===
> ls
[SENT] ls
[RESPONSE] total 24
[RESPONSE] drwxr-xr-x  5 user user 4096 Feb 28 10:00 .
...
```

## Aufräumen

```bash
./test-gateway.sh cleanup
```

## Architektur-Test

So testest du die vollständige Gateway-Architektur:

```bash
# 1. TypeScript Test-Skript (simuliert echtes Gateway)
npx ts-node test-terminal-gateway.ts cli

# 2. In einem zweiten Terminal
npx ts-node test-terminal-gateway.ts client
```

## Fehlerbehebung

### "Pipe existiert nicht"
```bash
./test-gateway.sh setup
```

### "Permission denied"
```bash
chmod +x test-gateway.sh
```

### Terminal-Emulator nicht gefunden
Manuell starten:
```bash
# Terminal 1
./test-gateway.sh cli

# Terminal 2 (in neuem Fenster)
./test-gateway.sh client
```
