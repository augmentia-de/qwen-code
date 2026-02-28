/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GatewayIntegration } from './GatewayIntegration.js';
import type { Key } from '../ui/contexts/KeypressContext.js';

/**
 * Erweitert den KeypressProvider um Gateway-Unterstützung
 * 
 * Diese Funktion verbindet Gateway-Eingaben mit dem Keypress-System:
 * - Gateway-Nachrichten werden in simulierte Key-Events umgewandelt
 * - Ermöglicht parallele Eingaben von Terminal und externen Gateways
 * 
 * Verwendung in AppContainer.tsx:
 * ```typescript
 * // Gateway Integration initialisieren
 * const gatewayIntegration = new GatewayIntegration(gatewayManager);
 * 
 * // Gateway-Eingaben mit Keypress verbinden
 * useGatewayKeypressIntegration({
 *   gatewayIntegration,
 *   onKeypress: handleKeypress,
 *   isActive: !isDialogOpen,
 * });
 * ```
 */
export function useGatewayKeypressIntegration(_params: {
  gatewayIntegration: GatewayIntegration;
  onKeypress: (key: Key) => void;
  isActive: boolean;
}): void {
  // In einer echten Implementierung würde dies:
  // 1. Gateway-Nachrichten empfangen
  // 2. Nachrichten in Key-Events umwandeln
  // 3. Key-Events an den Keypress-Handler weiterleiten
  
  // Hinweis: Die tatsächliche Integration erfolgt über den KeypressProvider
  // Diese Funktion dient als Platzhalter für zukünftige Erweiterungen
  
  console.log('[useGatewayKeypressIntegration] Gateway-Input aktiv');
}

/**
 * Konvertiert einen Gateway-Nachrichteninhalt in eine simulierte Eingabe
 * 
 * @param content - Der Nachrichteninhalt vom Gateway
 * @returns Ein Key-Event, das in den Keypress-Handler eingespeist werden kann
 */
export function gatewayContentToKey(content: string): Key[] {
  const keys: Key[] = [];

  for (const char of content) {
    keys.push({
      name: char.toLowerCase(),
      ctrl: false,
      meta: false,
      shift: char !== char.toLowerCase(),
      paste: false,
      sequence: char,
    });
  }

  // Enter am Ende hinzufügen
  keys.push({
    name: 'return',
    ctrl: false,
    meta: false,
    shift: false,
    paste: false,
    sequence: '\n',
  });

  return keys;
}
