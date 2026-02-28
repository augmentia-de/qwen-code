/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseGateway } from './BaseGateway.js';
import type {
  GatewayToCliMessage,
  CliToGatewayMessage,
} from './types.js';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { getGatewayLogger } from './GatewayLogger.js';

/**
 * Terminal Gateway Konfiguration
 * 
 * Ermöglicht Terminal-zu-Terminal Kommunikation für Tests:
 * - Ein Terminal sendet Befehle an ein anderes Terminal
 * - Kommunikation über FIFO-Pipes oder Socket-Dateien
 */
export interface TerminalGatewayConfig {
  /** Pfad zur Input-Datei/Pipe (Befehle von User) */
  inputPipe: string;
  /** Pfad zur Output-Datei/Pipe (Ausgaben an User) */
  outputPipe: string;
  /** Polling-Intervall in ms (Standard: 10000) */
  pollingIntervalMs?: number;
  /** Datei-basiert (true) oder Socket-basiert (false) */
  useFileBased: boolean;
}

/**
 * Terminal Gateway für Qwen Code Interactive Mode
 * 
 * Ermöglicht unabhängige Tests durch Terminal-zu-Terminal Verbindung:
 * - Liest Befehle aus einer Input-Pipe/Datei (Polling alle 10s)
 * - Schreibt Ausgaben in eine Output-Pipe/Datei
 * - Ideal für automatisierte Tests und Remote-Verbindungen
 * 
 * Beispiel für Test-Setup:
 * ```bash
 * # Terminal 1 (CLI)
 * mkfifo /tmp/qwen_input /tmp/qwen_output
 * qwen --gateway=terminal --input-pipe=/tmp/qwen_input --output-pipe=/tmp/qwen_output
 * 
 * # Terminal 2 (Test/Remote)
 * echo "ls -la" > /tmp/qwen_input
 * cat /tmp/qwen_output
 * ```
 * 
 * Beispielkonfiguration in settings.json:
 * ```json
 * {
 *   "gateways": {
 *     "terminal": {
 *       "enabled": true,
 *       "inputPipe": "/tmp/qwen_input",
 *       "outputPipe": "/tmp/qwen_output",
 *       "useFileBased": true,
 *       "pollingIntervalMs": 1000
 *     }
 *   }
 * }
 * ```
 */
export class TerminalGateway extends BaseGateway {
  readonly type = 'terminal';

  private config: TerminalGatewayConfig;
  private outputFd: fs.WriteStream | null = null;
  private logger = getGatewayLogger();

  constructor(config: TerminalGatewayConfig) {
    super();
    this.config = config;
    if (config.pollingIntervalMs) {
      this.pollingIntervalMs = config.pollingIntervalMs;
    }
  }

  async initialize(): Promise<void> {
    this.setStatus('connecting');
    this.logger.log(`TerminalGateway wird initialisiert: input=${this.config.inputPipe}, output=${this.config.outputPipe}`, 'INFO');

    try {
      // Pipes/Dateien validieren und vorbereiten
      await this.validatePipes();
      this.setStatus('connected');
      this.logger.log('TerminalGateway erfolgreich initialisiert', 'INFO');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('error', errorMessage);
      this.logger.log(`TerminalGateway Initialisierung fehlgeschlagen: ${errorMessage}`, 'ERROR');
      throw new Error(`Terminal Gateway initialization failed: ${errorMessage}`);
    }
  }

  async start(): Promise<void> {
    if (this.status !== 'connected') {
      throw new Error('Gateway not initialized');
    }

    this.logger.log('Starte TerminalGateway...', 'INFO');

    // Output-Stream öffnen (für FIFO-Pipes)
    try {
      this.outputFd = fs.createWriteStream(this.config.outputPipe, { flags: 'a' });
      this.outputFd.on('error', (error) => {
        this.logger.log(`Output-Stream Fehler: ${error}`, 'ERROR');
      });
      this.outputFd.on('open', () => {
        this.logger.log('Output-Stream geöffnet', 'DEBUG');
      });
      this.logger.log(`Output-Stream erstellt für: ${this.config.outputPipe}`, 'DEBUG');
    } catch (error) {
      this.logger.log(`Fehler beim Öffnen des Output-Streams: ${error}`, 'ERROR');
    }

    // Starte Polling für neue Nachrichten
    this.startPolling(async () => await this.pollMessages());
  }

  async stop(): Promise<void> {
    this.stopPolling();
    
    if (this.outputFd) {
      this.outputFd.end();
      this.outputFd = null;
    }
    
    this.setStatus('disconnected');
  }

  async send(message: CliToGatewayMessage): Promise<void> {
    if (this.status !== 'connected') {
      this.logger.log(`Send fehlgeschlagen: Gateway nicht verbunden (Status: ${this.status})`, 'ERROR');
      throw new Error('Gateway not connected');
    }

    const output = this.formatOutputMessage(message);
    this.logger.logGatewayOutput('terminal', output);
    
    // Output direkt in Datei schreiben (append)
    try {
      fs.appendFileSync(this.config.outputPipe, output + '\n');
      this.logger.log(`Nachricht in Output-Datei geschrieben: ${this.config.outputPipe}`, 'DEBUG');
    } catch (error) {
      this.logger.log(`Fehler beim Schreiben in Output-Datei: ${error}`, 'ERROR');
    }
  }

  /**
   * Validiert und erstellt die Pipes/Dateien
   */
  private async validatePipes(): Promise<void> {
    const inputPath = this.config.inputPipe;
    const outputPath = this.config.outputPipe;

    // Input-Pipe validieren
    if (this.config.useFileBased) {
      // Datei-basiert: Datei erstellen falls nicht vorhanden
      if (!fs.existsSync(inputPath)) {
        fs.writeFileSync(inputPath, '');
      }
    } else {
      // Pipe-basiert: Pipe erstellen falls nicht vorhanden
      if (!fs.existsSync(inputPath)) {
        try {
          execSync(`mkfifo "${inputPath}"`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw new Error(`Failed to create input pipe: ${error}`);
          }
        }
      }
    }

    // Output-Pipe validieren
    if (!fs.existsSync(outputPath)) {
      if (this.config.useFileBased) {
        fs.writeFileSync(outputPath, '');
      } else {
        try {
          execSync(`mkfifo "${outputPath}"`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw new Error(`Failed to create output pipe: ${error}`);
          }
        }
      }
    }
  }

  /**
   * Pollt neue Nachrichten aus der Input-Datei
   * 
   * Liest die gesamte Datei, leert sie SOFORT (vor der Verarbeitung),
   * und verarbeitet dann die Nachrichten. Verhindert Race Conditions.
   */
  private async pollMessages(): Promise<GatewayToCliMessage[]> {
    const newMessages: GatewayToCliMessage[] = [];

    try {
      if (this.config.useFileBased) {
        // Datei-basiertes Polling
        if (!fs.existsSync(this.config.inputPipe)) {
          return newMessages;
        }

        // 1. GESAMTE Datei lesen
        const content = fs.readFileSync(this.config.inputPipe, 'utf-8');
        
        // 2. SOFORT leeren (NOCH VOR der Verarbeitung!)
        // Verhindert dass gleiche Nachricht mehrfach gelesen wird
        fs.writeFileSync(this.config.inputPipe, '');
        
        // 3. Erst jetzt Nachrichten verarbeiten
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
            continue; // Leere Zeilen und Kommentare überspringen
          }

          this.logger.logGatewayInput('terminal', trimmedLine);

          const gatewayMessage: GatewayToCliMessage = {
            id: this.generateMessageId(),
            source: 'terminal',
            senderId: 'terminal-user',
            content: trimmedLine,
            timestamp: Date.now(),
            metadata: {
              inputPipe: this.config.inputPipe,
            },
          };

          newMessages.push(gatewayMessage);
          await this.enqueueMessage(gatewayMessage);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.log(`Polling Fehler: ${error}`, 'ERROR');
        console.error('[TerminalGateway] Polling error:', error);
      }
    }

    return newMessages;
  }

  /**
   * Formatiert eine CLI-Ausgabenachricht für das Terminal
   */
  private formatOutputMessage(message: CliToGatewayMessage): string {
    const typePrefix = this.getTypePrefix(message.type);
    return `${typePrefix}${message.content}`;
  }

  /**
   * Gibt Präfix basierend auf Nachrichtentyp zurück
   */
  private getTypePrefix(type: string): string {
    switch (type) {
      case 'error':
        return '❌ ERROR: ';
      case 'status':
        return 'ℹ️ STATUS: ';
      case 'tool_result':
        return '🔧 TOOL: ';
      default:
        return '';
    }
  }

  /**
   * Löscht die Input-Pipe nach verarbeiteten Nachrichten
   * (Optional, kann bei Bedarf aufgerufen werden)
   */
  async clearInputPipe(): Promise<void> {
    if (this.config.useFileBased) {
      fs.writeFileSync(this.config.inputPipe, '');
    }
  }
}

/**
 * Hilfsfunktion zum Erstellen von Test-Pipes
 * 
 * Verwendung in Tests:
 * ```typescript
 * const { inputPipe, outputPipe, cleanup } = await createTestPipes();
 * // ... Test durchführen
 * await cleanup();
 * ```
 */
export async function createTestPipes(baseName = '/tmp/qwen_test'): Promise<{
  inputPipe: string;
  outputPipe: string;
  cleanup: () => Promise<void>;
}> {
  const timestamp = Date.now();
  const inputPipe = `${baseName}_input_${timestamp}`;
  const outputPipe = `${baseName}_output_${timestamp}`;

  // Pipes erstellen
  try {
    execSync(`mkfifo "${inputPipe}"`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }

  try {
    execSync(`mkfifo "${outputPipe}"`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }

  const cleanup = async () => {
    try {
      fs.unlinkSync(inputPipe);
    } catch {
      // Ignorieren falls nicht vorhanden
    }
    try {
      fs.unlinkSync(outputPipe);
    } catch {
      // Ignorieren falls nicht vorhanden
    }
  };

  return { inputPipe, outputPipe, cleanup };
}
