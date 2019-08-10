
import {google, gmail_v1, cloudkms_v1} from 'googleapis'
import {KeyManagementServiceClient} from '@google-cloud/kms';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as readline from 'readline';
import {promisify} from 'util';
import { MethodOptions } from 'googleapis-common';
import * as dotenv from 'dotenv';

dotenv.config();

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_PATH = 'token.json';
const CREDENTIAL_PATH = 'client_id.json';

///////////////////////////////////////// 公開関数 ////////////////////////////////////////////////////
export async function encryptByKms(data: string) {
  const client = new KeyManagementServiceClient();
  const name = client.cryptoKeyPath(
    process.env.gcp_project!,
    process.env.gcp_location!,
    process.env.gcp_kms_key_ring!,
    process.env.gcp_kms_key!
  );
  const [result] = await client.encrypt({name, plaintext: Buffer.from(data).toString('base64')});
  const encryptedBase64 = result.ciphertext.toString('base64');
//  console.log("encrypted base64 string:");
//  console.log(encryptedBase64);
  return encryptedBase64;
}

export async function decryptByKms(encryptedBase64: string) {
  const client = new KeyManagementServiceClient();
  const name = client.cryptoKeyPath(
    process.env.gcp_project!,
    process.env.gcp_location!,
    "line-notify",
    "gmail-line-notify"
  );
  const [result] = await client.decrypt({name, ciphertext: encryptedBase64});
  const decrypted = result.plaintext.toString();
//  console.log("decrypted plaintext:");
//  console.log(decrypted);
  return decrypted;
}
////////////////////////////////////////////////////////////////////////////////////////////////

//////////////////////// Cloud Functions エントリポイント関数 ////////////////////////////////////
/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event Event payload.
 * @param {!Object} context Metadata for the event.
 */
export async function helloPubSub(event: any, context: any) {
    console.log(`event=${JSON.stringify(event)}`);
    const pubsubMsgBase64 = event.data;
    const pubsubMsg = Buffer.from(pubsubMsgBase64, 'base64').toString();
    console.log(`pubsubMsg=${pubsubMsg}`);

}
////////////////////////////////////////////////////////////////////////////////////////////////

export async function listLabelsWithLogin(credentialFilePath: string, tokenFilePath: string) {
  const oAuth2Client = await getOAuth2ClientFromCredentialFile(credentialFilePath);
  const token = await promisify(fs.readFile)(tokenFilePath);
  oAuth2Client.setCredentials(JSON.parse(token.toString()));
  listLabels(oAuth2Client);
}

export async function saveTokenFileWithCredentialFile(credentialFilePath: string, tokenFilePath: string) {
  const oAuth2Client = await getOAuth2ClientFromCredentialFile(credentialFilePath);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err: any, token: any) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(tokenFilePath, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', tokenFilePath);
      });
    });
  });
}

async function getOAuth2ClientFromCredentialFile(credentialFilePath: string) {
  const credentialContent = await promisify(fs.readFile)(credentialFilePath);
  const credentials = JSON.parse(credentialContent.toString());

  const {client_secret, client_id, redirect_uris} = credentials.installed;
  return new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );
}

function listLabels(auth: OAuth2Client) {
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



// クライアントIDのファイルを使ってログイン用のトークンを取得してファイル保存する
// saveTokenFileWithCredentialFile(CREDENTIAL_PATH, TOKEN_PATH);

// トークンを取得してファイル保存済みの状態で、Gmailログインしてラベルの一覧を表示する
//listLabelsWithLogin(CREDENTIAL_PATH, TOKEN_PATH);
async function aaa() {
  const encryptedBase64 = await encryptByKms("azzzzzzzzzzzz");
  decryptByKms(encryptedBase64);
};

aaa();
