/*
 * Copyright (c) 2018-2023 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { FastifyInstance } from 'fastify';
import { baseApiPath } from '../../../constants/config';
import { setup, teardown } from '../../../helpers/tests/appBuilder';
import { DevWorkspaceClient } from '../../../devworkspaceClient';
import { getDevWorkspaceClient } from '../helpers/getDevWorkspaceClient';

jest.mock('../helpers/getDevWorkspaceClient.ts');
jest.mock('../helpers/getToken.ts');

describe('Gitconfig Routes', () => {
  let app: FastifyInstance;
  const namespace = 'user-che';
  let devWorkspaceClient: DevWorkspaceClient;

  beforeAll(async () => {
    app = await setup();
    devWorkspaceClient = getDevWorkspaceClient('token');
  });

  afterAll(() => {
    teardown(app);
  });

  test('GET ${baseApiPath}/namespace/:namespace/gitconfig', async () => {
    const res = await app.inject().get(`${baseApiPath}/namespace/${namespace}/gitconfig`);

    expect(res.statusCode).toEqual(200);
    expect(res.json()).toEqual({});

    expect(devWorkspaceClient.gitConfigApi.read).not.toHaveBeenCalledTimes(1);
    expect(devWorkspaceClient.gitConfigApi.patch).not.toHaveBeenCalled();
  });

  test('PATCH ${baseApiPath}/namespace/:namespace/gitconfig', async () => {
    const res = await app
      .inject()
      .put(`${baseApiPath}/namespace/${namespace}/gitcofig`)
      .payload({ dockerconfig: 'dockerconfig' });

    expect(res.statusCode).toEqual(200);
    expect(res.json()).toEqual({});
  });
});
