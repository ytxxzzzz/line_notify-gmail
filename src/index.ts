
import {google} from 'googleapis'
import * as fs from 'fs';
import * as readline from 'readline';

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly'
const TOKEN_PATH = 'token.json';

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

    fs.readFile('client_id.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Gmail API.
        authorize(JSON.parse(content.toString()), listLabels);
    })

/*
    console.log(process.env);
    const client = new google.auth.OAuth2(process.env.gmail_client_id, process.env.gmail_client_secret);

    const gmail = google.gmail({version: "v1", auth: client});
    const response = await gmail.users.labels.list({userId: "me"});
    console.log(client);
    console.log("aaaaaaa");
*/
}

function authorize(credentials: any, callback: Function) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token.toString()));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client: any, callback: Function) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.openStdin(),
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err: any, token: any) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function listLabels(auth: any) {
    const gmail = google.gmail({version: 'v1', auth});
    gmail.users.labels.list({
      userId: 'me',
    }, (err, res) => {
      if (err || !res || !res.data.labels) {
        return console.log('The API returned an error: ' + err);
      } 
      const labels = res.data.labels;
      if (labels.length) {
        console.log('Labels:');
        labels.forEach((label) => {
          console.log(`- ${label.name}`);
        });
      } else {
        console.log('No labels found.');
      }
    });
  }

const testMessage = {
    "@type":"type.googleapis.com/google.pubsub.v1.PubsubMessage",
    "attributes":null,
    "data":"eyJlbWFpbEFkZHJlc3MiOiJmcmVzaC5icmFzaC5zYXJhcmlpbWFuQGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6MjAyODAzN30="
}

helloPubSub(testMessage, null);
