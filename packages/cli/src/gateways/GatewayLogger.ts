/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Gateway Logger für Debug-Zwecke
 * 
 * Loggt alle Gateway-Ein-/Ausgänge in eine Datei
 */
export class GatewayLogger {
  private static instance: GatewayLogger | null = null;
  private logStream: fs.WriteStream | null = null;
  private logFilePath: string = '/tmp/qwen-gateway.log';
  private isInitialized = false;

  private constructor() {}

  /**
   * Singleton-Instanz holen
   */
  static getInstance(): GatewayLogger {
    if (!GatewayLogger.instance) {
      GatewayLogger.instance = new GatewayLogger();
    }
    return GatewayLogger.instance;
  }

  /**
   * Logger initialisieren
   */
  async initialize(logFilePath?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (logFilePath) {
      this.logFilePath = logFilePath;
    }

    // Verzeichnis erstellen falls nicht vorhanden
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Log-Stream öffnen (append mode)
    try {
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.isInitialized = true;
      this.log('[GatewayLogger] Initialisiert', 'INFO');
      this.log(`Log-Pfad: ${this.logFilePath}`, 'INFO');
    } catch (error) {
      console.error('[GatewayLogger] Failed to initialize:', error);
    }
  }

  /**
   * Log-Eintrag schreiben
   */
  log(message: string, level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR' | 'GATEWAY_IN' | 'GATEWAY_OUT' | 'CLI_IN' | 'CLI_OUT' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    // Immer in Console loggen (für Debug-Modus)
    if (level === 'ERROR' || level === 'WARN' || process.env['DEBUG']) {
      console.error(logLine.trim());
    }

    // In Datei schreiben
    if (this.logStream && this.isInitialized) {
      this.logStream.write(logLine);
    } else if (this.isInitialized && !this.logStream) {
      // Fallback: Direkt in Datei schreiben wenn Stream nicht verfügbar
      try {
        fs.appendFileSync(this.logFilePath, logLine);
      } catch {
        // Ignorieren
      }
    }
  }

  /**
   * Gateway-Eingabe loggen (von externem Service)
   */
  logGatewayInput(source: string, content: string): void {
    const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;
    this.log(`[${source}] INPUT: "${truncated}"`, 'GATEWAY_IN');
  }

  /**
   * Gateway-Ausgabe loggen (an externen Service)
   */
  logGatewayOutput(target: string, content: string): void {
    const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;
    this.log(`[${target}] OUTPUT: "${truncated}"`, 'GATEWAY_OUT');
  }

  /**
   * CLI-Eingabe loggen (vom User/Keypress)
   */
  logCliInput(source: 'keyboard' | 'gateway', content: string): void {
    const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;
    this.log(`[${source}] CLI_INPUT: "${truncated}"`, 'CLI_IN');
  }

  /**
   * CLI-Ausgabe loggen (an User/Gateway)
   */
  logCliOutput(content: string, destination: 'terminal' | 'gateway' | 'both' = 'both'): void {
    const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;
    this.log(`[${destination}] CLI_OUTPUT: "${truncated}"`, 'CLI_OUT');
  }

  /**
   * Logger schließen
   */
  async close(): Promise<void> {
    if (this.logStream) {
      this.log('[GatewayLogger] Wird geschlossen', 'INFO');
      this.logStream.end();
      this.logStream = null;
    }
    this.isInitialized = false;
  }

  /**
   * Log-Pfad holen
   */
  getLogPath(): string {
    return this.logFilePath;
  }
}

/**
 * Convenience-Funktion für schnellen Zugriff
 */
export function getGatewayLogger(): GatewayLogger {
  return GatewayLogger.getInstance();
}
