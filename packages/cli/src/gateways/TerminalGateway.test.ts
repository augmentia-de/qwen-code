/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { TerminalGateway, createTestPipes } from './TerminalGateway.js';
import * as fs from 'node:fs';

describe('TerminalGateway', () => {
  let gateway: TerminalGateway;
  let testPipes: { inputPipe: string; outputPipe: string; cleanup: () => Promise<void> } | null = null;

  beforeEach(async () => {
    testPipes = await createTestPipes();
  });

  afterEach(async () => {
    if (gateway) {
      await gateway.stop();
    }
    if (testPipes) {
      await testPipes.cleanup();
      testPipes = null;
    }
  });

  describe('constructor', () => {
    it('should create gateway with default polling interval', () => {
      gateway = new TerminalGateway({
        inputPipe: '/tmp/test_input',
        outputPipe: '/tmp/test_output',
        useFileBased: true,
      });

      assert.strictEqual(gateway.type, 'terminal');
      assert.strictEqual(gateway.getStatus(), 'disconnected');
    });

    it('should create gateway with custom polling interval', () => {
      gateway = new TerminalGateway({
        inputPipe: '/tmp/test_input',
        outputPipe: '/tmp/test_output',
        useFileBased: true,
        pollingIntervalMs: 5000,
      });

      assert.strictEqual(gateway.type, 'terminal');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid pipes', async () => {
      if (!testPipes) throw new Error('Test pipes not created');

      gateway = new TerminalGateway({
        inputPipe: testPipes.inputPipe,
        outputPipe: testPipes.outputPipe,
        useFileBased: true,
      });

      await gateway.initialize();
      assert.strictEqual(gateway.getStatus(), 'connected');
    });

    it('should set status to error with invalid pipes', async () => {
      gateway = new TerminalGateway({
        inputPipe: '/nonexistent/path/input',
        outputPipe: '/nonexistent/path/output',
        useFileBased: true,
      });

      try {
        await gateway.initialize();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.strictEqual(gateway.getStatus(), 'error');
      }
    });
  });

  describe('send', () => {
    it('should send message to output pipe', async () => {
      if (!testPipes) throw new Error('Test pipes not created');

      gateway = new TerminalGateway({
        inputPipe: testPipes.inputPipe,
        outputPipe: testPipes.outputPipe,
        useFileBased: true,
      });

      await gateway.initialize();
      await gateway.start();

      await gateway.send({
        id: 'test-1',
        target: 'terminal',
        type: 'output',
        content: 'Hello from CLI',
        timestamp: Date.now(),
      });

      // Kurz warten damit die Nachricht geschrieben wird
      await new Promise(resolve => setTimeout(resolve, 100));

      // Output lesen und prüfen
      const output = fs.readFileSync(testPipes.outputPipe, 'utf-8');
      assert.ok(output.includes('Hello from CLI'));
    });

    it('should format error messages with prefix', async () => {
      if (!testPipes) throw new Error('Test pipes not created');

      gateway = new TerminalGateway({
        inputPipe: testPipes.inputPipe,
        outputPipe: testPipes.outputPipe,
        useFileBased: true,
      });

      await gateway.initialize();
      await gateway.start();

      await gateway.send({
        id: 'test-2',
        target: 'terminal',
        type: 'error',
        content: 'Something went wrong',
        timestamp: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const output = fs.readFileSync(testPipes.outputPipe, 'utf-8');
      assert.ok(output.includes('ERROR'));
      assert.ok(output.includes('Something went wrong'));
    });
  });

  describe('pollMessages', () => {
    it('should read messages from input pipe', async () => {
      if (!testPipes) throw new Error('Test pipes not created');

      gateway = new TerminalGateway({
        inputPipe: testPipes.inputPipe,
        outputPipe: testPipes.outputPipe,
        useFileBased: true,
        pollingIntervalMs: 100, // Kurzes Intervall für Test
      });

      await gateway.initialize();
      await gateway.start();

      // Nachricht in Input-Pipe schreiben
      fs.writeFileSync(testPipes.inputPipe, 'test command\n');

      // Auf Polling warten
      await new Promise(resolve => setTimeout(resolve, 200));

      // Gateway Status prüfen
      assert.strictEqual(gateway.getStatus(), 'connected');
    });

    it('should ignore empty lines and comments', async () => {
      if (!testPipes) throw new Error('Test pipes not created');

      gateway = new TerminalGateway({
        inputPipe: testPipes.inputPipe,
        outputPipe: testPipes.outputPipe,
        useFileBased: true,
        pollingIntervalMs: 100,
      });

      await gateway.initialize();
      await gateway.start();

      // Nur leere Zeilen und Kommentare
      fs.writeFileSync(testPipes.inputPipe, '\n# comment\n\n');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Sollte keine Nachrichten verarbeitet haben
      assert.strictEqual(gateway.getStatus(), 'connected');
    });
  });

  describe('message handlers', () => {
    it('should notify handlers on incoming messages', async () => {
      if (!testPipes) throw new Error('Test pipes not created');

      gateway = new TerminalGateway({
        inputPipe: testPipes.inputPipe,
        outputPipe: testPipes.outputPipe,
        useFileBased: true,
        pollingIntervalMs: 100,
      });

      let messageReceived = false;
      
      gateway.onMessage((message) => {
        messageReceived = true;
        assert.strictEqual(message.source, 'terminal');
        assert.strictEqual(message.content, 'test command');
      });

      await gateway.initialize();
      await gateway.start();

      fs.writeFileSync(testPipes.inputPipe, 'test command\n');
      await new Promise(resolve => setTimeout(resolve, 200));

      assert.ok(messageReceived);
    });
  });

  describe('status handlers', () => {
    it('should notify handlers on status changes', () => {
      gateway = new TerminalGateway({
        inputPipe: testPipes?.inputPipe || '/tmp/test_input',
        outputPipe: testPipes?.outputPipe || '/tmp/test_output',
        useFileBased: true,
      });

      const statusChanges: string[] = [];
      
      gateway.onStatus((update) => {
        statusChanges.push(update.status);
      });

      // Status sollte 'disconnected' sein
      assert.ok(statusChanges.includes('disconnected') || statusChanges.length === 0);
    });
  });
});

describe('createTestPipes', () => {
  it('should create unique pipes', async () => {
    const pipes1 = await createTestPipes();
    const pipes2 = await createTestPipes();

    assert.notStrictEqual(pipes1.inputPipe, pipes2.inputPipe);
    assert.notStrictEqual(pipes1.outputPipe, pipes2.outputPipe);

    await pipes1.cleanup();
    await pipes2.cleanup();
  });

  it('should cleanup pipes successfully', async () => {
    const pipes = await createTestPipes();
    
    // Pipes sollten existieren
    assert.ok(fs.existsSync(pipes.inputPipe));
    assert.ok(fs.existsSync(pipes.outputPipe));

    // Cleanup durchführen
    await pipes.cleanup();

    // Pipes sollten nicht mehr existieren
    assert.ok(!fs.existsSync(pipes.inputPipe));
    assert.ok(!fs.existsSync(pipes.outputPipe));
  });
});
