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

    // Calculate additive memory bump
    const baseMemoryMi = parseMemoryMi((container.memoryLimit as string) ?? '512Mi');
    let totalBump = 0;
    for (const { def: tool } of resolvedTools) {
      const toolMem = parseMemoryMi(tool.editor.memoryLimit ?? '0');
      totalBump += toolMem;
    }
    const bundleCount = resolvedTools.filter(t => t.def.pattern === 'bundle').length;
    totalBump += bundleCount * BUNDLE_MEMORY_BUMP_MI; // +512Mi per bundle tool for Node.js runtime

    container.memoryLimit = `${baseMemoryMi + totalBump}Mi`;

    // Track the bump for cleanup
    if (!devworkspace.metadata) devworkspace.metadata = {};
    if (!devworkspace.metadata.annotations) devworkspace.metadata.annotations = {};
    devworkspace.metadata.annotations['tools.che.io/memory-bump'] = `${totalBump}`;
  }
}

export function transformV1ToToolsRegistry(v1: api.IAiRegistry): ToolsRegistry {
  let registry = '';
  let tag = '';

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

  return { registry, tag: tag || 'next', tools };
}


const UNIFIED_CM_LABEL = 'app.kubernetes.io/component=ai-tool-registry,app.kubernetes.io/part-of=che.eclipse.org';
const TOOLS_INJECTOR_CM_LABEL = 'app.kubernetes.io/part-of=tools-injector';

export function sanitizeStaleComponents(
  devworkspace: Record<string, unknown>,
  registry: ToolsRegistry,
): boolean {
  const template = (devworkspace as any).spec?.template;
  if (!template) return false;

  let modified = false;
  const knownTools = new Set(Object.keys(registry.tools));
  const components = template.components as Array<Record<string, unknown>> ?? [];
  const commands = template.commands as Array<Record<string, unknown>> ?? [];

  // Remove injector components for tools not in registry
  const staleInjectors = components.filter((c) => {
    const name = c.name as string;
    if (!name?.endsWith('-injector')) return false;
    const toolName = name.replace(/-injector$/, '');
    return !knownTools.has(toolName);
  });

  for (const stale of staleInjectors) {
    const idx = components.indexOf(stale);
    if (idx >= 0) {
      components.splice(idx, 1);
      modified = true;
    }
  }

  // Remove legacy symlink-* commands and any orphaned install/setup commands
  const staleCommands = commands.filter((cmd) => {
    const id = (cmd as any).id as string;
    if (!id) return false;
    if (id.startsWith('symlink-')) return true;
    if (id.startsWith('install-') || id.startsWith('setup-')) {
      const toolName = id.replace(/^(install|setup|symlink)-/, '');
      return !knownTools.has(toolName) || !components.some(c => c.name === `${toolName}-injector`);
    }
    return false;
  });

  for (const stale of staleCommands) {
    const idx = commands.indexOf(stale);
    if (idx >= 0) {
      commands.splice(idx, 1);
      modified = true;
    }
  }

  // Clean up events referencing removed commands
  const events = template.events as Record<string, string[]> ?? {};
  for (const eventType of ['preStart', 'postStart'] as const) {
    if (events[eventType]) {
      const before = events[eventType].length;
      events[eventType] = events[eventType].filter(
        (id: string) => commands.some((cmd: any) => cmd.id === id) || !(id.startsWith('install-') || id.startsWith('setup-') || id.startsWith('symlink-')),
      );
      if (events[eventType].length !== before) modified = true;
    }
  }

  return modified;
}

export function reconcileToolImages(
  devworkspace: Record<string, unknown>,
  registry: ToolsRegistry,
): boolean {
  const template = (devworkspace as any).spec?.template;
  if (!template) return false;

  let modified = false;
  const components = template.components as Array<Record<string, unknown>> ?? [];

  for (const [toolName, toolDef] of Object.entries(registry.tools)) {
    const compName = `${toolName}-injector`;
    const comp = components.find(c => c.name === compName);
    if (!comp) continue;

    const container = comp.container as Record<string, unknown> | undefined;
    if (!container?.image) continue;

    const expectedImage = `${registry.registry}/tools-injector/${toolName}:${registry.tag}`;
    if (container.image !== expectedImage) {
      container.image = expectedImage;
      modified = true;
    }
  }

  return modified;
}

export async function loadToolsRegistry(
  kubeConfig: k8s.KubeConfig,
  namespace: string,
): Promise<ToolsRegistry | null> {
  const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);

  // 1. Try unified ConfigMap from DWO namespace
  const dwoNamespace = process.env.CHECLUSTER_CR_NAMESPACE;
  if (dwoNamespace) {
    try {
      const response = await coreApi.listNamespacedConfigMap({
        namespace: dwoNamespace,
        labelSelector: UNIFIED_CM_LABEL,
      });
      if (response.items.length > 0) {
        const cm = response.items[0];
        for (const key of Object.keys(cm.data ?? {})) {
          try {
            const parsed = JSON.parse(cm.data![key]);
            if (api.isV2Registry(parsed)) {
              // V2 format — already compatible with ToolsRegistry
              return parsed as unknown as ToolsRegistry;
            }
            // V1 format — transform
            if (parsed.providers && parsed.tools && Array.isArray(parsed.tools)) {
              return transformV1ToToolsRegistry(parsed as api.IAiRegistry);
            }
          } catch {
            // skip unparseable keys
          }
        }
      }
    } catch (e) {
      logger.warn('[ToolsInjectorService] Failed to read unified ConfigMap from DWO namespace:', e);
    }
  }

  // 2. Fall back to tools-injector-registry from user namespace
  try {
    const response = await coreApi.listNamespacedConfigMap({
      namespace,
      labelSelector: TOOLS_INJECTOR_CM_LABEL,
    });
    if (response.items.length > 0) {
      const data = response.items[0].data?.['registry.json'];
      if (data) {
        return JSON.parse(data) as ToolsRegistry;
      }
    }
  } catch (e) {
    logger.warn('[ToolsInjectorService] Failed to read tools-injector-registry:', e);
  }

  return null;
}
