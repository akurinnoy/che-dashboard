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

import { logger } from '@/utils/logger';

export const TOOLS_INJECT_ATTRIBUTE = 'tools.che.io/inject';
const TOOLS_INJECTOR_REGISTRY_CM = 'tools-injector-registry';

const TOOLS_INJECTOR_VOLUME = 'injected-tools';
const TOOLS_INJECTOR_VOLUME_SIZE = '256Mi';
const BUNDLE_MEMORY_BUMP_MI = 512;
const DEFAULT_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const INJECTED_TOOLS_VOLUME_MOUNT = { name: 'injected-tools', path: '/injected-tools' };

export interface ToolDefinition {
  description: string;
  pattern: 'init' | 'bundle';
  src: string;
  binary: string;
  injector: { memoryLimit: string };
  editor: {
    volumeMounts: Array<{ name: string; path: string }>;
    env: Array<{ name: string; value: string }>;
    memoryLimit?: string;
    postStart: string;
  };
}

export interface ToolsRegistry {
  registry: string;
  tag: string;
  infrastructure?: unknown;
  tools: Record<string, ToolDefinition>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DevWorkspace = any;

export function parseToolsInjectAttribute(attr: string | undefined): string[] {
  if (!attr || !attr.trim()) {
    return [];
  }
  return [...new Set(attr.split(',').map(s => s.trim()).filter(Boolean))];
}

function parseMemoryMi(mem: string): number {
  const match = mem.match(/^(\d+)Mi$/);
  return match ? parseInt(match[1], 10) : 0;
}

function findEditorComponent(
  components: Array<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  return components.find(
    c => c.container && c.name && !(c.name as string).endsWith('-injector'),
  );
}

function buildInjectorCommand(
  tool: ToolDefinition,
  toolName: string,
): { command: string[]; args: string[] } {
  if (tool.pattern === 'init') {
    return {
      command: ['/bin/sh'],
      args: ['-c', `mkdir -p /injected-tools/bin && cp ${tool.src} /injected-tools/bin/${tool.binary}`],
    };
  }
  return {
    command: ['/bin/sh'],
    args: ['-c', `mkdir -p /injected-tools/bin && cp -a ${tool.src}/. /injected-tools/${toolName}/ && ln -sf /injected-tools/${toolName}/bin/${tool.binary} /injected-tools/bin/${tool.binary}`],
  };
}

function buildPostStartCommandLine(tool: ToolDefinition): string | null {
  if (!tool.editor.postStart) {
    return null;
  }
  return `(${tool.editor.postStart}) 2>/dev/null || true`;
}

export function applyToolsInjection(
  devworkspace: DevWorkspace,
  registry: ToolsRegistry | null,
): void {
  const attr = devworkspace.spec?.template?.attributes?.[TOOLS_INJECT_ATTRIBUTE];
  if (typeof attr !== 'string') {
    return;
  }

  if (!registry) {
    return;
  }

  const requestedTools = parseToolsInjectAttribute(attr);
  if (requestedTools.length === 0) {
    return;
  }

  const template = devworkspace.spec.template;
  template.components = template.components ?? [];
  template.commands = template.commands ?? [];
  template.events = template.events ?? {};

  const editor = findEditorComponent(template.components);
  const resolvedTools: Array<{ name: string; def: ToolDefinition }> = [];

  for (const toolName of requestedTools) {
    const def = registry.tools[toolName];
    if (!def) {
      console.warn(`tools.che.io/inject: unknown tool "${toolName}", skipping`);
      continue;
    }
    resolvedTools.push({ name: toolName, def });
  }

  if (resolvedTools.length === 0) {
    return;
  }

  // Add injected-tools volume (once)
  if (!template.components.some((c: Record<string, unknown>) => c.name === TOOLS_INJECTOR_VOLUME)) {
    template.components.push({
      name: TOOLS_INJECTOR_VOLUME,
      volume: { size: TOOLS_INJECTOR_VOLUME_SIZE },
    });
  }

  for (const { name: toolName, def: tool } of resolvedTools) {
    const compName = `${toolName}-injector`;
    const installCmdId = `install-${toolName}`;
    const setupCmdId = `setup-${toolName}`;

    // Skip if already injected (idempotent)
    if (template.components.some((c: Record<string, unknown>) => c.name === compName)) {
      continue;
    }

    // Add injector init container
    const { command, args } = buildInjectorCommand(tool, toolName);
    template.components.push({
      name: compName,
      container: {
        image: `${registry.registry}/tools-injector/${toolName}:${registry.tag}`,
        command,
        args,
        memoryLimit: tool.injector.memoryLimit,
        mountSources: false,
        volumeMounts: [{ name: TOOLS_INJECTOR_VOLUME, path: '/injected-tools' as const }],
      },
    });

    // Add install command (preStart apply)
    template.commands.push({
      id: installCmdId,
      apply: { component: compName },
    });

    // Add setup command (postStart exec) only if tool has postStart setup
    const postStartCmd = buildPostStartCommandLine(tool);
    if (postStartCmd && editor) {
      template.commands.push({
        id: setupCmdId,
        exec: {
          component: editor.name,
          commandLine: postStartCmd,
        },
      });
    }

    // Events
    template.events.preStart = template.events.preStart ?? [];
    if (!template.events.preStart.includes(installCmdId)) {
      template.events.preStart.push(installCmdId);
    }

    if (postStartCmd && editor) {
      template.events.postStart = template.events.postStart ?? [];
      if (!template.events.postStart.includes(setupCmdId)) {
        template.events.postStart.push(setupCmdId);
      }
    }
  }

  // Editor modifications
  if (editor) {
    const container = editor.container as Record<string, unknown>;

    // Volume mount
    container.volumeMounts = (container.volumeMounts as Array<Record<string, unknown>>) ?? [];
    if (
      !(container.volumeMounts as Array<{ name: string }>).some(
        vm => vm.name === TOOLS_INJECTOR_VOLUME,
      )
    ) {
      (container.volumeMounts as Array<Record<string, unknown>>).push(INJECTED_TOOLS_VOLUME_MOUNT);
    }

    // PATH env var
    container.env = (container.env as Array<{ name: string; value: string }>) ?? [];
    const env = container.env as Array<{ name: string; value: string }>;
    const pathEntry = env.find(e => e.name === 'PATH');
    if (pathEntry) {
      if (!pathEntry.value.includes('/injected-tools/bin')) {
        pathEntry.value = `/injected-tools/bin:${pathEntry.value}`;
      }
    } else {
      env.push({ name: 'PATH', value: `/injected-tools/bin:${DEFAULT_PATH}` });
    }

    // Tool-specific env vars
    for (const { def: tool } of resolvedTools) {
      for (const envVar of tool.editor.env) {
        if (!env.some(e => e.name === envVar.name)) {
          env.push({ ...envVar });
        }
      }
    }

    // Memory adjustment
    let memoryMi = parseMemoryMi((container.memoryLimit as string) ?? '');
    for (const { def: tool } of resolvedTools) {
      const toolMin = parseMemoryMi(tool.editor.memoryLimit ?? '');
      if (toolMin > memoryMi) {
        memoryMi = toolMin;
      }
    }
    const bundleCount = resolvedTools.filter(t => t.def.pattern === 'bundle').length;
    memoryMi += bundleCount * BUNDLE_MEMORY_BUMP_MI;
    if (memoryMi > 0) {
      container.memoryLimit = `${memoryMi}Mi`;
    }
  }
}

export function transformV1ToToolsRegistry(v1: api.IAiRegistry): ToolsRegistry {
  let registry = '';
  let tag = 'next';

  const tools: Record<string, ToolDefinition> = {};

  for (const tool of v1.tools) {
    const [imagePath, imageTag] = tool.injectorImage.split(':');
    const slug = imagePath.split('/').pop() ?? tool.binary;

    if (!registry && imagePath.includes('/')) {
      const parts = imagePath.split('/');
      // Assumes tools-injector convention: <registry>/<org>/tools-injector/<tool>
      registry = parts.slice(0, -2).join('/');
    }
    if (!tag && imageTag) {
      tag = imageTag;
    }

    tools[slug] = {
      description: tool.name,
      pattern: tool.pattern,
      src: tool.pattern === 'init' ? `/usr/local/bin/${tool.binary}` : `/opt/${slug}/`,
      binary: tool.binary,
      injector: { memoryLimit: '1024Mi' },
      editor: {
        volumeMounts: [INJECTED_TOOLS_VOLUME_MOUNT],
        env: tool.envVarName ? [{ name: tool.envVarName, value: '' }] : [],
        memoryLimit: undefined,
        postStart: tool.setupCommand ?? '',
      },
    };
  }

  return { registry, tag, tools };
}

export async function loadToolsRegistry(
  kubeConfig: k8s.KubeConfig,
  namespace: string,
): Promise<ToolsRegistry | null> {
  try {
    const coreV1 = kubeConfig.makeApiClient(k8s.CoreV1Api);
    const response = await coreV1.readNamespacedConfigMap({
      name: TOOLS_INJECTOR_REGISTRY_CM,
      namespace,
    });
    const data = response?.data?.['registry.json'];
    if (!data) {
      return null;
    }
    return JSON.parse(data) as ToolsRegistry;
  } catch {
    return null;
  }
}
