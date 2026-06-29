/*
 * Copyright (c) 2018-2025 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import {
  sanitizeStaleComponents,
  reconcileToolImages,
  ToolsRegistry,
} from '@/services/ToolsInjectorService';

const REGISTRY: ToolsRegistry = {
  registry: 'quay.io/che-incubator',
  tag: 'next',
  tools: {
    'claude-code': {
      description: 'Claude',
      pattern: 'init' as const,
      src: '/usr/local/bin/claude',
      binary: 'claude',
      injector: { memoryLimit: '128Mi' },
      editor: {
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
        env: [],
        postStart: '',
      },
    },
  },
};

function buildDW(components: Array<Record<string, unknown>>, commands: Array<Record<string, unknown>> = [], events: Record<string, string[]> = {}) {
  return {
    apiVersion: 'workspace.devfile.io/v1alpha2',
    kind: 'DevWorkspace',
    metadata: { name: 'test', namespace: 'test-ns' },
    spec: {
      started: true,
      template: {
        components,
        commands,
        events,
      },
    },
  };
}

describe('sanitizeStaleComponents', () => {
  it('should remove injector components not in registry', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'unknown-tool-injector', container: { image: 'quay.io/some/unknown-tool:old' } },
    ], [
      { id: 'install-unknown-tool', apply: { component: 'unknown-tool-injector' } },
    ], {
      preStart: ['install-unknown-tool'],
    });
    const modified = sanitizeStaleComponents(dw, REGISTRY);
    expect(modified).toBe(true);
    expect(dw.spec.template.components).toHaveLength(1);
    expect(dw.spec.template.commands).toHaveLength(0);
  });

  it('should remove legacy symlink-* commands', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
    ], [
      { id: 'symlink-claude-code', exec: { commandLine: 'ln -sf ...' } },
    ], {
      postStart: ['symlink-claude-code'],
    });
    const modified = sanitizeStaleComponents(dw, REGISTRY);
    expect(modified).toBe(true);
    expect(dw.spec.template.commands).toHaveLength(0);
    expect(dw.spec.template.events.postStart).toEqual([]);
  });

  it('should not modify when nothing is stale', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'claude-code-injector', container: { image: 'quay.io/che-incubator/tools-injector/claude-code:next' } },
    ]);
    const modified = sanitizeStaleComponents(dw, REGISTRY);
    expect(modified).toBe(false);
  });
});

describe('reconcileToolImages', () => {
  it('should update injector image when registry tag changes', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'claude-code-injector', container: { image: 'quay.io/che-incubator/tools-injector/claude-code:old-tag' } },
    ]);
    const modified = reconcileToolImages(dw, REGISTRY);
    expect(modified).toBe(true);
    const injector = dw.spec.template.components.find(
      (c: Record<string, unknown>) => c.name === 'claude-code-injector',
    ) as unknown as Record<string, unknown>;
    const container = injector.container as Record<string, unknown>;
    expect(container.image).toBe('quay.io/che-incubator/tools-injector/claude-code:next');
  });

  it('should not modify when images are current', () => {
    const dw = buildDW([
      { name: 'editor', container: { image: 'code:latest' } },
      { name: 'claude-code-injector', container: { image: 'quay.io/che-incubator/tools-injector/claude-code:next' } },
    ]);
    const modified = reconcileToolImages(dw, REGISTRY);
    expect(modified).toBe(false);
  });
});
