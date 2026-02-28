#!/bin/bash
#
# Test-Skript für Gateway Terminal-zu-Terminal Verbindung
#
# Verwendung:
#   ./test-gateway.sh [setup|cli|client|cleanup|demo]
#
# Modi:
#   setup   - Erstellt die Pipes und zeigt Anweisungen
#   cli     - Startet CLI Simulator im Hintergrund
#   client  - Startet interaktiven Client
#   cleanup - Entfernt die Pipes
#   demo    - Startet automatisch CLI und Client in zwei Fenstern
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_PIPE="/tmp/qwen_test_input"
OUTPUT_PIPE="/tmp/qwen_test_output"

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Gateway Terminal Test${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pipes erstellen
setup_pipes() {
    print_header
    print_info "Erstelle Pipes..."
    
    # Existierende Pipes entfernen
    cleanup_pipes 2>/dev/null || true
    
    # Neue Pipes erstellen
    if mkfifo "$INPUT_PIPE" 2>/dev/null; then
        print_info "Input Pipe erstellt: $INPUT_PIPE"
    else
        print_error "Konnte Input Pipe nicht erstellen"
        exit 1
    fi
    
    if mkfifo "$OUTPUT_PIPE" 2>/dev/null; then
        print_info "Output Pipe erstellt: $OUTPUT_PIPE"
    else
        print_error "Konnte Output Pipe nicht erstellen"
        exit 1
    fi
    
    echo
    print_info "Pipes erfolgreich erstellt!"
    echo
    print_info "Nächste Schritte:"
    echo "  1. Terminal 1: ./test-gateway.sh cli"
    echo "  2. Terminal 2: ./test-gateway.sh client"
    echo
    print_warning "Pipes werden automatisch beim Beenden der Prozesse entfernt"
}

# Pipes entfernen
cleanup_pipes() {
    print_info "Entferne Pipes..."
    rm -f "$INPUT_PIPE" "$OUTPUT_PIPE" 2>/dev/null || true
    print_info "Pipes entfernt"
}

# CLI Simulator starten
start_cli() {
    print_header
    print_info "Starte CLI Simulator..."
    print_info "Input:  $INPUT_PIPE"
    print_info "Output: $OUTPUT_PIPE"
    echo
    print_warning "Drücke Strg+C zum Beenden"
    echo
    
    # Cleanup bei Exit
    trap cleanup_pipes EXIT INT TERM
    
    # Output-Stream im Hintergrund lesen und anzeigen
    (
        while true; do
            if [ -p "$OUTPUT_PIPE" ]; then
                cat "$OUTPUT_PIPE" 2>/dev/null || true
            fi
            sleep 0.1
        done
    ) &
    OUTPUT_READER_PID=$!
    
    # Cleanup bei Exit
    trap "kill $OUTPUT_READER_PID 2>/dev/null; cleanup_pipes" EXIT INT TERM
    
    print_info "Warte auf eingehende Befehle..."
    echo
    
    # Input-Pipe lesen und Befehle verarbeiten
    while true; do
        if read -r line < "$INPUT_PIPE" 2>/dev/null; then
            # Leere Zeilen und Kommentare überspringen
            if [[ -z "$line" || "$line" =~ ^# ]]; then
                continue
            fi
            
            echo -e "${YELLOW}[CLI]${NC} Empfangen: $line"
            
            # Befehl verarbeiten
            response=$(process_command "$line")
            
            echo -e "${GREEN}[CLI]${NC} Sende: $response"
            
            # Antwort schreiben
            echo "$response" > "$OUTPUT_PIPE" &
        fi
        sleep 0.1
    done
}

# Client starten
start_client() {
    print_header
    print_info "Starte Client..."
    print_info "Input:  $INPUT_PIPE"
    print_info "Output: $OUTPUT_PIPE"
    echo
    print_info "Verfügbare Befehle: ls, pwd, date, echo hello, help, quit"
    echo
    
    # Pipes prüfen
    if [ ! -p "$INPUT_PIPE" ]; then
        print_error "Input Pipe existiert nicht: $INPUT_PIPE"
        print_info "Führe zuerst './test-gateway.sh setup' aus"
        exit 1
    fi
    
    if [ ! -p "$OUTPUT_PIPE" ]; then
        print_error "Output Pipe existiert nicht: $OUTPUT_PIPE"
        print_info "Führe zuerst './test-gateway.sh setup' aus"
        exit 1
    fi
    
    # Cleanup bei Exit
    trap cleanup_pipes EXIT INT TERM
    
    # Output im Hintergrund lesen
    (
        while true; do
            if [ -p "$OUTPUT_PIPE" ]; then
                cat "$OUTPUT_PIPE" 2>/dev/null | while read -r line; do
                    if [ -n "$line" ]; then
                        echo -e "${BLUE}[RESPONSE]${NC} $line"
                    fi
                done
            fi
            sleep 0.1
        done
    ) &
    OUTPUT_READER_PID=$!
    
    # Cleanup bei Exit
    trap "kill $OUTPUT_READER_PID 2>/dev/null; cleanup_pipes" EXIT INT TERM
    
    # Interaktive Eingabe
    while true; do
        echo -n "> "
        read -r command
        
        if [[ "$command" == "quit" || "$command" == "exit" ]]; then
            print_info "Beende Client..."
            break
        fi
        
        if [ -n "$command" ]; then
            # Befehl senden
            echo "$command" > "$INPUT_PIPE" &
            echo -e "${YELLOW}[SENT]${NC} $command"
        fi
    done
}

# Befehl verarbeiten (simuliert)
process_command() {
    local cmd="$1"
    
    case "$cmd" in
        ls|ls\ -la)
            echo "total 24
drwxr-xr-x  5 user user 4096 Feb 28 10:00 .
drwxr-xr-x 10 user user 4096 Feb 28 09:00 ..
-rw-r--r--  1 user user  123 Feb 28 10:00 file1.txt
-rw-r--r--  1 user user  456 Feb 28 10:00 file2.txt
drwxr-xr-x  3 user user 4096 Feb 28 10:00 src"
            ;;
        pwd)
            pwd
            ;;
        date)
            date
            ;;
        echo\ hello)
            echo "hello"
            ;;
        help)
            echo "Verfügbare Befehle:
  ls          - Dateien auflisten
  pwd         - Aktuelles Verzeichnis
  date        - Aktuelles Datum
  echo hello  - Nachricht ausgeben
  help        - Diese Hilfe
  quit        - Client beenden"
            ;;
        *)
            echo "[$(date -Iseconds)] Befehl ausgeführt: $cmd"
            ;;
    esac
}

# Demo-Modus: Öffnet zwei Terminal-Fenster
start_demo() {
    print_header
    print_info "Starte Demo mit zwei Terminal-Fenstern..."
    echo
    
    # Terminal-Emulator erkennen
    TERMINAL=""
    
    if command -v gnome-terminal &> /dev/null; then
        TERMINAL="gnome-terminal"
        TERMINAL_ARGS=("--" bash -c)
    elif command -v konsole &> /dev/null; then
        TERMINAL="konsole"
        TERMINAL_ARGS=("-e" bash -c)
    elif command -v xterm &> /dev/null; then
        TERMINAL="xterm"
        TERMINAL_ARGS=("-e" bash -c)
    elif command -v alacritty &> /dev/null; then
        TERMINAL="alacritty"
        TERMINAL_ARGS=("-e" bash -c)
    elif command -v kitty &> /dev/null; then
        TERMINAL="kitty"
        TERMINAL_ARGS=("-e" bash -c)
    elif command -v tmux &> /dev/null; then
        TERMINAL="tmux"
    else
        print_error "Kein unterstützter Terminal-Emulator gefunden"
        print_info "Unterstützt: gnome-terminal, konsole, xterm, alacritty, kitty, tmux"
        echo
        print_info "Manueller Start:"
        echo "  Terminal 1: ./test-gateway.sh cli"
        echo "  Terminal 2: ./test-gateway.sh client"
        exit 1
    fi
    
    # Setup
    setup_pipes
    
    print_info "Öffne Terminal-Fenster..."
    
    if [ "$TERMINAL" == "tmux" ]; then
        # tmux Variante
        tmux new-session -d -s gateway_test
        tmux split-window -h -t gateway_test
        tmux send-keys -t gateway_test:0.0 "$SCRIPT_DIR/test-gateway.sh cli" Enter
        tmux send-keys -t gateway_test:0.1 "$SCRIPT_DIR/test-gateway.sh client" Enter
        tmux attach -t gateway_test
    else
        # Andere Terminal-Emulatoren
        "$TERMINAL" "${TERMINAL_ARGS[@]}" "$SCRIPT_DIR/test-gateway.sh cli" &
        sleep 1
        "$TERMINAL" "${TERMINAL_ARGS[@]}" "$SCRIPT_DIR/test-gateway.sh client" &
    fi
    
    echo
    print_info "Zwei Terminal-Fenster wurden geöffnet!"
    print_info "Schließe beide Fenster zum Beenden"
}

# Hauptfunktion
main() {
    local mode="${1:-help}"
    
    case "$mode" in
        setup)
            setup_pipes
            ;;
        cli)
            start_cli
            ;;
        client)
            start_client
            ;;
        cleanup)
            cleanup_pipes
            ;;
        demo)
            start_demo
            ;;
        help|--help|-h)
            print_header
            echo "Verwendung: $0 [setup|cli|client|cleanup|demo]"
            echo
            echo "Modi:"
            echo "  setup   - Erstellt die Pipes und zeigt Anweisungen"
            echo "  cli     - Startet CLI Simulator (Terminal 1)"
            echo "  client  - Startet interaktiven Client (Terminal 2)"
            echo "  cleanup - Entfernt die Pipes"
            echo "  demo    - Startet automatisch zwei Terminal-Fenster"
            echo
            echo "Beispiele:"
            echo "  $0 setup     # Pipes erstellen"
            echo "  $0 demo      # Automatische Demo starten"
            echo "  $0 cli       # CLI im aktuellen Terminal starten"
            echo "  $0 client    # Client im aktuellen Terminal starten"
            echo
            ;;
        *)
            print_error "Unbekannter Modus: $mode"
            echo "Verwende '$0 help' für Hilfe"
            exit 1
            ;;
    esac
}

main "$@"
