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
import { Main as DevworkspaceGenerator } from '@eclipse-che/che-devworkspace-generator/lib/main';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { baseApiPath } from '@/constants/config';
import { workspaceCreationSchema } from '@/constants/schemas';
import { axiosInstance } from '@/routes/api/helpers/getCertificateAuthority';
import { getDevWorkspaceClient } from '@/routes/api/helpers/getDevWorkspaceClient';
import { getToken } from '@/routes/api/helpers/getToken';
import { getSchema } from '@/services/helpers';

const tags = ['Workspace'];

export function registerWorkspaceCreationRoute(instance: FastifyInstance) {
  instance.register(async server => {
    server.post(
      `${baseApiPath}/workspace`,
      getSchema({ tags, body: workspaceCreationSchema }),
      async function (request: FastifyRequest, reply: FastifyReply) {
        const { devfileContent, editorContent, editorPath, name, namespace, attributes } =
          request.body as api.IWorkspaceCreationParams;
        const token = getToken(request);
        const { devworkspaceApi, devWorkspaceTemplateApi } = getDevWorkspaceClient(token);
        const generator = new DevworkspaceGenerator();
        const context = await generator.generateDevfileContext(
          { devfileContent, editorPath, editorContent, projects: [] },
          axiosInstance,
        );
        const { devWorkspace, devWorkspaceTemplates } = context;

        // mutate namespace (inv-adr001-3)
        if (!devWorkspace.metadata) devWorkspace.metadata = {};
        devWorkspace.metadata.namespace = namespace;

        // mutate name if provided
        if (name) devWorkspace.metadata.name = name;

        // merge attributes before create (ADR-002 opt-a, inv-adr002-1, inv-adr002-3)
        if (attributes && Object.keys(attributes).length > 0) {
          if (!devWorkspace.spec) devWorkspace.spec = {} as any;
          const spec = devWorkspace.spec!;
          if (!spec.template) spec.template = {} as any;
          const template = spec.template!;
          template.attributes = {
            ...(template.attributes || {}),
            ...attributes,
          };
        }

        // [CREATE_TEMPLATES] — sequential loop (inv-adr003-3)
        for (const template of devWorkspaceTemplates) {
          if (!template.metadata) template.metadata = {};
          template.metadata.namespace = namespace; // inv-adr003-2
          try {
            await devWorkspaceTemplateApi.create(template);
          } catch (err: any) {
            if (err.statusCode === 409) {
              return reply.code(409).send(err);
            }
            throw err;
          }
        }

        // [CREATE_WORKSPACE] — DWT before DW enforced by order (inv-adr003-1)
        try {
          const { devWorkspace: createdWorkspace } = await devworkspaceApi.create(
            devWorkspace,
            namespace,
          );
          return reply.send({ devWorkspace: createdWorkspace });
        } catch (err: any) {
          if (err.statusCode === 409) {
            return reply.code(409).send(err);
          }
          throw err;
        }
      },
    );
  });
}
