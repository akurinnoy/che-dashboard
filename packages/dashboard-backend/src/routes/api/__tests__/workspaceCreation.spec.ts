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

import { Main } from '@eclipse-che/che-devworkspace-generator/lib/main';
import { FastifyInstance } from 'fastify';

import { baseApiPath } from '@/constants/config';
import { stubDevWorkspace } from '@/routes/api/helpers/__mocks__/getDevWorkspaceClient';
import { getDevWorkspaceClient } from '@/routes/api/helpers/getDevWorkspaceClient';
import { createFastifyError } from '@/services/helpers';
import { setup, teardown } from '@/utils/appBuilder';

jest.mock('../helpers/getDevWorkspaceClient.ts');
jest.mock('../helpers/getToken.ts');
jest.mock('../helpers/getServiceAccountToken.ts');
jest.mock('@eclipse-che/che-devworkspace-generator/lib/main', () => ({ Main: jest.fn() }));

describe('Workspace Creation Route', () => {
  let app: FastifyInstance;

  let mockDevworkspaceCreate: jest.Mock;
  let mockDevworkspacePatch: jest.Mock;
  let mockTemplateCreate: jest.Mock;
  let mockGenerateDevfileContext: jest.Mock;

  beforeAll(async () => {
    app = await setup();
  });

  afterAll(() => {
    teardown(app);
  });

  beforeEach(() => {
    mockDevworkspaceCreate = jest
      .fn()
      .mockResolvedValue({ devWorkspace: { ...stubDevWorkspace } });
    mockDevworkspacePatch = jest.fn();
    mockTemplateCreate = jest.fn().mockResolvedValue({});
    (getDevWorkspaceClient as jest.Mock).mockReturnValue({
      devworkspaceApi: { create: mockDevworkspaceCreate, patch: mockDevworkspacePatch },
      devWorkspaceTemplateApi: { create: mockTemplateCreate },
    });

    mockGenerateDevfileContext = jest.fn();
    (Main as jest.Mock).mockImplementation(() => ({
      generateDevfileContext: mockGenerateDevfileContext,
    }));
    mockGenerateDevfileContext.mockResolvedValue({
      devWorkspace: { ...stubDevWorkspace },
      devWorkspaceTemplates: [],
      suffix: '-abc',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validPayload = {
    devfileContent: 'schemaVersion: 2.2.0',
    namespace: 'user-che',
  };

  const authHeader = 'Bearer test-token';

  it('spec-acc-001: successful creation returns 200 with devWorkspace', async () => {
    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload(validPayload);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('devWorkspace');
    expect(mockDevworkspaceCreate).toHaveBeenCalledTimes(1);
  });

  it('spec-acc-002: missing devfileContent returns 400', async () => {
    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload({ namespace: 'user-che' });

    expect(res.statusCode).toBe(400);
  });

  it('spec-acc-003: missing namespace returns 400', async () => {
    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload({ devfileContent: 'schemaVersion: 2.2.0' });

    expect(res.statusCode).toBe(400);
  });

  it('spec-acc-004: missing Authorization header returns 401', async () => {
    const getTokenMock = jest.requireMock('../helpers/getToken.ts');
    jest.spyOn(getTokenMock, 'getToken').mockImplementationOnce(() => {
      throw createFastifyError('FST_UNAUTHORIZED', 'Bearer Token Authorization is required', 401);
    });

    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .payload(validPayload);

    expect(res.statusCode).toBe(401);
  });

  it('spec-acc-005: K8s AlreadyExists on devworkspaceApi.create returns 409', async () => {
    const alreadyExistsErr: any = new Error('AlreadyExists');
    alreadyExistsErr.statusCode = 409;
    mockDevworkspaceCreate.mockRejectedValue(alreadyExistsErr);

    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload(validPayload);

    expect(res.statusCode).toBe(409);
  });

  it('spec-acc-006: Generic K8s error returns 500', async () => {
    mockDevworkspaceCreate.mockRejectedValue(new Error('Internal server error'));

    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload(validPayload);

    expect(res.statusCode).toBe(500);
  });

  it('spec-acc-007: name override applied to devWorkspace.metadata.name', async () => {
    const customName = 'my-custom-workspace';

    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload({ ...validPayload, name: customName });

    expect(res.statusCode).toBe(200);
    const [calledWithDw] = mockDevworkspaceCreate.mock.calls[0];
    expect(calledWithDw.metadata.name).toBe(customName);
  });

  it('spec-acc-008: attributes merged with generator-set attributes (ADR-002); mockDevworkspacePatch NEVER called', async () => {
    const userAttributes = { 'che.eclipse.org/storage-type': 'ephemeral' };

    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload({ ...validPayload, attributes: userAttributes });

    expect(res.statusCode).toBe(200);
    const [calledWithDw] = mockDevworkspaceCreate.mock.calls[0];
    expect(calledWithDw.spec.template.attributes).toMatchObject(userAttributes);
    expect(mockDevworkspacePatch).not.toHaveBeenCalled();
  });

  it('spec-acc-009: DevWorkspaceTemplates created before DevWorkspace (ADR-003)', async () => {
    const stubTemplate = {
      apiVersion: 'workspace.devfile.io/v1alpha2',
      kind: 'DevWorkspaceTemplate',
      metadata: { name: 'tmpl-1' },
    };
    mockGenerateDevfileContext.mockResolvedValue({
      devWorkspace: { ...stubDevWorkspace },
      devWorkspaceTemplates: [stubTemplate],
      suffix: '-abc',
    });

    const res = await app
      .inject()
      .post(`${baseApiPath}/workspace`)
      .headers({ authorization: authHeader })
      .payload(validPayload);

    expect(res.statusCode).toBe(200);
    expect(mockTemplateCreate).toHaveBeenCalledTimes(1);
    expect(mockDevworkspaceCreate).toHaveBeenCalledTimes(1);
    expect(mockTemplateCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mockDevworkspaceCreate.mock.invocationCallOrder[0],
    );
  });
});
