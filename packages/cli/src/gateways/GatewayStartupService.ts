/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GatewayManager } from './GatewayManager.js';
import type { GatewayIntegration } from './GatewayIntegration.js';
import { createGatewayManager } from './GatewayManager.js';
import { GatewayIntegration as GatewayIntegrationClass } from './GatewayIntegration.js';
import type { LoadedSettings } from '../config/settings.js';
import { createDebugLogger } from '@qwen-code/qwen-code-core';
import { getGatewayLogger } from './GatewayLogger.js';

const debugLogger = createDebugLogger('GATEWAY_STARTUP');

/**
 * Gateway Startup Service
 * 
 * Initialisiert Gateways beim CLI-Start und integriert sie
 * in den Interactive Mode.
 * 
 * Verwendung in gemini.tsx:
 * ```typescript
 * const gatewayService = await initializeGateways(settings);
 * 
 * if (gatewayService) {
 *   // Interactive Mode mit Gateway-Support starten
 *   await startInteractiveUI(
 *     config,
 *     settings,
 *     startupWarnings,
 *     process.cwd(),
 *     initializationResult,
 *     gatewayService,
 *   );
 * }
 * ```
 */
export interface GatewayService {
  manager: GatewayManager;
  integration: GatewayIntegration;
  stop: () => Promise<void>;
}

/**
 * Initialisiert Gateways basierend auf Umgebungsvariablen und settings.json
 *
 * Prioritäten-Reihenfolge:
 * 1. Umgebungsvariablen (höchste Priorität)
 * 2. settings.json
 * 3. Defaults
 *
 * @param settings - Geladene Einstellungen
 * @returns GatewayService oder null wenn keine Gateways konfiguriert
 */
export async function initializeGateways(
  settings: LoadedSettings,
): Promise<GatewayService | null> {
  const gatewayLogger = getGatewayLogger();

  // Logger initialisieren
  await gatewayLogger.initialize('/tmp/qwen-gateway.log');
  gatewayLogger.log('=== Gateway Initialisierung gestartet ===', 'INFO');

  // Prüfen ob Gateways global aktiviert sind (Umgebungsvariable oder settings.json)
  const envGatewaysEnabled = process.env['QWEN_GATEWAYS_ENABLED'] !== 'false';
  const configGatewaysEnabled = settings.merged.gateways !== undefined;

  if (!envGatewaysEnabled && !configGatewaysEnabled) {
    debugLogger.debug('Gateways sind deaktiviert');
    gatewayLogger.log('Gateways sind deaktiviert (QWEN_GATEWAYS_ENABLED=false)', 'INFO');
    return null;
  }

  const gatewayConfig = settings.merged.gateways || {};

  // Gateway-Konfiguration aus Umgebungsvariablen und settings.json zusammenstellen
  const gateways = [];

  // Discord Gateway - Umgebungsvariable hat Priorität
  // Explizite Prüfung auf 'false' um Gateway zu deaktivieren
  const envDiscordEnabled = process.env['QWEN_GATEWAY_DISCORD_ENABLED'];
  const configDiscordEnabled = gatewayConfig.discord?.enabled === true;

  // Nur initialisieren wenn:
  // 1. Umgebungsvariable explizit 'true' ist, ODER
  // 2. Umgebungsvariable NICHT gesetzt ist UND settings.json true ist
  const shouldEnableDiscord = envDiscordEnabled === 'true' || (envDiscordEnabled === undefined && configDiscordEnabled);

  if (shouldEnableDiscord) {
    const discordConfig = {
      type: 'discord' as const,
      enabled: true,
      config: {
        token: process.env['QWEN_GATEWAY_DISCORD_TOKEN'] || gatewayConfig.discord?.token,
        allowedUserId: process.env['QWEN_GATEWAY_DISCORD_USER_ID'] || gatewayConfig.discord?.allowedUserId,
        allowedChannelId: process.env['QWEN_GATEWAY_DISCORD_CHANNEL_ID'] || gatewayConfig.discord?.allowedChannelId,
        pollingIntervalMs: process.env['QWEN_GATEWAY_DISCORD_POLLING_INTERVAL_MS']
          ? parseInt(process.env['QWEN_GATEWAY_DISCORD_POLLING_INTERVAL_MS'], 10)
          : gatewayConfig.discord?.pollingIntervalMs || 10000,
      },
    };

    // Prüfen ob alle erforderlichen Werte gesetzt sind
    if (discordConfig.config.token && discordConfig.config.allowedUserId && discordConfig.config.allowedChannelId) {
      gateways.push(discordConfig);
      gatewayLogger.log('Discord Gateway wird initialisiert', 'INFO');
    } else {
      gatewayLogger.log('Discord Gateway: Fehlende Konfiguration (Token, User ID oder Channel ID)', 'WARN');
    }
  } else if (envDiscordEnabled === 'false') {
    gatewayLogger.log('Discord Gateway durch Umgebungsvariable deaktiviert', 'DEBUG');
  }

  // WhatsApp Gateway - Umgebungsvariable hat Priorität
  // Explizite Prüfung auf 'false' um Gateway zu deaktivieren
  const envWhatsappEnabled = process.env['QWEN_GATEWAY_WHATSAPP_ENABLED'];
  const configWhatsappEnabled = gatewayConfig.whatsapp?.enabled === true;

  // Nur initialisieren wenn:
  // 1. Umgebungsvariable explizit 'true' ist, ODER
  // 2. Umgebungsvariable NICHT gesetzt ist UND settings.json true ist
  const shouldEnableWhatsapp = envWhatsappEnabled === 'true' || (envWhatsappEnabled === undefined && configWhatsappEnabled);

  if (shouldEnableWhatsapp) {
    const whatsappConfig = {
      type: 'whatsapp' as const,
      enabled: true,
      config: {
        provider: (process.env['QWEN_GATEWAY_WHATSAPP_PROVIDER'] as 'twilio' | 'meta' | 'web-bridge') || gatewayConfig.whatsapp?.provider || 'meta',
        token: process.env['QWEN_GATEWAY_WHATSAPP_TOKEN'] || gatewayConfig.whatsapp?.token,
        senderNumber: process.env['QWEN_GATEWAY_WHATSAPP_SENDER_NUMBER'] || gatewayConfig.whatsapp?.senderNumber,
        recipientNumber: process.env['QWEN_GATEWAY_WHATSAPP_RECIPIENT_NUMBER'] || gatewayConfig.whatsapp?.recipientNumber,
        apiUrl: process.env['QWEN_GATEWAY_WHATSAPP_API_URL'] || gatewayConfig.whatsapp?.apiUrl,
        pollingIntervalMs: process.env['QWEN_GATEWAY_WHATSAPP_POLLING_INTERVAL_MS']
          ? parseInt(process.env['QWEN_GATEWAY_WHATSAPP_POLLING_INTERVAL_MS'], 10)
          : gatewayConfig.whatsapp?.pollingIntervalMs || 10000,
      },
    };

    if (whatsappConfig.config.token && whatsappConfig.config.senderNumber) {
      gateways.push(whatsappConfig);
      gatewayLogger.log('WhatsApp Gateway wird initialisiert', 'INFO');
    } else {
      gatewayLogger.log('WhatsApp Gateway: Fehlende Konfiguration (Token oder Sender Number)', 'WARN');
    }
  } else if (envWhatsappEnabled === 'false') {
    gatewayLogger.log('WhatsApp Gateway durch Umgebungsvariable deaktiviert', 'DEBUG');
  }

  // Terminal Gateway - Umgebungsvariable hat Priorität
  // Explizite Prüfung auf 'false' um Gateway zu deaktivieren
  const envTerminalEnabled = process.env['QWEN_GATEWAY_TERMINAL_ENABLED'];
  const configTerminalEnabled = gatewayConfig.terminal?.enabled === true;

  // Nur initialisieren wenn:
  // 1. Umgebungsvariable explizit 'true' ist, ODER
  // 2. Umgebungsvariable NICHT gesetzt ist UND settings.json true ist
  const shouldEnableTerminal = envTerminalEnabled === 'true' || (envTerminalEnabled === undefined && configTerminalEnabled);

  if (shouldEnableTerminal) {
    gateways.push({
      type: 'terminal' as const,
      enabled: true,
      config: {
        inputPipe: process.env['QWEN_GATEWAY_TERMINAL_INPUT_PIPE'] || gatewayConfig.terminal?.inputPipe || '/tmp/qwen_cli_input',
        outputPipe: process.env['QWEN_GATEWAY_TERMINAL_OUTPUT_PIPE'] || gatewayConfig.terminal?.outputPipe || '/tmp/qwen_cli_output',
        useFileBased: process.env['QWEN_GATEWAY_TERMINAL_USE_FILE_BASED'] !== 'false' && (gatewayConfig.terminal?.useFileBased ?? true),
        pollingIntervalMs: process.env['QWEN_GATEWAY_TERMINAL_POLLING_INTERVAL_MS']
          ? parseInt(process.env['QWEN_GATEWAY_TERMINAL_POLLING_INTERVAL_MS'], 10)
          : gatewayConfig.terminal?.pollingIntervalMs || 1000,
      },
    });
    gatewayLogger.log('Terminal Gateway wird initialisiert', 'INFO');
  } else if (envTerminalEnabled === 'false') {
    gatewayLogger.log('Terminal Gateway durch Umgebungsvariable deaktiviert', 'DEBUG');
  }

  if (gateways.length === 0) {
    debugLogger.debug('Keine Gateways aktiviert');
    gatewayLogger.log('Keine Gateways aktiviert', 'INFO');
    return null;
  }

  try {
    // Gateway Manager erstellen und initialisieren
    const manager = createGatewayManager({
      gateways,
      pollingIntervalMs: gatewayConfig.pollingIntervalMs || 10000,
    });

    await manager.initializeFromConfig();

    // Gateway Integration erstellen
    const integration = new GatewayIntegrationClass(manager);

    // Gateways starten
    await manager.start();

    debugLogger.debug(`Gateway Service gestartet mit ${gateways.length} Gateway(s)`);
    gatewayLogger.log(`=== Gateway Service erfolgreich gestartet mit ${gateways.length} Gateway(s) ===`, 'INFO');
    gatewayLogger.log(`Log-Pfad: ${gatewayLogger.getLogPath()}`, 'INFO');

    return {
      manager,
      integration,
      stop: async () => {
        debugLogger.debug('Stoppe Gateway Service...');
        gatewayLogger.log('Stoppe Gateway Service...', 'INFO');
        await manager.stop();
        await gatewayLogger.close();
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    gatewayLogger.log(`Fehler beim Starten der Gateways: ${errorMessage}`, 'ERROR');
    console.error('Fehler beim Starten der Gateways:', error);
    return null;
  }
}

/**
 * Bereinigt Gateway Service beim Beenden
 */
export async function cleanupGateways(
  gatewayService: GatewayService | null,
): Promise<void> {
  if (gatewayService) {
    await gatewayService.stop();
  }
}
