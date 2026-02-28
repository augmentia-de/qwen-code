/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test-Skript für Terminal Gateway
 * 
 * Verwendung:
 * ```bash
 * # Terminal 1: CLI mit Terminal Gateway starten
 * npx ts-node packages/cli/src/gateways/test-terminal-gateway.ts cli
 * 
 * # Terminal 2: Test-Client starten
 * npx ts-node packages/cli/src/gateways/test-terminal-gateway.ts client
 * ```
 */

import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { execSync } from 'node:child_process';

const INPUT_PIPE = '/tmp/qwen_test_input';
const OUTPUT_PIPE = '/tmp/qwen_test_output';

/**
 * CLI-Modus: Simuliert das CLI Terminal
 * Liest von INPUT_PIPE, schreibt nach OUTPUT_PIPE
 */
async function runCliMode(): Promise<void> {
  console.log('=== CLI Mode ===');
  console.log(`Listening on ${INPUT_PIPE}`);
  console.log(`Writing to ${OUTPUT_PIPE}`);
  console.log('Press Ctrl+C to exit\n');

  // Pipes erstellen falls nicht vorhanden
  createPipes();

  // Output-Stream öffnen
  const outputStream = fs.createWriteStream(OUTPUT_PIPE);

  // Input-Stream lesen
  const inputStream = fs.createReadStream(INPUT_PIPE);

  let buffer = '';

  inputStream.on('data', (chunk: string | Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');

    // Letzte (unvollständige) Zeile im Buffer behalten
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith('#')) {
        continue;
      }

      console.log(`[CLI] Received command: ${trimmed}`);

      // Befehl verarbeiten (simuliert)
      const response = processCommand(trimmed);

      console.log(`[CLI] Sending response: ${response}`);
      outputStream.write(response + '\n');
    }
  });

  // Graceful Shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    outputStream.end();
    cleanupPipes();
    process.exit(0);
  });
}

/**
 * Client-Modus: Simuliert einen Remote-Client
 * Sendet Befehle an CLI, empfängt Antworten
 */
async function runClientMode(): Promise<void> {
  console.log('=== Client Mode ===');
  console.log(`Writing to ${INPUT_PIPE}`);
  console.log(`Listening on ${OUTPUT_PIPE}`);
  console.log('Enter commands (or "quit" to exit)\n');

  // Pipes erstellen falls nicht vorhanden
  createPipes();

  // Output-Stream lesen
  const inputStream = fs.createReadStream(OUTPUT_PIPE);

  inputStream.on('data', (chunk: string | Buffer) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`[RESPONSE] ${line}`);
      }
    }
  });

  // Interaktive Eingabe
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('> ', (answer) => {
      if (answer.toLowerCase() === 'quit' || answer.toLowerCase() === 'exit') {
        rl.close();
        cleanupPipes();
        process.exit(0);
      }

      // Befehl senden
      fs.appendFileSync(INPUT_PIPE, answer + '\n');
      console.log(`[SENT] ${answer}`);
      
      prompt();
    });
  };

  prompt();

  // Graceful Shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    rl.close();
    cleanupPipes();
    process.exit(0);
  });
}

/**
 * Erstellt die Pipes falls nicht vorhanden
 */
function createPipes(): void {
  try {
    if (!fs.existsSync(INPUT_PIPE)) {
      execSync(`mkfifo "${INPUT_PIPE}"`);
      console.log(`Created input pipe: ${INPUT_PIPE}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Failed to create input pipe:', error);
    }
  }

  try {
    if (!fs.existsSync(OUTPUT_PIPE)) {
      execSync(`mkfifo "${OUTPUT_PIPE}"`);
      console.log(`Created output pipe: ${OUTPUT_PIPE}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Failed to create output pipe:', error);
    }
  }
}

/**
 * Bereinigt die Pipes
 */
function cleanupPipes(): void {
  try {
    fs.unlinkSync(INPUT_PIPE);
  } catch {
    // Ignorieren
  }
  try {
    fs.unlinkSync(OUTPUT_PIPE);
  } catch {
    // Ignorieren
  }
}

/**
 * Verarbeitet einen Befehl (simuliert)
 */
function processCommand(command: string): string {
  const timestamp = new Date().toISOString();
  
  // Einfache Befehle simulieren
  if (command === 'ls' || command === 'ls -la') {
    return `total 24
drwxr-xr-x  5 user user 4096 Feb 28 10:00 .
drwxr-xr-x 10 user user 4096 Feb 28 09:00 ..
-rw-r--r--  1 user user  123 Feb 28 10:00 file1.txt
-rw-r--r--  1 user user  456 Feb 28 10:00 file2.txt
drwxr-xr-x  3 user user 4096 Feb 28 10:00 src`;
  }
  
  if (command === 'pwd') {
    return process.cwd();
  }
  
  if (command === 'date') {
    return new Date().toString();
  }
  
  if (command === 'echo hello') {
    return 'hello';
  }
  
  if (command === 'help') {
    return `Available commands:
  ls          - List files
  pwd         - Print working directory
  date        - Show current date
  echo hello  - Echo a message
  help        - Show this help
  quit        - Exit client`;
  }

  // Unbekannter Befehl
  return `[${timestamp}] Command executed: ${command}`;
}

/**
 * Hauptfunktion
 */
function main(): void {
  const mode = process.argv[2];

  if (!mode) {
    console.log('Usage: ts-node test-terminal-gateway.ts <cli|client>');
    console.log('');
    console.log('Modes:');
    console.log('  cli     - Run as CLI (listens for commands)');
    console.log('  client  - Run as client (sends commands)');
    console.log('');
    console.log('Example:');
    console.log('  Terminal 1: ts-node test-terminal-gateway.ts cli');
    console.log('  Terminal 2: ts-node test-terminal-gateway.ts client');
    process.exit(1);
  }

  switch (mode) {
    case 'cli':
      runCliMode();
      break;
    case 'client':
      runClientMode();
      break;
    default:
      console.error(`Unknown mode: ${mode}`);
      console.log('Use "cli" or "client"');
      process.exit(1);
  }
}

main();
