
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
/**
 * gcpのKMSで暗号化する
 * @param  {string} data 暗号化対象の文字列→バイナリの場合BASE64とかで文字列にして利用してくださいな
 * @return {string} KMSで暗号化されBASE64エンコーディングされた文字列
 */
export async function encryptByKms(data: string) {
  const [client, name] = getKmsClientAndKeyName();
  const [result] = await client.encrypt({name, plaintext: Buffer.from(data).toString('base64')});
  const encryptedBase64 = result.ciphertext.toString('base64');
//  console.log("encrypted base64 string:");
//  console.log(encryptedBase64);
  return encryptedBase64;
}
/**
 * gcpのKMSで復号する
 * @param  {string} encryptedBase64 KMS暗号化してBASE64エンコードされた文字列
 * @return {string} 復号された文字列
 */
export async function decryptByKms(encryptedBase64: string) {
  const [client, name] = getKmsClientAndKeyName();
  const [result] = await client.decrypt({name, ciphertext: encryptedBase64});
  const decrypted = result.plaintext.toString();
//  console.log("decrypted plaintext:");
//  console.log(decrypted);
  return decrypted;
}
/**
 * KMSのクライアントと利用する鍵の名前を取得する。
 * 名前の各情報は、環境変数に格納されているので、設定が必要
 * @returns {[KeyManagementServiceClient, string]} クライアントと鍵の名前
 */
function getKmsClientAndKeyName(): [KeyManagementServiceClient, string] {
  const client = new KeyManagementServiceClient();
  const name = client.cryptoKeyPath(
    process.env.gcp_project!,
    process.env.gcp_location!,
    process.env.gcp_kms_key_ring!,
    process.env.gcp_kms_key!,
  );
  return [client, name];
}
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
  const pubsubMsgObj = JSON.parse(pubsubMsg);

  const encryptedBase64Credential = process.env.gmail_credential_encrypted_base64!;
  const encryptedBase64Token = process.env.gmail_token_encrypted_base64!;

  const credentialJsonString = await decryptByKms(encryptedBase64Credential);
  const tokenJsonString = await decryptByKms(encryptedBase64Token);

  console.log('******************************************************************************************************')
  console.log(`credential=${credentialJsonString}`);
  console.log('******************************************************************************************************')
  console.log(`token=${tokenJsonString}`);
  console.log('******************************************************************************************************')

  // gmail認証
  const client = authGmail(credentialJsonString, tokenJsonString);
  listLabels(client);
  await getMail(client, pubsubMsgObj.historyId);
}
////////////////////////////////////////////////////////////////////////////////////////////////

function authGmail(credentialJsonString: string, tokenJsonString: string) {
  const oAuth2Client = getOAuth2ClientFromCredentialFile(credentialJsonString);
  oAuth2Client.setCredentials(JSON.parse(tokenJsonString));
  return oAuth2Client;
}

/**
 * CredentialのJson文字列からOAuth2Clientオブジェクトを取得する
 * @param credentialJsonString CredentialのJson文字列
 */
function getOAuth2ClientFromCredentialFile(credentialJsonString: string) {
  const credentials = JSON.parse(credentialJsonString);

  const {client_secret, client_id, redirect_uris} = credentials.installed;
  return new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );
}

async function getMail(auth: OAuth2Client, historyId: string) {
  const gmail = google.gmail({version: 'v1', auth});
  const historyResponse = await gmail.users.history.list({userId: "me", startHistoryId: historyId});
  const histories = historyResponse.data.history?historyResponse.data.history:[];
  const messages = histories.map(history=>history.messages?history.messages:[]).reduce((a,b)=>a.concat(b));
  console.log(messages);
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
    "data":process.env.test_pubsub_msg_base64
};

helloPubSub(testMessage, null);

