import Messages from "./messages";
import {
  DEFAULT_POLLING_INTERVAL,
  MINIMUM_POLLING_INTERVAL,
  NUM_FETCH_RETRIES
} from "./constants";

function fetchWithRetry(url, options, numRetries) {
  return fetch(url, options)
    .then(res => {
      if (!res.ok) {
        throw Error(res.statusText);
      }
      return res;
    })
    .catch(err => {
      if (numRetries < 1) {
        throw err;
      }
      return fetchWithRetry(url, options, numRetries - 1);
    });
}

function determineArtifactLocation(clientId, organizationId) {
  return `${clientId}__${organizationId}`;
}

function fetchArtifact(artifactUrl) {
  return fetchWithRetry(artifactUrl, undefined, NUM_FETCH_RETRIES).then(res =>
    res.json()
  );
}

function getPollingInterval(config) {
  return Math.max(
    MINIMUM_POLLING_INTERVAL,
    typeof config.pollingInterval === "number"
      ? config.pollingInterval
      : DEFAULT_POLLING_INTERVAL
  );
}

/**
 * The ArtifactProvider initialize method
 * @param {Object} config Options map, required
 * @param {String} config.client Target Client Id, required
 * @param {String} config.organizationId Target Organization Id, required
 * @param {Number} config.pollingInterval Polling interval in ms, optional, default: 30000
 * @param {String} config.artifactLocation Fully qualified url to the location of the artifact, optional
 * @param {String} config.artifactPayload A pre-fetched artifact, optional
 * @param {Object} config.logger Replaces the default noop logger, optional
 */
async function initialize(config) {
  const pollingInterval = getPollingInterval(config);
  const { logger } = config;
  let pollingHalted = false;
  let pollingTimer;

  let artifact;

  const subscriptions = {};
  let subscriptionCount = 0;

  function addSubscription(callbackFunc) {
    subscriptionCount += 1;
    subscriptions[subscriptionCount] = callbackFunc;
    return subscriptionCount;
  }

  function removeSubscription(id) {
    delete subscriptions[id];
  }

  function removeAllSubscriptions() {
    const ids = Object.keys(subscriptions);
    ids.forEach(id => removeSubscription(id));
  }

  function emit(data) {
    Object.values(subscriptions).forEach(subscriptionFunc =>
      subscriptionFunc(data)
    );
  }

  const artifactLocation =
    typeof config.artifactLocation === "string"
      ? config.artifactLocation
      : determineArtifactLocation(config.client, config.organizationId);

  function scheduleNextUpdate() {
    if (pollingInterval === 0 || pollingHalted) {
      return;
    }

    pollingTimer = setTimeout(async () => {
      try {
        artifact = await fetchArtifact(artifactLocation);
        emit(artifact);
      } catch (err) {
        logger.error(`Error fetching artifact: ${err.toString()}`);
      }
      scheduleNextUpdate();
    }, pollingInterval);
  }

  function stopAllPolling() {
    if (typeof pollingTimer !== "undefined") {
      clearTimeout(pollingTimer);
      pollingTimer = undefined;
    }
    pollingHalted = true;
  }

  function resumePolling() {
    pollingHalted = false;
    scheduleNextUpdate();
  }

  if (typeof config.artifactPayload === "object") {
    artifact = config.artifactPayload;
  } else {
    try {
      artifact = await fetchArtifact(artifactLocation);
    } catch (err) {
      logger.error(Messages.ERROR_MAX_RETRY(NUM_FETCH_RETRIES, err.toString()));
    }
    scheduleNextUpdate();
  }

  return Promise.resolve({
    getArtifact: () => artifact,
    subscribe: callbackFunc => addSubscription(callbackFunc),
    unsubscribe: id => removeSubscription(id),
    stopPolling: () => stopAllPolling(),
    resumePolling: () => resumePolling()
  });
}

const ArtifactProvider = {
  initialize
};

export default ArtifactProvider;
