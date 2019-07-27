
import {google} from 'googleapis'

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
export async function helloPubSub(event: any, context: any) {
    console.log(`event=${JSON.stringify(event)}`);
    const pubsubMessage = event.data;
    console.log(`pubsubMsg=${Buffer.from(pubsubMessage, 'base64').toString()}`);

    console.log(process.env);
    const client = new google.auth.OAuth2(process.env.gmail_client_id, process.env.gmail_client_secret);

    const gmail = google.gmail({version: "v1", auth: client});
    const response = await gmail.users.labels.list({userId: "me"});
    console.log(client);
    console.log("aaaaaaa");
}

const testMessage = {
    "@type":"type.googleapis.com/google.pubsub.v1.PubsubMessage",
    "attributes":null,
    "data":"eyJlbWFpbEFkZHJlc3MiOiJmcmVzaC5icmFzaC5zYXJhcmlpbWFuQGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6MjAyODAzN30="
}

helloPubSub(testMessage, null);
