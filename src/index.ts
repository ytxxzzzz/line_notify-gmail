
import {google, gmail_v1, cloudkms_v1} from 'googleapis'
import {KeyManagementServiceClient} from '@google-cloud/kms';
import {Storage} from '@google-cloud/storage';
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


// GCSでhistoryIdの読み書きを行う
class HistoryIdStorage {
  private bucket: string;
  private fileKey: string;

  constructor() {
    this.bucket = process.env.history_id_bucket!;
    this.fileKey = process.env.history_id_filekey!;
  }

  public save(historyId: string) {
    saveToStorage(this.bucket, this.fileKey, new Buffer(historyId!, "ascii"));
  }
  public read() {
    return readFromStorage(this.bucket, this.fileKey).toString();
  }
}

const historyIdStorage = new HistoryIdStorage();

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
//  console.info("encrypted base64 string:");
//  console.info(encryptedBase64);
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
//  console.info("decrypted plaintext:");
//  console.info(decrypted);
  return decrypted;
}

export async function authGmail() {
  const {credentialObj, tokenObj} = await getAuthObj();
  const oAuth2Client = getOAuth2ClientFromCredentialObj(credentialObj);
  oAuth2Client.setCredentials(tokenObj);
  return oAuth2Client;
}
//////////////////////// Cloud Functions エントリポイント関数 ////////////////////////////////////
/**
 * GmailWatchAPI実行用のCloudFunctionsイベントハンドラ
 * １週間に１回程度実行する必要があるらしい。そうしないとメール監視がストップするみたい。
 * CloudSchedulerからPubSub経由で実行される想定
 *
 * @param {!Object} event Pub/Sub Event payload.
 * @param {!Object} context Metadata for the event.
 */
export async function watchGmailHandler(event: any, context: any) {
  // gmail認証
  const client = await authGmail();
  // ラベル名とラベルIDをログ出力→Watch対象のラベル指定にはラベルに対応するIDを知る必要があるので
  listLabels(client);
  // gmailのwatch
  const res = await watchGmail();
  console.info(`gmail watch result: historyId=${res.historyId}, expiration=${res.expiration}`);
  if(res.historyId) {
    historyIdStorage.save(res.historyId!);
  } else {
    throw new Error("GmailのwatchAPIを実行したのにhistoryIdが取得できなかった");
  }
}

/**
 * Gmail通知用のCloudFunctionsイベントハンドラ
 * これはGmailWatchからのPubSub通知で起動される想定
 *
 * @param {!Object} event Pub/Sub Event payload.
 * @param {!Object} context Metadata for the event.
 */
export async function notifyGmailHandler(event: any, context: any) {
  console.info(`event=${JSON.stringify(event)}`);
  const pubsubMsgBase64 = event.data;
  const pubsubMsg = Buffer.from(pubsubMsgBase64, 'base64').toString();
  console.info(`pubsubMsg=${pubsubMsg}`);
  const pubsubMsgObj = JSON.parse(pubsubMsg);

  // GCSに保存した、前回動作時の最新historyIdを取得する
  const previousHistoryId = (await readFromStorage(process.env.history_id_bucket!, process.env.history_id_filekey!)).toString();

  // gmail認証
  const client = await authGmail();
  // ラベル名とラベルIDをログ出力→Watch対象のラベル指定にはラベルに対応するIDを知る必要があるので
  listLabels(client);
  const snippets = await getMail(client, previousHistoryId, pubsubMsgObj.historyId);
  snippets.map(snippet=>console.info(`スニペット＝${snippet}`));

  historyIdStorage.save(pubsubMsgObj.historyId);
  console.info(`historyIdが新しくなったので保存した。historyId:"${previousHistoryId}" -> "${pubsubMsgObj.historyId}"`);
}
////////////////////////////////////////////////////////////////////////////////////////////////

async function getAuthObj(): Promise<{credentialObj: any, tokenObj: any}> {
  const encryptedBase64Credential = process.env.gmail_credential_encrypted_base64!;
  const encryptedBase64Token = process.env.gmail_token_encrypted_base64!;

  const credentialJsonString = await decryptByKms(encryptedBase64Credential);
  const tokenJsonString = await decryptByKms(encryptedBase64Token);

  return {
    credentialObj: JSON.parse(credentialJsonString), 
    tokenObj: JSON.parse(tokenJsonString)
  };
}

/**
 * CredentialのJson文字列からOAuth2Clientオブジェクトを取得する
 * @param credentialJsonString CredentialのJson文字列
 */
function getOAuth2ClientFromCredentialObj(credentialObj: any) {
  const {client_secret, client_id, redirect_uris} = credentialObj.installed;
  return new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );
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

async function getMail(auth: OAuth2Client, previousHistoryId: string, newestHistoryId: string) {
  const gmail = google.gmail({version: 'v1', auth});
  
  const FIRST_PAGE_TOKEN = "first_dummy_token";
  let pageToken: string | undefined = FIRST_PAGE_TOKEN;
  let histories: gmail_v1.Schema$History[] = [];
  let lastHistoryId: string | undefined;
  // listAPIは１回で全取得できない場合、nextPageTokenにトークン返ってくる仕様なので繰り返し搾り取る
  // listAPIの仕様は以下参照のこと
  // https://developers.google.com/gmail/api/v1/reference/users/history/list?apix_params=%7B%22userId%22%3A%22me%22%2C%22startHistoryId%22%3A4723%7D
  while(pageToken) {
    const historyListRequest: gmail_v1.Params$Resource$Users$History$List = {
      userId: "me",
      historyTypes: ["messageAdded"],
      labelId: process.env.gmail_watch_label!,
      startHistoryId: previousHistoryId,
      pageToken: (pageToken===FIRST_PAGE_TOKEN)?undefined:pageToken,
    };
    const historyResponse = await gmail.users.history.list(historyListRequest);
    const historiesPart = historyResponse.data.history ? historyResponse.data.history : [];
    histories = histories.concat(historiesPart);
    pageToken = historyResponse.data.nextPageToken;
    lastHistoryId = historyResponse.data.historyId;
  }
  const messages = histories.map(history=>history.messages?history.messages:[]).reduce((a,b)=>a.concat(b));
  const messageIds = messages.map(message=>message.id);
  console.info(`messageIds=[${messageIds.join(",")}]`);

  const snippets = await Promise.all(messageIds.map(async id=>{
    const message = await gmail.users.messages.get({id, userId: "me"});
    console.info(`snippet=${message.data.snippet}`);
    console.info(`response=${JSON.stringify(message.data, null, " ")}`);
    return message.data.snippet;
  }));

  return snippets;
}

async function watchGmail(): Promise<gmail_v1.Schema$WatchResponse> {
  // gmail認証
  const client = await authGmail();

  // ラベル名とラベルIDをログ出力→Watch対象のラベル指定にはラベルに対応するIDを知る必要があるので
  listLabels(client);

  const gmail = google.gmail({version: 'v1', auth: client});

  const request: gmail_v1.Schema$WatchRequest = {
    labelIds: [process.env.gmail_watch_label!],
    topicName: process.env.gmail_watch_pubsub_topic!,
  };
  const response = await gmail.users.watch({userId: "me", requestBody: request});
  return response.data;
}

// Gmailのラベルを全てログ出力する
function listLabels(auth: OAuth2Client) {
  const gmail = google.gmail({version: 'v1', auth});
  gmail.users.labels.list({
    userId: 'me',
  }, (err, res) => {
    if (err || !res || !res.data.labels) {
      return console.info('The API returned an error: ' + err);
    } 
    const labels = res.data.labels;
    if (labels.length) {
      console.info('Labels:');
      labels.forEach((label) => {
        console.info(`- name="${label.name}", id="${label.id}"`);
      });
    } else {
      console.info('No labels found.');
    }
  });
}

const storage = new Storage();

// GCSへファイルを保存する
function saveToStorage(bucketName: string, fileKey: string, data: Buffer) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileKey);
  file.save(data);
}

async function readFromStorage(bucketName: string, fileKey: string) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileKey);
  const buffer = await file.download();
  return buffer;
}

////////////// notify gmail test code /////////////////
/*
const testMessage = {
    "@type":"type.googleapis.com/google.pubsub.v1.PubsubMessage",
    "attributes":null,
    "data":process.env.test_pubsub_msg_base64
};

notifyGmailHandler(testMessage, null);
*/
////////////// watch gmail test code /////////////////
/*
(async ()=> {
  const res = await watchGmailHandler({}, {});
})();
*/
///////////////////////////////////////////////////////
