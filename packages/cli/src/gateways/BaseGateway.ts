/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Gateway,
  GatewayToCliMessage,
  CliToGatewayMessage,
  GatewayStatus,
  GatewayMessageHandler,
  GatewayStatusHandler,
} from './types.js';

/**
 * Abstrakte Basisklasse für Gateway-Implementierungen
 * 
 * Bietet gemeinsame Funktionalität für alle Gateway-Typen:
 * - Status-Management
 * - Handler-Registrierung
 * - Message-Queue für polling-basierte Gateways
 */
export abstract class BaseGateway implements Gateway {
  protected status: GatewayStatus = 'disconnected';
  protected messageHandlers: GatewayMessageHandler[] = [];
  protected statusHandlers: GatewayStatusHandler[] = [];
  protected messageQueue: GatewayToCliMessage[] = [];
  protected pollingIntervalMs: number = 10000; // Default: 10 Sekunden
  protected pollingTimer: NodeJS.Timeout | null = null;

  abstract readonly type: string;

  /**
   * Initialisiert das Gateway (Verbindungen, Authentifizierung, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Startet die Nachrichtenverarbeitung
   */
  abstract start(): Promise<void>;

  /**
   * Stoppt das Gateway gracefully
   */
  abstract stop(): Promise<void>;

  /**
   * Sendet eine Nachricht an das Gateway
   */
  abstract send(message: CliToGatewayMessage): Promise<void>;

  /**
   * Registriert Handler für eingehende Nachrichten
   */
  onMessage(handler: GatewayMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Registriert Handler für Status Updates
   */
  onStatus(handler: GatewayStatusHandler): void {
    this.statusHandlers.push(handler);
  }

  /**
   * Aktueller Status des Gateways
   */
  getStatus(): GatewayStatus {
    return this.status;
  }

  /**
   * Setzt den Status und benachrichtigt alle Handler
   */
  protected setStatus(newStatus: GatewayStatus, error?: string): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notifyStatusHandlers({
        gatewayType: this.type,
        status: newStatus,
        error,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Benachrichtigt alle registrierten Message-Handler
   */
  protected async notifyMessageHandlers(message: GatewayToCliMessage): Promise<void> {
    await Promise.all(
      this.messageHandlers.map(handler => Promise.resolve(handler(message)))
    );
  }

  /**
   * Benachrichtigt alle registrierten Status-Handler
   */
  protected notifyStatusHandlers(update: {
    gatewayType: string;
    status: GatewayStatus;
    error?: string;
    timestamp: number;
  }): void {
    this.statusHandlers.forEach(handler => handler(update));
  }

  /**
   * Fügt eine Nachricht zur Queue hinzu und benachrichtigt Handler
   */
  protected async enqueueMessage(message: GatewayToCliMessage): Promise<void> {
    this.messageQueue.push(message);
    await this.notifyMessageHandlers(message);
  }

  /**
   * Startet Polling-Zyklus für Gateways ohne Push-Mechanismus
   * Wird alle `pollingIntervalMs` Millisekunden ausgeführt
   */
  protected startPolling(pollFn: () => Promise<GatewayToCliMessage[]>): void {
    const poll = async () => {
      try {
        const messages = await pollFn();
        for (const message of messages) {
          await this.enqueueMessage(message);
        }
      } catch (error) {
        console.error(`[${this.type}] Polling error:`, error);
      }
      // Nächste Polling-Runde planen
      this.pollingTimer = setTimeout(poll, this.pollingIntervalMs);
    };

    // Erstes Polling sofort starten
    poll();
  }

  /**
   * Stoppt den Polling-Zyklus
   */
  protected stopPolling(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Generiert eine eindeutige Nachrichten-ID
   */
  protected generateMessageId(): string {
    return `${this.type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
