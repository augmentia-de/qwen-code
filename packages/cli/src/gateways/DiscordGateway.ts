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
 * Discord Gateway Konfiguration
 */
export interface DiscordGatewayConfig {
  /** Discord Bot Token */
  token: string;
  /** User ID, deren Nachrichten verarbeitet werden */
  allowedUserId: string;
  /** Channel ID, in dem Nachrichten verarbeitet werden */
  allowedChannelId: string;
  /** Polling-Intervall in ms (Standard: 10000) */
  pollingIntervalMs?: number;
}

/**
 * Discord Message für die API
 */
interface DiscordMessage {
  id: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
  };
  content: string;
  timestamp: string;
}

/**
 * Discord Gateway für Qwen Code Interactive Mode
 * 
 * Verbindet den Interactive Mode mit Discord:
 * - Liest Nachrichten aus einem Discord Channel (Polling alle 10s)
 * - Sendet CLI-Ausgaben zurück an Discord
 * - Unterstützt Befehle mit Präfixen (!exec, !cancel, etc.)
 * 
 * Beispielkonfiguration in settings.json:
 * ```json
 * {
 *   "gateways": {
 *     "discord": {
 *       "enabled": true,
 *       "token": "YOUR_BOT_TOKEN",
 *       "allowedUserId": "YOUR_USER_ID",
 *       "allowedChannelId": "CHANNEL_ID",
 *       "pollingIntervalMs": 10000
 *     }
 *   }
 * }
 * ```
 */
export class DiscordGateway extends BaseGateway {
  readonly type = 'discord';

  private config: DiscordGatewayConfig;
  private processedMessageIds: Set<string> = new Set<string>();
  private apiBaseUrl = 'https://discord.com/api/v10';

  constructor(config: DiscordGatewayConfig) {
    super();
    this.config = config;
    if (config.pollingIntervalMs) {
      this.pollingIntervalMs = config.pollingIntervalMs;
    }
  }

  async initialize(): Promise<void> {
    this.setStatus('connecting');

    try {
      // Token validieren
      await this.validateToken();
      this.setStatus('connected');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.setStatus('error', errorMessage);
      throw new Error(`Discord Gateway initialization failed: ${errorMessage}`);
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

    const channelId = message.recipientId || this.config.allowedChannelId;
    await this.sendMessageToChannel(channelId, message.content);
  }

  /**
   * Pollt neue Nachrichten aus dem Discord Channel
   */
  private async pollMessages(): Promise<GatewayToCliMessage[]> {
    const newMessages: GatewayToCliMessage[] = [];

    try {
      const messages = await this.getChannelMessages();

      for (const msg of messages) {
        // Nur Nachrichten vom erlaubten User im erlaubten Channel
        if (msg.author.id !== this.config.allowedUserId ||
            msg.channel_id !== this.config.allowedChannelId) {
          continue;
        }

        // Bereits verarbeitete Nachrichten überspringen
        if (this.processedMessageIds.has(msg.id)) {
          continue;
        }

        this.processedMessageIds.add(msg.id);

        const gatewayMessage: GatewayToCliMessage = {
          id: this.generateMessageId(),
          source: 'discord',
          senderId: msg.author.id,
          content: msg.content,
          timestamp: new Date(msg.timestamp).getTime(),
          metadata: {
            messageId: msg.id,
            channelId: msg.channel_id,
            username: msg.author.username,
          },
        };

        newMessages.push(gatewayMessage);
        await this.enqueueMessage(gatewayMessage);
      }
    } catch (error) {
      console.error('[DiscordGateway] Polling error:', error);
    }

    return newMessages;
  }

  /**
   * Validiert den Discord Bot Token
   */
  private async validateToken(): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/users/@me`, {
      headers: {
        'Authorization': `Bot ${this.config.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Invalid token: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Ruft die letzten Nachrichten aus dem Channel ab
   */
  private async getChannelMessages(): Promise<DiscordMessage[]> {
    const response = await fetch(
      `${this.apiBaseUrl}/channels/${this.config.allowedChannelId}/messages?limit=10`,
      {
        headers: {
          'Authorization': `Bot ${this.config.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sendet eine Nachricht an einen Discord Channel
   */
  private async sendMessageToChannel(channelId: string, content: string): Promise<void> {
    // Discord Nachrichten sind auf 2000 Zeichen begrenzt
    const chunks = this.chunkMessage(content, 2000);

    for (const chunk of chunks) {
      await fetch(`${this.apiBaseUrl}/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: chunk }),
      });
    }
  }

  /**
   * Teilt lange Nachrichten in Discord-kompatibleChunks
   */
  private chunkMessage(content: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = content;

    while (remaining.length > maxLength) {
      // Versuche bei Zeilenumbruch zu trennen
      let splitIndex = remaining.lastIndexOf('\n', maxLength);
      if (splitIndex === -1) {
        splitIndex = maxLength;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trimStart();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  }
}
