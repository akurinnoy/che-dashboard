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

import * as k8s from '@kubernetes/client-node';
import { api } from '@eclipse-che/common';
import {
  applyToolsInjection,
  loadToolsRegistry,
  parseToolsInjectAttribute,
  TOOLS_INJECT_ATTRIBUTE,
  ToolsRegistry,
} from '@/services/ToolsInjectorService';

const SAMPLE_REGISTRY: ToolsRegistry = {
  registry: 'quay.io/che-incubator',
  tag: 'next',
  infrastructure: {
    patch: [
      {
        op: 'add',
        path: '/spec/template/components/-',
        value: { name: 'injected-tools', volume: { size: '256Mi' } },
      },
    ],
  },
  tools: {
    'claude-code': {
      description: 'Claude Code AI assistant by Anthropic',
      pattern: 'init' as const,
      src: '/usr/local/bin/claude',
      binary: 'claude',
      injector: { memoryLimit: '128Mi' },
      editor: {
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
        env: [{ name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', value: '1' }],
        memoryLimit: '1024Mi',
        postStart: '',
      },
    },
    'gemini-cli': {
      description: 'Gemini CLI AI assistant by Google',
      pattern: 'bundle' as const,
      src: '/opt/gemini-cli',
      binary: 'gemini',
      injector: { memoryLimit: '256Mi' },
      editor: {
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
        env: [{ name: 'GEMINI_CLI_HOME', value: '/tmp/gemini-home' }],
        postStart:
          "mkdir -p /tmp/gemini-home/.gemini && echo '{\"projects\":{}}' > /tmp/gemini-home/.gemini/projects.json",
      },
    },
    tmux: {
      description: 'Terminal multiplexer',
      pattern: 'init' as const,
      src: '/usr/local/bin/tmux',
      binary: 'tmux',
      injector: { memoryLimit: '128Mi' },
      editor: {
        volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
        env: [],
        postStart: '',
      },
    },
  },
};

function buildDevWorkspace(
  attributes?: Record<string, unknown>,
  components?: Array<Record<string, unknown>>,
) {
  return {
    apiVersion: 'workspace.devfile.io/v1alpha2',
    kind: 'DevWorkspace',
    metadata: { name: 'test-ws', namespace: 'test-ns' },
    spec: {
      started: true,
      template: {
        attributes: attributes ?? {},
        components: components ?? [
          { name: 'editor', container: { image: 'che-code:latest', memoryLimit: '512Mi' } },
        ],
        commands: [] as Array<Record<string, unknown>>,
        events: {} as Record<string, string[]>,
      },
    },
  };
}

describe('ToolsInjectorService', () => {
  describe('TOOLS_INJECT_ATTRIBUTE', () => {
    it('should be the correct attribute key', () => {
      expect(TOOLS_INJECT_ATTRIBUTE).toBe('tools.che.io/inject');
    });
  });

  describe('parseToolsInjectAttribute', () => {
    it('should parse comma-separated tool names', () => {
      expect(parseToolsInjectAttribute('claude-code,tmux')).toEqual(['claude-code', 'tmux']);
    });

    it('should trim whitespace', () => {
      expect(parseToolsInjectAttribute('claude-code , tmux ')).toEqual(['claude-code', 'tmux']);
    });

    it('should deduplicate', () => {
      expect(parseToolsInjectAttribute('claude-code,tmux,claude-code')).toEqual([
        'claude-code',
        'tmux',
      ]);
    });

    it('should return empty array for undefined', () => {
      expect(parseToolsInjectAttribute(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseToolsInjectAttribute('')).toEqual([]);
    });

    it('should handle comma-only input', () => {
      expect(parseToolsInjectAttribute(',,,')).toEqual([]);
    });
  });

  describe('applyToolsInjection', () => {
    it('should not modify DevWorkspace when attribute is absent', () => {
      const dw = buildDevWorkspace();
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      expect(dw.spec.template.components).toHaveLength(1);
    });

    it('should not modify DevWorkspace when registry is null', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, null);
      expect(dw.spec.template.components).toHaveLength(1);
    });

    it('should skip unknown tools with warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'unknown-tool' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      expect(dw.spec.template.components).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown-tool'));
      warnSpy.mockRestore();
    });

    it('should add injected-tools volume', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'tmux' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const volume = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'injected-tools',
      );
      expect(volume).toBeDefined();
      expect((volume as Record<string, unknown>).volume).toEqual({ size: '256Mi' });
    });

    it('should add init-pattern injector component', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const injector = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'claude-code-injector',
      ) as unknown as Record<string, unknown> | undefined;
      expect(injector).toBeDefined();
      const container = injector?.container as Record<string, unknown>;
      expect(container.image).toBe('quay.io/che-incubator/tools-injector/claude-code:next');
      expect(container.command).toEqual(['/bin/sh']);
      expect(container.args).toEqual(['-c', 'mkdir -p /injected-tools/bin && cp /usr/local/bin/claude /injected-tools/bin/claude']);
      expect(container.memoryLimit).toBe('128Mi');
    });

    it('should add bundle-pattern injector component', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'gemini-cli' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const injector = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'gemini-cli-injector',
      ) as unknown as Record<string, unknown> | undefined;
      expect(injector).toBeDefined();
      const container = injector?.container as Record<string, unknown>;
      expect(container.command).toEqual(['/bin/sh']);
      expect(container.args).toEqual([
        '-c',
        'mkdir -p /injected-tools/bin && cp -a /opt/gemini-cli/. /injected-tools/gemini-cli/ && ln -sf /injected-tools/gemini-cli/bin/gemini /injected-tools/bin/gemini',
      ]);
      expect(container.memoryLimit).toBe('256Mi');
    });

    it('should add volumeMount to editor container', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'tmux' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const editor = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'editor',
      ) as unknown as Record<string, unknown>;
      const container = editor.container as Record<string, unknown>;
      const mounts = container.volumeMounts as Array<{ name: string; path: string }>;
      expect(mounts).toContainEqual({ name: 'injected-tools', path: '/injected-tools' });
    });

    it('should add PATH env var to editor container', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'tmux' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const editor = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'editor',
      ) as unknown as Record<string, unknown>;
      const container = editor.container as Record<string, unknown>;
      const env = container.env as Array<{ name: string; value: string }>;
      const pathEntry = env.find(e => e.name === 'PATH');
      expect(pathEntry).toBeDefined();
      expect(pathEntry?.value).toContain('/injected-tools/bin');
    });

    it('should add tool-specific env vars', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const editor = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'editor',
      ) as unknown as Record<string, unknown>;
      const container = editor.container as Record<string, unknown>;
      const env = container.env as Array<{ name: string; value: string }>;
      expect(env).toContainEqual({
        name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
        value: '1',
      });
    });

    it('should increase editor memory when tool requires it', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const editor = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'editor',
      ) as unknown as Record<string, unknown>;
      const container = editor.container as Record<string, unknown>;
      // Base 512Mi + claude-code 1024Mi = 1536Mi
      expect(container.memoryLimit).toBe('1536Mi');
    });

    it('should add 512Mi per bundle tool', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code,gemini-cli' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const editor = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'editor',
      ) as unknown as Record<string, unknown>;
      const container = editor.container as Record<string, unknown>;
      // Base 512Mi + claude-code 1024Mi + gemini-cli 0Mi + bundle bump 512Mi = 2048Mi
      expect(container.memoryLimit).toBe('2048Mi');
    });

    it('should add preStart events', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code,tmux' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      expect(dw.spec.template.events.preStart).toContain('install-claude-code');
      expect(dw.spec.template.events.preStart).toContain('install-tmux');
    });

    it('should not add postStart event for tools without editor.postStart', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      expect(dw.spec.template.events.postStart).toBeUndefined();
    });

    it('should add postStart event for tools with editor.postStart', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'gemini-cli' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      expect(dw.spec.template.events.postStart).toContain('setup-gemini-cli');
    });

    it('should add install command', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const installCmd = dw.spec.template.commands.find(
        (c: Record<string, unknown>) => (c as { id: string }).id === 'install-claude-code',
      );
      expect(installCmd).toBeDefined();
    });

    it('should copy init-pattern binary directly to /injected-tools/bin/', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const injector = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'claude-code-injector',
      ) as unknown as Record<string, unknown>;
      const container = injector.container as Record<string, unknown>;
      expect(container.args).toEqual(['-c', 'mkdir -p /injected-tools/bin && cp /usr/local/bin/claude /injected-tools/bin/claude']);
    });

    it('should copy and symlink bundle-pattern in init container', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'gemini-cli' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const injector = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'gemini-cli-injector',
      ) as unknown as Record<string, unknown>;
      const container = injector.container as Record<string, unknown>;
      expect((container.args as string[])[1]).toContain('ln -sf /injected-tools/gemini-cli/bin/gemini /injected-tools/bin/gemini');
    });

    it('should include tool postStart commands', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'gemini-cli' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const setupCmd = dw.spec.template.commands.find(
        (c: Record<string, unknown>) => (c as { id: string }).id === 'setup-gemini-cli',
      ) as unknown as Record<string, unknown>;
      const exec = setupCmd.exec as Record<string, unknown>;
      expect(exec.commandLine).toContain('mkdir -p /tmp/gemini-home/.gemini');
    });

    it('should handle multiple tools in one attribute', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code,tmux,gemini-cli' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const componentNames = dw.spec.template.components.map(
        (c: Record<string, unknown>) => c.name,
      );
      expect(componentNames).toContain('claude-code-injector');
      expect(componentNames).toContain('tmux-injector');
      expect(componentNames).toContain('gemini-cli-injector');
      expect(componentNames).toContain('injected-tools');
    });

    it('should not duplicate injected-tools volume', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code,tmux' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const volumes = dw.spec.template.components.filter(
        (c: Record<string, unknown>) => c.name === 'injected-tools',
      );
      expect(volumes).toHaveLength(1);
    });

    it('should be idempotent', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'tmux' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const countAfterFirst = dw.spec.template.components.length;
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      expect(dw.spec.template.components).toHaveLength(countAfterFirst);
    });

    it('should sum editor memory bumps additively', () => {
      const registry = {
        ...SAMPLE_REGISTRY,
        tools: {
          ...SAMPLE_REGISTRY.tools,
          'tool-a': {
            ...SAMPLE_REGISTRY.tools['claude-code'],
            editor: {
              ...SAMPLE_REGISTRY.tools['claude-code'].editor,
              memoryLimit: '1024Mi',
            },
          },
          'tool-b': {
            ...SAMPLE_REGISTRY.tools['gemini-cli'],
            editor: {
              ...SAMPLE_REGISTRY.tools['gemini-cli'].editor,
              memoryLimit: '512Mi',
            },
          },
        },
      };
      const dw = buildDevWorkspace(
        { [TOOLS_INJECT_ATTRIBUTE]: 'tool-a,tool-b' },
        [{ name: 'editor', container: { image: 'che-code:latest', memoryLimit: '512Mi' } }],
      );
      applyToolsInjection(dw, registry);
      const editor = dw.spec.template.components.find(
        (c: Record<string, unknown>) => c.name === 'editor',
      ) as unknown as Record<string, unknown>;
      const container = editor.container as Record<string, unknown>;
      // Base 512Mi + tool-a 1024Mi + tool-b 512Mi + bundle bump 512Mi = 2560Mi
      expect(container.memoryLimit).toBe('2560Mi');
    });

    it('should track memory bump via annotation', () => {
      const dw = buildDevWorkspace({ [TOOLS_INJECT_ATTRIBUTE]: 'claude-code' });
      applyToolsInjection(dw, SAMPLE_REGISTRY);
      const metadata = dw.metadata as unknown as { annotations?: Record<string, string> };
      expect(metadata.annotations).toBeDefined();
      expect(metadata.annotations?.['tools.che.io/memory-bump']).toBeDefined();
    });
  });

  describe('loadToolsRegistry with unified ConfigMap', () => {
    let kubeConfig: k8s.KubeConfig;
    let listNamespacedConfigMapMock: jest.Mock;

    beforeEach(() => {
      kubeConfig = new k8s.KubeConfig();
      listNamespacedConfigMapMock = jest.fn();
      jest.spyOn(kubeConfig, 'makeApiClient').mockReturnValue({
        listNamespacedConfigMap: listNamespacedConfigMapMock,
      } as any);
    });

    afterEach(() => {
      delete process.env.CHECLUSTER_CR_NAMESPACE;
      jest.restoreAllMocks();
    });

    it('should prefer che-ai-tools-config from DWO namespace (V2 format)', async () => {
      process.env.CHECLUSTER_CR_NAMESPACE = 'devworkspace-operator';
      const v2Registry: api.IAiRegistryV2 = {
        schemaVersion: '2',
        registry: 'quay.io/che-incubator',
        tag: 'next',
        providers: {},
        defaultProviders: [],
        tools: {
          'claude-code': {
            description: 'Claude Code AI assistant',
            pattern: 'init',
            src: '/usr/local/bin/claude',
            binary: 'claude',
            injector: {
              memoryLimit: '128Mi',
              image: 'quay.io/che-incubator/tools-injector/claude-code:next',
            },
            editor: {
              volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
              env: [],
              postStart: '',
            },
          },
        },
      };

      listNamespacedConfigMapMock.mockResolvedValueOnce({
        items: [
          {
            metadata: { name: 'che-ai-tools-config' },
            data: { 'registry.json': JSON.stringify(v2Registry) },
          },
        ],
      });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(listNamespacedConfigMapMock).toHaveBeenCalledWith({
        namespace: 'devworkspace-operator',
        labelSelector: 'app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org',
      });
      expect(result).not.toBeNull();
      expect(result?.registry).toBe('quay.io/che-incubator');
      expect(result?.tag).toBe('next');
      expect(result?.tools['claude-code']).toBeDefined();
    });

    it('should transform V1 format from DWO ConfigMap', async () => {
      process.env.CHECLUSTER_CR_NAMESPACE = 'devworkspace-operator';
      const v1Registry: api.IAiRegistry = {
        providers: [],
        defaultAiProviders: [],
        tools: [
          {
            providerId: 'anthropic/claude',
            tag: 'latest',
            name: 'Claude Code',
            url: 'https://claude.ai',
            binary: 'claude',
            pattern: 'init',
            injectorImage: 'quay.io/che-incubator/tools-injector/claude-code:next',
            envVarName: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
            setupCommand: '',
          },
        ],
      };

      listNamespacedConfigMapMock.mockResolvedValueOnce({
        items: [
          {
            metadata: { name: 'che-ai-tools-config' },
            data: { 'registry.json': JSON.stringify(v1Registry) },
          },
        ],
      });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(result).not.toBeNull();
      expect(result?.tools['claude-code']).toBeDefined();
      expect(result?.tools['claude-code'].pattern).toBe('init');
    });

    it('should fall back to tools-injector-registry from user namespace', async () => {
      process.env.CHECLUSTER_CR_NAMESPACE = 'devworkspace-operator';
      const userRegistry: ToolsRegistry = {
        registry: 'quay.io/user-registry',
        tag: 'latest',
        tools: {
          tmux: {
            description: 'tmux',
            pattern: 'init',
            src: '/usr/local/bin/tmux',
            binary: 'tmux',
            injector: { memoryLimit: '128Mi' },
            editor: {
              volumeMounts: [{ name: 'injected-tools', path: '/injected-tools' }],
              env: [],
              postStart: '',
            },
          },
        },
      };

      listNamespacedConfigMapMock
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({
          items: [
            {
              metadata: { name: 'tools-injector-registry' },
              data: { 'registry.json': JSON.stringify(userRegistry) },
            },
          ],
        });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(listNamespacedConfigMapMock).toHaveBeenNthCalledWith(1, {
        namespace: 'devworkspace-operator',
        labelSelector: 'app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org',
      });
      expect(listNamespacedConfigMapMock).toHaveBeenNthCalledWith(2, {
        namespace: 'user-ns',
        labelSelector: 'app.kubernetes.io/part-of=tools-injector',
      });
      expect(result).not.toBeNull();
      expect(result?.registry).toBe('quay.io/user-registry');
    });

    it('should return null when neither ConfigMap exists', async () => {
      process.env.CHECLUSTER_CR_NAMESPACE = 'devworkspace-operator';

      listNamespacedConfigMapMock
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValueOnce({ items: [] });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(result).toBeNull();
    });

    it('should handle DWO namespace API errors and fall back gracefully', async () => {
      process.env.CHECLUSTER_CR_NAMESPACE = 'devworkspace-operator';
      const userRegistry: ToolsRegistry = {
        registry: 'quay.io/user-registry',
        tag: 'latest',
        tools: {},
      };

      listNamespacedConfigMapMock
        .mockRejectedValueOnce(new Error('Forbidden'))
        .mockResolvedValueOnce({
          items: [
            {
              metadata: { name: 'tools-injector-registry' },
              data: { 'registry.json': JSON.stringify(userRegistry) },
            },
          ],
        });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(result).not.toBeNull();
      expect(result?.registry).toBe('quay.io/user-registry');
    });

    it('should return null when CHECLUSTER_CR_NAMESPACE is not set and user ConfigMap missing', async () => {
      listNamespacedConfigMapMock.mockResolvedValueOnce({ items: [] });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(listNamespacedConfigMapMock).toHaveBeenCalledTimes(1);
      expect(listNamespacedConfigMapMock).toHaveBeenCalledWith({
        namespace: 'user-ns',
        labelSelector: 'app.kubernetes.io/part-of=tools-injector',
      });
      expect(result).toBeNull();
    });

    it('should handle unparseable ConfigMap data gracefully', async () => {
      process.env.CHECLUSTER_CR_NAMESPACE = 'devworkspace-operator';

      listNamespacedConfigMapMock.mockResolvedValueOnce({
        items: [
          {
            metadata: { name: 'che-ai-tools-config' },
            data: { 'registry.json': 'not valid json' },
          },
        ],
      }).mockResolvedValueOnce({ items: [] });

      const result = await loadToolsRegistry(kubeConfig, 'user-ns');

      expect(result).toBeNull();
    });
  });
});
