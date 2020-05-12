/* eslint-disable import/prefer-default-export */
import jsonLogic from "json-logic-js";
import { isUndefined } from "@adobe/target-tools";
import { createMboxContext, createPageContext } from "./contextProvider";
import { computeAllocation } from "./allocationProvider";
import { cloneDeep } from "./utils";

/**
 *
 * @param { String } clientId
 * @param { import("@adobe/target-tools/delivery-api-client/models/VisitorId").VisitorId } visitorId
 * @return { Function }
 */
export function ruleEvaluator(clientId, visitorId) {
  /**
   * @param {import("../types/DecisioningArtifact").Rule} rule
   * @param { Object } context
   * @param { 'mbox'|'view'|'pageLoad' } requestType
   * @param {import("@adobe/target-tools/delivery-api-client/models/MboxRequest").MboxRequest|import("@adobe/target-tools/delivery-api-client/models/RequestDetails").RequestDetails} requestDetail
   * @param { Array<Function> } postProcessors
   * @param tracer
   */
  return function processRule(
    rule,
    context,
    requestType,
    requestDetail,
    postProcessors,
    tracer
  ) {
    let consequence;
    let { page, referring } = context;

    if (!isUndefined(requestDetail.address)) {
      page = createPageContext(requestDetail.address) || page;
      referring = createPageContext(requestDetail.address) || referring;
    }

    const ruleContext = {
      ...context,
      page,
      referring,
      mbox: createMboxContext(requestDetail),
      allocation: computeAllocation(clientId, rule.meta.activityId, visitorId)
    };

    const ruleSatisfied = jsonLogic.apply(rule.condition, ruleContext);
    tracer.traceRuleEvaluated(
      rule,
      requestDetail,
      requestType,
      ruleContext,
      ruleSatisfied
    );

    if (ruleSatisfied) {
      consequence = {
        ...rule.consequence,
        index: requestDetail.index
      };

      postProcessors.forEach(postProcessFunc => {
        consequence = postProcessFunc(rule, consequence, requestType, tracer);
      });
    }
    return cloneDeep(consequence); // we return a new object because at.js has a tendency to mutate reponses and we don't want it to mutate the rule consequence itself
  };
}