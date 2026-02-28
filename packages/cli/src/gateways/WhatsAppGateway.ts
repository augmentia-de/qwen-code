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

/**
 * WhatsApp Gateway Konfiguration
 * Unterstützt verschiedene WhatsApp API-Provider:
 * - Twilio WhatsApp API
 * - Meta WhatsApp Business Platform
 * - Lokale WhatsApp Web Bridge (z.B. whatsapp-web.js)
 */
export interface WhatsAppGatewayConfig {
  /** API Provider Typ */
  provider: 'twilio' | 'meta' | 'web-bridge';
  
  /** API Token / Auth Key */
  token: string;
  
  /** Absender-Telefonnummer oder ID */
  senderNumber: string;
  
  /** Empfänger-Telefonnummer (für 1:1 Kommunikation) */
  recipientNumber?: string;
  
  /** API Base URL (abhängig vom Provider) */
  apiUrl?: string;
  
  /** Polling-Intervall in ms (Standard: 10000) */
  pollingIntervalMs?: number;
  
  /** Webhook URL für Push-Nachrichten (optional) */
  webhookUrl?: string;
}

/**
 * WhatsApp Nachricht
 */
interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  content: {
    body: string;
  };
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
}

/**
 * WhatsApp Gateway für Qwen Code Interactive Mode
 * 
 * Verbindet den Interactive Mode mit WhatsApp:
 * - Liest Nachrichten über WhatsApp Business API (Polling alle 10s)
 * - Sendet CLI-Ausgaben zurück an WhatsApp
 * - Unterstützt Textbefehle
 * 
 * Beispielkonfiguration in settings.json:
 * ```json
 * {
 *   "gateways": {
 *     "whatsapp": {
 *       "enabled": true,
 *       "provider": "meta",
 *       "token": "YOUR_ACCESS_TOKEN",
 *       "senderNumber": "+491234567890",
 *       "recipientNumber": "+490987654321",
 *       "apiUrl": "https://graph.facebook.com/v17.0",
 *       "pollingIntervalMs": 10000
 *     }
 *   }
 * }
 * ```
 */
export class WhatsAppGateway extends BaseGateway {
  readonly type = 'whatsapp';

  private config: WhatsAppGatewayConfig;
  private processedMessageIds: Set<string> = new Set<string>();

  constructor(config: WhatsAppGatewayConfig) {
    super();
    this.config = config;
    if (config.pollingIntervalMs) {
      this.pollingIntervalMs = config.pollingIntervalMs;
    }
  }

  async initialize(): Promise<void> {
    this.setStatus('connecting');

    try {
      // Token und Konfiguration validieren
      await this.validateConfig();
      this.setStatus('connected');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('error', errorMessage);
      throw new Error(`WhatsApp Gateway initialization failed: ${errorMessage}`);
    }
  }

  async start(): Promise<void> {
    if (this.status !== 'connected') {
      throw new Error('Gateway not initialized');
    }

    // Starte Polling für neue Nachrichten
    this.startPolling(async () => await this.pollMessages());
  }

  async stop(): Promise<void> {
    this.stopPolling();
    this.setStatus('disconnected');
  }

  async send(message: CliToGatewayMessage): Promise<void> {
    if (this.status !== 'connected') {
      throw new Error('Gateway not connected');
    }

    const recipient = message.recipientId || this.config.recipientNumber;
    if (!recipient) {
      throw new Error('No recipient specified for WhatsApp message');
    }

    await this.sendMessageToNumber(recipient, message.content);
  }

  /**
   * Pollt neue Nachrichten von der WhatsApp API
   */
  private async pollMessages(): Promise<GatewayToCliMessage[]> {
    const newMessages: GatewayToCliMessage[] = [];

    try {
      const messages = await this.getIncomingMessages();

      for (const msg of messages) {
        // Nur Textnachrichten verarbeiten
        if (msg.type !== 'text') {
          continue;
        }

        // Nur Nachrichten an unsere Nummer
        if (msg.to !== this.config.senderNumber) {
          continue;
        }

        // Bereits verarbeitete Nachrichten überspringen
        if (this.processedMessageIds.has(msg.id)) {
          continue;
        }

        this.processedMessageIds.add(msg.id);

        const gatewayMessage: GatewayToCliMessage = {
          id: this.generateMessageId(),
          source: 'whatsapp',
          senderId: msg.from,
          content: msg.content.body,
          timestamp: new Date(msg.timestamp).getTime(),
          metadata: {
            messageId: msg.id,
            phoneNumber: msg.from,
            messageType: msg.type,
          },
        };

        newMessages.push(gatewayMessage);
        await this.enqueueMessage(gatewayMessage);
      }
    } catch (error) {
      console.error('[WhatsAppGateway] Polling error:', error);
    }

    return newMessages;
  }

  /**
   * Validiert die WhatsApp Gateway Konfiguration
   */
  private async validateConfig(): Promise<void> {
    if (!this.config.token) {
      throw new Error('WhatsApp token is required');
    }

    if (!this.config.senderNumber) {
      throw new Error('Sender number is required');
    }

    // Provider-spezifische Validierung
    switch (this.config.provider) {
      case 'twilio':
        await this.validateTwilioConfig();
        break;
      case 'meta':
        await this.validateMetaConfig();
        break;
      case 'web-bridge':
        // Web Bridge benötigt keine API-Validierung
        break;
    }
  }

  /**
   * Validiert Twilio-spezifische Konfiguration
   */
  private async validateTwilioConfig(): Promise<void> {
    const apiUrl = this.config.apiUrl || 'https://api.twilio.com/2010-04-01';
    
    try {
      const response = await fetch(`${apiUrl}/Accounts/${this.config.senderNumber}.json`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(this.config.token).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid Twilio credentials');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid Twilio credentials') {
        throw error;
      }
      // Netzwerkfehler ignorieren - Retry beim nächsten Polling
    }
  }

  /**
   * Validiert Meta-spezifische Konfiguration
   */
  private async validateMetaConfig(): Promise<void> {
    const apiUrl = this.config.apiUrl || 'https://graph.facebook.com/v17.0';
    
    try {
      const response = await fetch(`${apiUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid Meta access token');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid Meta access token') {
        throw error;
      }
      // Netzwerkfehler ignorieren - Retry beim nächsten Polling
    }
  }

  /**
   * Ruft eingehende Nachrichten von der API ab
   */
  private async getIncomingMessages(): Promise<WhatsAppMessage[]> {
    const apiUrl = this.getMessagesEndpoint();
    
    const response = await fetch(apiUrl, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const data = await response.json();
    return this.extractMessagesFromResponse(data);
  }

  /**
   * Sendet eine Nachricht an eine Telefonnummer
   */
  private async sendMessageToNumber(recipient: string, content: string): Promise<void> {
    const apiUrl = this.getSendEndpoint();
    
    const body = this.buildSendMessageBody(recipient, content);

    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Gibt den Messages-Endpoint basierend auf dem Provider zurück
   */
  private getMessagesEndpoint(): string {
    switch (this.config.provider) {
      case 'twilio':
        return `https://api.twilio.com/2010-04-01/Accounts/${this.config.senderNumber}/Messages.json?Direction=inbound&PageSize=10`;
      case 'meta':
        return `${this.config.apiUrl || 'https://graph.facebook.com/v17.0'}/${this.config.senderNumber}/messages?limit=10`;
      case 'web-bridge':
        return `${this.config.apiUrl || 'http://localhost:3000'}/messages/inbox?limit=10`;
    }
  }

  /**
   * Gibt den Send-Endpoint basierend auf dem Provider zurück
   */
  private getSendEndpoint(): string {
    switch (this.config.provider) {
      case 'twilio':
        return `https://api.twilio.com/2010-04-01/Accounts/${this.config.senderNumber}/Messages.json`;
      case 'meta':
        return `${this.config.apiUrl || 'https://graph.facebook.com/v17.0'}/${this.config.senderNumber}/messages`;
      case 'web-bridge':
        return `${this.config.apiUrl || 'http://localhost:3000'}/messages/send`;
    }
  }

  /**
   * Gibt Auth-Header basierend auf dem Provider zurück
   */
  private getAuthHeaders(): Record<string, string> {
    switch (this.config.provider) {
      case 'twilio':
        return {
          'Authorization': `Basic ${Buffer.from(this.config.token).toString('base64')}`,
        };
      case 'meta':
        return {
          'Authorization': `Bearer ${this.config.token}`,
        };
      case 'web-bridge':
        return {
          'Authorization': `Bearer ${this.config.token}`,
        };
    }
  }

  /**
   * Extrahiert Nachrichten aus der API-Response
   */
  private extractMessagesFromResponse(data: unknown): WhatsAppMessage[] {
    // Provider-spezifische Extraktion
    // Dies ist eine vereinfachte Implementierung
    if (data && typeof data === 'object' && 'messages' in data) {
      const messagesData = data as { messages: WhatsAppMessage[] };
      return messagesData.messages;
    }
    return [];
  }

  /**
   * Baut den Request-Body zum Senden einer Nachricht
   */
  private buildSendMessageBody(recipient: string, content: string): Record<string, unknown> {
    switch (this.config.provider) {
      case 'twilio':
        return {
          'To': `whatsapp:${recipient}`,
          'From': `whatsapp:${this.config.senderNumber}`,
          'Body': content,
        };
      case 'meta':
        return {
          'messaging_product': 'whatsapp',
          'to': recipient,
          'type': 'text',
          'text': { body: content },
        };
      case 'web-bridge':
        return {
          'to': recipient,
          'message': content,
        };
    }
  }
}
