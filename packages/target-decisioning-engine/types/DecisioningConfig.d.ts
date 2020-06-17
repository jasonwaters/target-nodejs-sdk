import { DecisioningArtifact } from "./DecisioningArtifact";

export interface DecisioningConfig {
  /**
   * Target Client Id
   */
  client: String;

  /**
   * Target Organization Id
   */
  organizationId: String;

  /**
   * Polling interval in ms, default: 30000
   */
  pollingInterval?: Number;

  /**
   * Fully qualified url to the location of the artifact
   */
  artifactLocation?: String;

  /**
   * A pre-fetched artifact
   */
  artifactPayload?: DecisioningArtifact;

  /**
   * A property token used to limit the scope of evaluated target activities
   */
  propertyToken?: String;

  /**
   * The target environment name (production, staging, development). Defaults to production.
   */
  environment?: String;

  /**
   * The CDN environment name (production, staging, development).  Defaults to production.
   */
  cdnEnvironment?: String;

  /**
   * Replaces the default noop logger
   */
  logger?: Object;

  /**
   * Fetch Implementation
   */
  fetchApi?: Function;

  /**
   * Function used to send notifications
   */
  sendNotificationFunc?: Function;
}