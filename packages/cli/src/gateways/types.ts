/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gateway Message Types für die Kommunikation zwischen
 * Interactive Mode und externen Gateways (Discord, WhatsApp, Terminal, etc.)
 */

/**
 * Nachricht von Gateway an CLI (Eingabe)
 */
export interface GatewayToCliMessage {
  /** Eindeutige Nachrichten-ID */
  id: string;
  /** Gateway-Typ (discord, whatsapp, terminal, etc.) */
  source: string;
  /** Absender-ID (User ID, Channel ID, etc.) */
  senderId: string;
  /** Nachrichtentext/Befehl */
  content: string;
  /** Zeitstempel der Nachricht */
  timestamp: number;
  /** Optionale Metadaten */
  metadata?: Record<string, unknown>;
}

/**
 * Nachricht von CLI an Gateway (Ausgabe)
 */
export interface CliToGatewayMessage {
  /** Eindeutige Nachrichten-ID */
  id: string;
  /** Ziel-Gateway-Typ */
  target: string;
  /** Ziel-Empfänger-ID (Channel ID, User ID, etc.) */
  recipientId?: string;
  /** Nachrichtentyp */
  type: 'output' | 'error' | 'status' | 'tool_result';
  /** Nachrichteninhalt */
  content: string;
  /** Zeitstempel */
  timestamp: number;
  /** Optionale Metadaten (z.B. Tool-Name, Call-ID) */
  metadata?: Record<string, unknown>;
}

/**
 * Gateway Status
 */
export type GatewayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Gateway Status Update
 */
export interface GatewayStatusUpdate {
  gatewayType: string;
  status: GatewayStatus;
  error?: string;
  timestamp: number;
}

/**
 * Callback für eingehende Gateway-Nachrichten
 */
export type GatewayMessageHandler = (message: GatewayToCliMessage) => void | Promise<void>;

/**
 * Callback für Gateway Status Updates
 */
export type GatewayStatusHandler = (update: GatewayStatusUpdate) => void | Promise<void>;

/**
 * Interface für Gateway-Implementierungen
 */
export interface Gateway {
  /** Gateway-Typ (z.B. 'discord', 'whatsapp', 'terminal') */
  readonly type: string;

  /** Initialisiert das Gateway */
  initialize(): Promise<void>;

  /** Startet die Nachrichtenverarbeitung */
  start(): Promise<void>;

  /** Stoppt das Gateway gracefully */
  stop(): Promise<void>;

  /** Sendet eine Nachricht an das Gateway */
  send(message: CliToGatewayMessage): Promise<void>;

  /** Registriert Handler für eingehende Nachrichten */
  onMessage(handler: GatewayMessageHandler): void;

  /** Registriert Handler für Status Updates */
  onStatus(handler: GatewayStatusHandler): void;

  /** Aktueller Status des Gateways */
  getStatus(): GatewayStatus;
}

/**
 * Konfiguration für Gateway-Manager
 */
export interface GatewayManagerConfig {
  /** Liste der zu startenden Gateways */
  gateways: Array<{
    type: string;
    enabled: boolean;
    config?: Record<string, unknown>;
  }>;
  /** Polling-Intervall in ms für Gateways mit Polling-Mechanismus */
  pollingIntervalMs?: number;
}
