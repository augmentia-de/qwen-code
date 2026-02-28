/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Gateway,
  GatewayToCliMessage,
  CliToGatewayMessage,
  GatewayStatusUpdate,
  GatewayMessageHandler,
  GatewayStatusHandler,
  GatewayManagerConfig,
} from './types.js';
import { DiscordGateway } from './DiscordGateway.js';
import { WhatsAppGateway } from './WhatsAppGateway.js';
import { TerminalGateway } from './TerminalGateway.js';

/**
 * Gateway Manager
 * 
 * Verwaltet mehrere Gateway-Instanzen und koordiniert die Kommunikation:
 * - Startet/Stoppt Gateways
 * - Routet Nachrichten zwischen CLI und Gateways
 * - Broadcastet CLI-Ausgaben an alle verbundenen Gateways
 * - Sammelt Eingaben von allen Gateways
 * 
 * Architektur:
 * ```
 * ┌─────────────────┐
 * │  CLI Interactive│
 * │      Mode       │
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌─────────────────┐
 * │ Gateway Manager │
 * └────────┬────────┘
 *          │
 *    ┌─────┼─────┬──────────┐
 *    ▼     ▼     ▼          ▼
 * ┌────┐ ┌────┐ ┌────┐  ┌────────┐
 * │Disc│ │Whats│ │Term│  │Weitere│
 * │ord │ │App │ │inal│  │Gateways│
 * └────┘ └────┘ └────┘  └────────┘
 * ```
 */
export class GatewayManager {
  private gateways: Map<string, Gateway> = new Map();
  private messageHandlers: GatewayMessageHandler[] = [];
  private statusHandlers: GatewayStatusHandler[] = [];
  private config: GatewayManagerConfig;
  private isRunning = false;

  constructor(config: GatewayManagerConfig) {
    this.config = config;
  }

  /**
   * Registriert ein Gateway beim Manager
   */
  registerGateway(gateway: Gateway): void {
    this.gateways.set(gateway.type, gateway);
    
    // Handler für eingehende Nachrichten
    gateway.onMessage(async (message) => {
      await this.notifyMessageHandlers(message);
    });

    // Handler für Status Updates
    gateway.onStatus((update) => {
      this.notifyStatusHandlers(update);
    });
  }

  /**
   * Erstellt und registriert Gateways basierend auf der Konfiguration
   */
  async initializeFromConfig(): Promise<void> {
    for (const gatewayConfig of this.config.gateways) {
      if (!gatewayConfig.enabled) {
        continue;
      }

      let gateway: Gateway;

      switch (gatewayConfig.type) {
        case 'discord':
          gateway = new DiscordGateway({
            token: gatewayConfig.config?.['token'] as string,
            allowedUserId: gatewayConfig.config?.['allowedUserId'] as string,
            allowedChannelId: gatewayConfig.config?.['allowedChannelId'] as string,
            pollingIntervalMs: gatewayConfig.config?.['pollingIntervalMs'] as number | undefined,
          });
          break;

        case 'whatsapp':
          gateway = new WhatsAppGateway({
            provider: gatewayConfig.config?.['provider'] as 'twilio' | 'meta' | 'web-bridge',
            token: gatewayConfig.config?.['token'] as string,
            senderNumber: gatewayConfig.config?.['senderNumber'] as string,
            recipientNumber: gatewayConfig.config?.['recipientNumber'] as string | undefined,
            apiUrl: gatewayConfig.config?.['apiUrl'] as string | undefined,
            pollingIntervalMs: gatewayConfig.config?.['pollingIntervalMs'] as number | undefined,
          });
          break;

        case 'terminal':
          gateway = new TerminalGateway({
            inputPipe: gatewayConfig.config?.['inputPipe'] as string,
            outputPipe: gatewayConfig.config?.['outputPipe'] as string,
            useFileBased: gatewayConfig.config?.['useFileBased'] as boolean,
            pollingIntervalMs: gatewayConfig.config?.['pollingIntervalMs'] as number | undefined,
          });
          break;

        default:
          console.warn(`Unknown gateway type: ${gatewayConfig.type}`);
          continue;
      }

      this.registerGateway(gateway);
    }
  }

  /**
   * Startet alle registrierten Gateways
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const startPromises = Array.from(this.gateways.values()).map(async (gateway) => {
      try {
        await gateway.initialize();
        await gateway.start();
      } catch (error) {
        console.error(`Failed to start gateway ${gateway.type}:`, error);
      }
    });

    await Promise.all(startPromises);
  }

  /**
   * Stoppt alle Gateways gracefully
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    const stopPromises = Array.from(this.gateways.values()).map((gateway) =>
      gateway.stop()
    );

    await Promise.all(stopPromises);
  }

  /**
   * Sendet eine Nachricht an alle Gateways (Broadcast)
   */
  async broadcast(message: Omit<CliToGatewayMessage, 'target'>): Promise<void> {
    const sendPromises = Array.from(this.gateways.values()).map(async (gateway) => {
      try {
        await gateway.send({
          ...message,
          target: gateway.type,
        });
      } catch (error) {
        console.error(`Failed to send to gateway ${gateway.type}:`, error);
      }
    });

    await Promise.all(sendPromises);
  }

  /**
   * Sendet eine Nachricht an ein spezifisches Gateway
   */
  async sendToGateway(gatewayType: string, message: Omit<CliToGatewayMessage, 'target'>): Promise<void> {
    const gateway = this.gateways.get(gatewayType);
    
    if (!gateway) {
      throw new Error(`Gateway ${gatewayType} not found`);
    }

    await gateway.send({
      ...message,
      target: gatewayType,
    });
  }

  /**
   * Registriert Handler für eingehende Gateway-Nachrichten
   * 
   * Diese Handler werden aufgerufen, wenn eine Nachricht von einem Gateway
   * empfangen wird. Die Nachrichten können dann in den Interactive Mode
   * eingespeist werden.
   */
  onMessage(handler: GatewayMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Registriert Handler für Gateway Status Updates
   */
  onStatus(handler: GatewayStatusHandler): void {
    this.statusHandlers.push(handler);
  }

  /**
   * Gibt den Status aller Gateways zurück
   */
  getAllStatuses(): Map<string, string> {
    const statuses = new Map<string, string>();
    
    for (const [type, gateway] of this.gateways) {
      statuses.set(type, gateway.getStatus());
    }
    
    return statuses;
  }

  /**
   * Gibt ein spezifisches Gateway zurück
   */
  getGateway(type: string): Gateway | undefined {
    return this.gateways.get(type);
  }

  /**
   * Prüft ob mindestens ein Gateway verbunden ist
   */
  hasConnectedGateway(): boolean {
    for (const gateway of this.gateways.values()) {
      if (gateway.getStatus() === 'connected') {
        return true;
      }
    }
    return false;
  }

  private async notifyMessageHandlers(message: GatewayToCliMessage): Promise<void> {
    await Promise.all(
      this.messageHandlers.map(handler => Promise.resolve(handler(message)))
    );
  }

  private notifyStatusHandlers(update: GatewayStatusUpdate): void {
    this.statusHandlers.forEach(handler => handler(update));
  }
}

/**
 * Factory-Funktion zum Erstellen eines Gateway Managers
 * 
 * Verwendung:
 * ```typescript
 * const manager = createGatewayManager({
 *   gateways: [
 *     { type: 'discord', enabled: true, config: { ... } },
 *     { type: 'terminal', enabled: true, config: { ... } },
 *   ]
 * });
 * 
 * manager.onMessage((msg) => {
 *   console.log('Received from gateway:', msg);
 * });
 * 
 * await manager.start();
 * ```
 */
export function createGatewayManager(config: GatewayManagerConfig): GatewayManager {
  return new GatewayManager(config);
}
