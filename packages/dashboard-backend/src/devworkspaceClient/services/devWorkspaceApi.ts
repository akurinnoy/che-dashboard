/*
 * Copyright (c) 2018-2024 Red Hat, Inc.
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { V1alpha2DevWorkspace } from '@devfile/api';
import {
  devworkspaceApiVersion,
  devworkspaceGroup,
  devworkspaceLatestVersion,
  devworkspacePlural,
} from '@devfile/api/api';
import { api } from '@eclipse-che/common';
import * as k8s from '@kubernetes/client-node';
import { V1Status } from '@kubernetes/client-node';
import { AxiosHeaders, AxiosResponse, RawAxiosResponseHeaders } from 'axios';
import http, { IncomingHttpHeaders } from 'http';
import https from 'https';
import fetch from 'node-fetch';
import request from 'request';
import { Agent } from 'undici';

import { createError } from '@/devworkspaceClient/services/helpers/createError';
import { ServerConfig } from '@/devworkspaceClient/services/helpers/exec';
import {
  CustomObjectAPI,
  prepareCustomObjectAPI,
} from '@/devworkspaceClient/services/helpers/prepareCustomObjectAPI';
import { prepareCustomObjectWatch } from '@/devworkspaceClient/services/helpers/prepareCustomObjectWatch';
import { IDevWorkspaceApi } from '@/devworkspaceClient/types';
import {
  axiosInstance,
  axiosInstanceNoCert,
  certificateAuthority,
} from '@/routes/api/helpers/getCertificateAuthority';
import { MessageListener } from '@/services/types/Observer';
import { logger } from '@/utils/logger';

const DEV_WORKSPACE_API_ERROR_LABEL = 'CUSTOM_OBJECTS_API_ERROR';

export class DevWorkspaceApiService implements IDevWorkspaceApi {
  private readonly customObjectAPI: CustomObjectAPI;
  private readonly customObjectWatch: k8s.Watch;
  private stopWatch?: () => void;
  private readonly getServerConfig: () => ServerConfig;
  private readonly ks: k8s.KubeConfig;

  constructor(kc: k8s.KubeConfig) {
    this.customObjectAPI = prepareCustomObjectAPI(kc);
    this.customObjectWatch = prepareCustomObjectWatch(kc);
    this.ks = kc;

    const server = kc.getCurrentCluster()?.server || '';
    const opts = {};
    kc.applyToRequest(opts as any);
    this.getServerConfig = () => ({ opts, server });
  }

  async listInNamespace(namespace: string): Promise<api.IDevWorkspaceList> {
    try {
      const resp = await this.customObjectAPI.listNamespacedCustomObject(
        devworkspaceGroup,
        devworkspaceLatestVersion,
        namespace,
        devworkspacePlural,
      );
      return resp.body as api.IDevWorkspaceList;
    } catch (e) {
      throw createError(e, DEV_WORKSPACE_API_ERROR_LABEL, 'Unable to list devworkspaces');
    }
  }

  async getByName(namespace: string, name: string): Promise<V1alpha2DevWorkspace> {
    try {
      const resp = await this.customObjectAPI.getNamespacedCustomObject(
        devworkspaceGroup,
        devworkspaceLatestVersion,
        namespace,
        devworkspacePlural,
        name,
      );
      return resp.body as V1alpha2DevWorkspace;
    } catch (e) {
      throw createError(
        e,
        DEV_WORKSPACE_API_ERROR_LABEL,
        `Unable to get devworkspace ${namespace}/${name}`,
      );
    }
  }

  private propagateHeaders(headers: RawAxiosResponseHeaders): Partial<IncomingHttpHeaders> {
    const propagate = ['warning'];
    const filtered = Object.entries(headers).reduce((acc, [key, value]) => {
      if (propagate.includes(key)) {
        acc[key] = value as string;
      }
      return acc;
    }, {} as Partial<IncomingHttpHeaders>);
    return filtered;
  }

  async create(
    devworkspace: V1alpha2DevWorkspace,
    namespace: string,
  ): Promise<{ devWorkspace: V1alpha2DevWorkspace; headers: Partial<IncomingHttpHeaders> }> {
    try {
      if (!devworkspace.metadata?.name && !devworkspace.metadata?.generateName) {
        throw new Error(
          'Either DevWorkspace `metadata.name` or `metadata.generateName` is required.',
        );
      }

      const resp = await this.customObjectAPI.createNamespacedCustomObject(
        devworkspaceGroup,
        devworkspaceLatestVersion,
        namespace,
        devworkspacePlural,
        devworkspace,
      );
      const devWorkspace = resp.body as V1alpha2DevWorkspace;
      const headers = this.propagateHeaders(resp.response.headers);
      return { devWorkspace, headers };
    } catch (e) {
      throw createError(e, DEV_WORKSPACE_API_ERROR_LABEL, 'Unable to create devworkspace');
    }
  }

  async delete(namespace: string, name: string): Promise<void> {
    try {
      await this.customObjectAPI.deleteNamespacedCustomObject(
        devworkspaceGroup,
        devworkspaceLatestVersion,
        namespace,
        devworkspacePlural,
        name,
      );
    } catch (e) {
      throw createError(
        e,
        DEV_WORKSPACE_API_ERROR_LABEL,
        `Unable to delete devworkspace ${namespace}/${name}`,
      );
    }
  }

  /**
   * Patch a DevWorkspace
   */
  async patch(
    namespace: string,
    name: string,
    patches: api.IPatch[],
  ): Promise<{ devWorkspace: V1alpha2DevWorkspace; headers: Partial<IncomingHttpHeaders> }> {
    try {
      // const options = {
      //   headers: {
      //     'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH,
      //   },
      // };
      // console.debug('>>> options', options);

      const opts = {} as request.Options;
      this.ks.applyToRequest(opts);
      console.debug('>>> opts2', opts);

      /* request */

      const url = `${this.ks.getCurrentCluster()
        ?.server}/apis/workspace.devfile.io/v1alpha2/namespaces/${namespace}/${devworkspacePlural}`;

      /* axios */

      // const _resp = await axiosInstance.get(url, {
      //   headers: {
      //     Authorization: opts.headers?.Authorization,
      //   },
      // });
      // console.debug('>>> get _resp.data.items', _resp.data.items);
      // const resp = { data: _resp.data.items[0], headers: _resp.headers };

      const resp = await axiosInstance.patch(
        `${this.ks.getCurrentCluster()
          ?.server}/apis/workspace.devfile.io/v1alpha2/namespaces/${namespace}/${devworkspacePlural}/${name}`,
        patches,
        {
          headers: {
            Authorization: opts.headers?.Authorization,
            'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH,
          },
          responseType: 'json',
          transformRequest: (data, headers) => {
            // console.debug('>>> req data', data);
            // console.debug('>>> req headers', headers);
            return JSON.stringify(data);
            // return JSON.stringify(data);
            // return data;
            // return '[]';
            // return requestBuffer;
          },
          transformResponse: (data, headers) => {
            console.debug('>>> resp data', data);
            console.debug('>>> resp headers', headers);
            return data;
          },
        },
      );
      // console.debug('>>> resp.data', resp.data);

      /* https.request */

      // console.log('>>> Authorization: ', opts.headers?.Authorization);
      // const options = {
      //   method: 'PATCH',
      //   headers: {
      //     Authorization: opts.headers?.Authorization,
      //     'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH,
      //     'Content-Length': Buffer.byteLength(JSON.stringify(patches)),
      //   },
      //   agent: new https.Agent({
      //     ca: certificateAuthority,
      //   }),
      // };

      // const req = https.request(
      //   `${this.ks.getCurrentCluster()
      //     ?.server}/apis/workspace.devfile.io/v1alpha2/namespaces/${namespace}/${devworkspacePlural}/${name}`,
      //   options,
      //   res => {
      //     // console.debug('>>> res', res.);
      //     res.on('data', d => {
      //       console.debug('>>> res d', Buffer.from(d).toString('utf-8'));
      //     });
      //     res.on('error', e => {
      //       console.error('>>> res e', e);
      //     });
      //   },
      // );

      // req.on('error', e => {
      //   console.error('>>> req e', e);
      // });
      // req.write(JSON.stringify(patches));
      // req.end();

      /* fetch */

      // const options = {
      //   method: 'PATCH',
      //   headers: {
      //     Authorization: opts.headers?.Authorization,
      //     'Content-type': k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH,
      //     'Content-Length': Buffer.byteLength(JSON.stringify(patches)).toString(),
      //   },
      //   agent: new https.Agent({
      //     ca: certificateAuthority,
      //   }),
      // };

      // const resp1 = await fetch(
      //   `${this.ks.getCurrentCluster()
      //     ?.server}/apis/workspace.devfile.io/v1alpha2/namespaces/${namespace}/${devworkspacePlural}/${name}`,
      //   // options,
      //   {
      //     ...options,
      //     body: JSON.stringify(patches),
      //   },
      // );
      // console.debug('>>> resp1.body', resp1.body.);

      // const devWorkspace = resp.data as V1alpha2DevWorkspace;
      // const headers = this.propagateHeaders(resp.headers);
      // return { devWorkspace, headers };
      return {
        devWorkspace: {} as V1alpha2DevWorkspace,
        headers: {},
      };
    } catch (e) {
      throw createError(e, DEV_WORKSPACE_API_ERROR_LABEL, 'Unable to patch devworkspace');
    }
  }

  async patch_patch(
    namespace: string,
    name: string,
    devWorkspace: V1alpha2DevWorkspace,
  ): Promise<{ devWorkspace: V1alpha2DevWorkspace; headers: Partial<IncomingHttpHeaders> }> {
    try {
      const { server, opts } = this.getServerConfig();
      console.debug('>>> server', server);
      console.debug('>>> opts', opts);

      const opts2 = {} as request.Options;
      this.ks.applyToRequest(opts2);
      console.debug('>>> opts2', opts2);

      // console.debug(
      //   '>>> url:',
      //   `${this.ks.getCurrentCluster()?.server}/api/v1/namespaces/${namespace}/pods`,
      // );
      console.debug('>>> this.ks.getCurrentCluster()', this.ks.getCurrentCluster());
      console.debug('>>> ca.crt', opts2.ca?.toString('binary'));

      /* request */

      const url = `${this.ks.getCurrentCluster()
        ?.server}/apis/workspace.devfile.io/v1alpha2/namespaces/${namespace}/${devworkspacePlural}`;

      // const promise1 = new Promise<request.Response>((resolve, reject) => {
      //   request.get(url, opts2, (err, res, body) => {
      //     if (err) {
      //       reject(err);
      //       return;
      //     }
      //     resolve(res);
      //   });
      // });
      // const resp = await promise1;

      /* axios */

      const _resp = await axiosInstance.get(url, {
        headers: {
          Authorization: opts2.headers?.Authorization,
        },
      });
      console.debug('>>> resp.data.items', _resp.data.items);

      const resp = await axiosInstance.patch(
        `${this.ks.getCurrentCluster()
          ?.server}/apis/workspace.devfile.io/v1alpha2/namespaces/${namespace}/${devworkspacePlural}/${name}`,
        devWorkspace,
        {
          headers: {
            Authorization: opts2.headers?.Authorization,
          },
        },
      );

      /* fetch */
      // const agent = new Agent({
      //   connect: {
      //     ca: opts2.ca,
      //   },
      // });
      // const resp = await fetch(
      //   `${this.ks.getCurrentCluster()?.server}/api/v1/namespaces/${namespace}/pods`,
      //   {
      //     dispatcher: agent,
      //     headers: {
      //       Authorization: `Bearer ${opts2.headers?.Authorization}`,
      //     },
      //     method: 'patch',
      //     body: JSON.stringify(devWorkspace),
      //   } as any,
      // );

      const _devWorkspace = (resp as any).body as V1alpha2DevWorkspace;
      console.debug('>>> devWorkspace', _devWorkspace);
      return { devWorkspace: _devWorkspace, headers: {} };
    } catch (e) {
      // todo
      console.error('>>> e', e);
      throw createError(e, DEV_WORKSPACE_API_ERROR_LABEL, 'Unable to patch devworkspace');
    }
  }

  async patch_depr_warn(
    namespace: string,
    name: string,
    devWorkspace: V1alpha2DevWorkspace,
  ): Promise<{ devWorkspace: V1alpha2DevWorkspace; headers: Partial<IncomingHttpHeaders> }> {
    try {
      const { server, opts } = this.getServerConfig();
      console.debug('>>> server', server);
      console.debug('>>> opts', opts);

      const opts2 = {} as request.Options;
      this.ks.applyToRequest(opts2);
      console.debug('>>> opts2', opts2);

      if (
        devWorkspace.metadata?.name === undefined ||
        devWorkspace.metadata?.namespace === undefined
      ) {
        throw new Error('Either DevWorkspace `metadata.name` or `metadata.namespace` is required.');
      }

      const tt = k8s.KubernetesObjectApi.makeApiClient(this.ks);
      const resp = await tt.read(
        {
          kind: 'DevWorkspace',
          metadata: {
            name,
            namespace,
          },
          apiVersion: 'workspace.devfile.io/v1alpha2',
        },
        // devWorkspace,
        undefined,
        undefined,
        undefined,
        opts2 as any,
      );
      // const resource = {...resourceResponse.body as V1alpha2DevWorkspace, patches[0].};

      // const patchResponse = await tt.patch(

      // const resp2 = await tt.patch({},undefined,undefined,undefined,undefined,)
      // console.debug('>>> resp2.body', resp2.body);
      // const tt = new k8s.CustomObjectsApi(path);
      // const resp2 = await tt.patchNamespacedCustomObject(
      //   devworkspaceGroup,
      //   devworkspaceLatestVersion,
      //   namespace,
      //   devworkspacePlural,
      //   name,
      //   [],
      //   undefined,
      //   undefined,
      //   undefined,
      //   opts2 as any,
      // );
      // const resp2 = await tt.getNamespacedCustomObject(
      //   devworkspaceGroup,
      //   devworkspaceLatestVersion,
      //   namespace,
      //   devworkspacePlural,
      //   name,
      //   opts2 as any,
      // );

      const _devWorkspace = resp.body as V1alpha2DevWorkspace;
      console.debug('>>> devWorkspace', _devWorkspace);
      return {
        devWorkspace: _devWorkspace,
        headers: {},
      };
    } catch (e) {
      // todo
      console.error('>>> e', e);
      throw createError(e, DEV_WORKSPACE_API_ERROR_LABEL, 'Unable to patch devworkspace');
    }
  }

  async watchInNamespace(
    listener: MessageListener,
    params: api.webSocket.SubscribeParams,
  ): Promise<void> {
    const path = `/apis/${devworkspaceGroup}/${devworkspaceLatestVersion}/watch/namespaces/${params.namespace}/${devworkspacePlural}`;
    const queryParams = { watch: true, resourceVersion: params.resourceVersion };

    this.stopWatching();

    const request: http.ServerResponse = await this.customObjectWatch.watch(
      path,
      queryParams,
      (eventPhase: string, apiObj: V1alpha2DevWorkspace | V1Status) => {
        switch (eventPhase) {
          case api.webSocket.EventPhase.ADDED:
          case api.webSocket.EventPhase.MODIFIED:
          case api.webSocket.EventPhase.DELETED: {
            const devWorkspace = apiObj as V1alpha2DevWorkspace;
            listener({ eventPhase, devWorkspace });
            break;
          }
          case api.webSocket.EventPhase.ERROR: {
            const status = apiObj as V1Status;
            listener({ eventPhase, status, params });
            break;
          }
        }
      },
      (error: unknown) => {
        logger.warn(error, `Stopped watching ${path}.`);
        request.destroy();
      },
    );

    this.stopWatch = () => request.destroy();
  }

  /**
   * Stop watching DevWorkspaces.
   */
  public stopWatching(): void {
    this.stopWatch?.();
    this.stopWatch = undefined;
  }
}
