/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
export function helloPubSub(event: any, context: any) {
    console.log(`event=${JSON.stringify(event)}`);
    const pubsubMessage = event.data;
    console.log(`pubsubMsg=${Buffer.from(pubsubMessage, 'base64').toString()}`);
}
