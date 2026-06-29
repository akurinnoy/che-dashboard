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

import { api } from '@eclipse-che/common';
import { transformV1ToToolsRegistry } from '@/services/ToolsInjectorService';

const V1_REGISTRY: api.IAiRegistry = {
  providers: [
    { id: 'anthropic/claude', name: 'Claude', publisher: 'Anthropic' },
  ],
  tools: [
    {
      providerId: 'anthropic/claude',
      tag: 'next',
      name: 'Claude Code',
      url: 'https://claude.ai',
      binary: 'claude',
      pattern: 'init' as const,
      injectorImage: 'quay.io/che-incubator/tools-injector/claude-code:next',
    },
    {
      providerId: 'google/gemini',
      tag: 'next',
      name: 'Gemini CLI',
      url: 'https://gemini.google.com',
      binary: 'gemini',
      pattern: 'bundle' as const,
      injectorImage: 'quay.io/che-incubator/tools-injector/gemini-cli:next',
      setupCommand: 'mkdir -p /tmp/gemini-home',
    },
  ],
  defaultAiProviders: ['anthropic/claude'],
};

describe('transformV1ToToolsRegistry', () => {
  it('should convert V1 registry to ToolsRegistry format', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.registry).toBe('quay.io/che-incubator');
    expect(result.tag).toBe('next');
    expect(Object.keys(result.tools)).toEqual(['claude-code', 'gemini-cli']);
  });

  it('should derive src path for init pattern', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['claude-code'].src).toBe('/usr/local/bin/claude');
    expect(result.tools['claude-code'].pattern).toBe('init');
  });

  it('should derive src path for bundle pattern', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['gemini-cli'].src).toBe('/opt/gemini-cli/');
    expect(result.tools['gemini-cli'].pattern).toBe('bundle');
  });

  it('should set injector memory to 1024Mi for all V1 tools', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['claude-code'].injector.memoryLimit).toBe('1024Mi');
    expect(result.tools['gemini-cli'].injector.memoryLimit).toBe('1024Mi');
  });

  it('should use setupCommand as postStart', () => {
    const result = transformV1ToToolsRegistry(V1_REGISTRY);
    expect(result.tools['gemini-cli'].editor.postStart).toBe('mkdir -p /tmp/gemini-home');
    expect(result.tools['claude-code'].editor.postStart).toBe('');
  });

  it('should handle empty tools array', () => {
    const result = transformV1ToToolsRegistry({
      providers: [],
      tools: [],
      defaultAiProviders: [],
    });
    expect(result.tools).toEqual({});
  });

  it('should extract slug from injector image', () => {
    const result = transformV1ToToolsRegistry({
      providers: [],
      tools: [
        {
          providerId: 'test',
          tag: 'latest',
          name: 'Test',
          url: '',
          binary: 'test',
          pattern: 'init' as const,
          injectorImage: 'registry.example.com/org/my-tool:v1.0',
        },
      ],
      defaultAiProviders: [],
    });
    expect(Object.keys(result.tools)).toEqual(['my-tool']);
  });
});
