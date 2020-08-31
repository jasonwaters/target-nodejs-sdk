/* eslint-disable import/prefer-default-export */
/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import {
  DECISIONING_ENGINE_NOT_READY,
  decisioningEngineReady,
  DECISIONING_METHOD,
  getFetchWithRetry,
  getProperty,
  isDefined,
  requiresDecisioningEngine
} from "@adobe/target-tools";
import { Messages } from "./messages";
import {
  createConfiguration,
  createDeliveryApi,
  createDeliveryRequest,
  createHeaders,
  getCluster,
  getDeviceId,
  getSessionId,
  getTargetHost,
  processResponse
} from "./helper";
import { parseCookies } from "./cookies";

export function executeDelivery(options, decisioningEngine) {
  const {
    visitor,
    config,
    logger,
    targetCookie,
    consumerId,
    request,
    useBeacon,
    createDeliveryApiMethod = createDeliveryApi
  } = options;

  const property = getProperty(config, request, logger);
  if (isDefined(property)) {
    request.property = property;
  }

  const { serverDomain, client, timeout, secure, environmentId } = config;

  let { decisioningMethod } = config;

  const fetchWithRetry = getFetchWithRetry(config.fetchApi);

  const targetLocationHint =
    options.targetLocationHint || config.targetLocationHint;

  if (
    requiresDecisioningEngine(decisioningMethod) &&
    !decisioningEngineReady(decisioningEngine)
  ) {
    // fulfill the request remotely if hybrid execution mode and decisioning engine is unavailable
    if (decisioningMethod === DECISIONING_METHOD.HYBRID) {
      decisioningMethod = DECISIONING_METHOD.SERVER_SIDE;
    } else {
      return Promise.reject(new Error(DECISIONING_ENGINE_NOT_READY));
    }
  }

  const cookies = parseCookies(targetCookie);
  const deviceId = getDeviceId(cookies);
  const cluster = getCluster(deviceId, targetLocationHint);
  const host = getTargetHost(serverDomain, cluster, client, secure);
  const sessionId = getSessionId(cookies, options.sessionId);
  const headers = createHeaders();

  const requestOptions = {
    logger,
    visitor,
    deviceId,
    consumerId,
    environmentId
  };

  const deliveryRequest = createDeliveryRequest(request, requestOptions);

  const configuration = createConfiguration(
    fetchWithRetry,
    host,
    headers,
    timeout
  );

  const deliveryMethod = createDeliveryApiMethod(
    configuration,
    visitor,
    useBeacon,
    decisioningMethod,
    targetLocationHint,
    deliveryRequest,
    decisioningEngine
  );

  logger.debug(
    Messages.REQUEST_SENT,
    deliveryMethod.decisioningMethod,
    JSON.stringify(deliveryRequest, null, 2)
  );

  return deliveryMethod
    .execute(client, sessionId, deliveryRequest, config.version)
    .then((response = {}) => {
      logger.debug(
        Messages.RESPONSE_RECEIVED,
        JSON.stringify(response, null, 2)
      );
      return Object.assign(
        { visitorState: visitor.getState(), request: deliveryRequest },
        processResponse(
          sessionId,
          cluster,
          deliveryRequest,
          response,
          deliveryMethod.decisioningMethod,
          decisioningEngine
        )
      );
    });
}
