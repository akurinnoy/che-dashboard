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

import { buildFactoryUrl } from '../buildFactoryUrl';
import { FactoryParams } from '../const';

describe('buildFactoryUrl', () => {
  const factoryUrlWithParams = 'https:/repo.org/my-repo/my-project?devfileFilename=my.devfileyaml';
  let factoryParams: FactoryParams;

  beforeEach(() => {
    factoryParams = {
      cheEditor: undefined,
      errorCode: undefined,
      factoryId: 'override.devfileFilename=my.devfile.yaml&url=https:/repo.org/my-repo/my-project',
      factoryUrl: 'https:/repo.org/my-repo/my-project',
      image: undefined,
      overrides: {
        'override.devfileFilename': 'my.devfile.yaml',
      },
      policiesCreate: 'peruser',
      remotes: undefined,
      sourceUrl: 'https:/repo.org/my-repo/my-project',
      storageType: undefined,
      useDevworkspaceResources: false,
    };
  });

  it('should', () => {
    const url = buildFactoryUrl(factoryParams);
    expect(url).toEqual(factoryUrlWithParams);
  });
});
