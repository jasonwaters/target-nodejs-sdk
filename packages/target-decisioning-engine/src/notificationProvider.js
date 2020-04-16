import { noop, createUUID } from "@adobe/target-tools";

/**
 * The get NotificationProvider initialize method
 * @param {import("@adobe/target-tools/delivery-api-client/models/DeliveryRequest").DeliveryRequest} request Target View Delivery API request, required
 * @param {function} sendNotificationFunc function used to send the notification, required
 */

function NotificationProvider(request, sendNotificationFunc = noop) {
  const now = new Date();
  const timestamp = now.getTime();
  let notifications = [];

  /**
   * The get NotificationProvider initialize method
   * @param {import("@adobe/target-tools/delivery-api-client/models/MboxResponse").MboxResponse} mbox
   * @param { Function } traceFn
   */
  function addNotification(mbox, traceFn = noop) {
    const notification = {
      id: createUUID(),
      impressionId: createUUID(),
      timestamp,
      type: "display",
      mbox: {
        name: mbox.name
      },
      tokens: []
    };

    mbox.metrics.forEach(metric => {
      notification.tokens.push(metric.eventToken);
    });

    if (typeof traceFn === "function") {
      traceFn(notification);
    }

    notifications.push(notification);
  }

  function sendNotifications() {
    if (notifications.length > 0) {
      const { id, context, experienceCloud } = request;

      sendNotificationFunc({
        request: {
          id,
          context,
          experienceCloud,
          notifications
        }
      });
      notifications = [];
    }
  }

  return {
    addNotification,
    sendNotifications
  };
}

export default NotificationProvider;
