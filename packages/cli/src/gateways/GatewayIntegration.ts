/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GatewayManager } from './GatewayManager.js';
import type { CliToGatewayMessage } from './types.js';

/**
 * Gateway Integration für den Interactive Mode
 * 
 * Diese Klasse verbindet den Gateway Manager mit dem Interactive Mode:
 * - Wandelt Gateway-Nachrichten in simulierte Tastatureingaben um
 * - Leitet CLI-Ausgaben an Gateways weiter
 * - Ermöglicht parallele Eingaben von Terminal und externen Gateways
 * 
 * Verwendung in AppContainer.tsx:
 * ```typescript
 * const gatewayIntegration = new GatewayIntegration(gatewayManager);
 * 
 * gatewayIntegration.onInput((content) => {
 *   // Eingabe in den Interactive Mode einspeisen
 *   // z.B. über useKeypress oder direkt an useGeminiStream
 * });
 * 
 * gatewayIntegration.setOutputHandler((message) => {
 *   // Ausgabe an Gateways senden
 * });
 * ```
 */
export class GatewayIntegration {
  private gatewayManager: GatewayManager;
  private inputHandlers: ((content: string, metadata?: Record<string, unknown>) => void)[] = [];
  private isOutputEnabled = false;

  constructor(gatewayManager: GatewayManager) {
    this.gatewayManager = gatewayManager;

    // Registrieren des Message Handlers
    this.gatewayManager.onMessage((message) => {
      this.handleGatewayMessage(message);
    });
  }

  /**
   * Registriert Handler für eingehende Gateway-Nachrichten
   * 
   * Diese Handler werden aufgerufen, wenn eine Nachricht von einem Gateway
   * empfangen wird. Der Inhalt kann dann als Eingabe in den Interactive Mode
   * eingespeist werden.
   */
  onInput(handler: (content: string, metadata?: Record<string, unknown>) => void): void {
    this.inputHandlers.push(handler);
  }

  /**
   * Aktiviert die Ausgabe an Gateways
   * 
   * Nach dem Aufruf werden alle CLI-Ausgaben automatisch an die
   * verbundenen Gateways gesendet.
   */
  enableOutput(): void {
    this.isOutputEnabled = true;
  }

  /**
   * Deaktiviert die Ausgabe an Gateways
   */
  disableOutput(): void {
    this.isOutputEnabled = false;
  }

  /**
   * Sendet eine Ausgabe an alle verbundenen Gateways
   * 
   * Diese Methode sollte von der CLI aufgerufen werden, wenn
   * eine Ausgabe an den User gesendet wird.
   */
  async sendOutput(
    content: string,
    type: 'output' | 'error' | 'status' | 'tool_result' = 'output',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isOutputEnabled) {
      return;
    }

    const message: Omit<CliToGatewayMessage, 'target'> = {
      id: this.generateMessageId(),
      type,
      content,
      timestamp: Date.now(),
      metadata,
    };

    await this.gatewayManager.broadcast(message);
  }

  /**
   * Sendet eine Ausgabe an ein spezifisches Gateway
   */
  async sendToGateway(
    gatewayType: string,
    content: string,
    type: 'output' | 'error' | 'status' | 'tool_result' = 'output',
    recipientId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.isOutputEnabled) {
      return;
    }

    const message: Omit<CliToGatewayMessage, 'target'> = {
      id: this.generateMessageId(),
      type,
      content,
      timestamp: Date.now(),
      recipientId,
      metadata,
    };

    await this.gatewayManager.sendToGateway(gatewayType, message);
  }

  /**
   * Verarbeitet eingehende Gateway-Nachrichten
   */
  private handleGatewayMessage(message: {
    id: string;
    source: string;
    senderId: string;
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }): void {
    // Nachricht an alle Input-Handler weiterleiten
    for (const handler of this.inputHandlers) {
      handler(message.content, {
        source: message.source,
        senderId: message.senderId,
        messageId: message.id,
        ...message.metadata,
      });
    }
  }

  /**
   * Generiert eine eindeutige Nachrichten-ID
   */
  private generateMessageId(): string {
    return `gateway_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Gibt den Status aller Gateways zurück
   */
  getGatewayStatuses(): Map<string, string> {
    return this.gatewayManager.getAllStatuses();
  }

  /**
   * Prüft ob mindestens ein Gateway verbunden ist
   */
  hasConnectedGateway(): boolean {
    return this.gatewayManager.hasConnectedGateway();
  }
}

/**
 * Hook für die Verwendung in React-Komponenten
 * 
 * Verwendung:
 * ```typescript
 * function MyComponent() {
 *   const { sendOutput, gatewayStatuses } = useGatewayIntegration();
 * 
 *   return (
 *     <div>
 *       {Array.from(gatewayStatuses).map(([type, status]) => (
 *         <span key={type}>{type}: {status}</span>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGatewayIntegration() {
  // Diese Funktion würde in einer echten Implementierung
  // den GatewayIntegration-Service aus dem Context holen
  // und die notwendigen Methoden bereitstellen.
  
  // Für jetzt ist dies ein Platzhalter für die spätere
  // Integration in die React-Komponenten.
  
  return {
    sendOutput: async (
      content: string,
      type: 'output' | 'error' | 'status' | 'tool_result' = 'output'
    ) => {
      // Placeholder - wird durch echten Service ersetzt
      console.log('[GatewayIntegration] sendOutput:', content, type);
    },
    gatewayStatuses: new Map<string, string>(),
    hasConnectedGateway: () => false,
  };
}
