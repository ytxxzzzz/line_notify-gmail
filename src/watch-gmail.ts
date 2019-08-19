
import {google, gmail_v1, cloudkms_v1} from 'googleapis'
import {KeyManagementServiceClient} from '@google-cloud/kms';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as readline from 'readline';
import {promisify} from 'util';
import { MethodOptions } from 'googleapis-common';
import * as dotenv from 'dotenv';
import {encryptByKms, authGmail} from './index';

dotenv.config();

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_PATH = 'token.json';
const CREDENTIAL_PATH = 'client_id.json';

export async function watchGmail(): Promise<gmail_v1.Schema$WatchResponse> {
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
          console.info(`- ${label.name}`);
        });
      } else {
        console.info('No labels found.');
      }
    });
  }

/*
(async ()=> {
  const res = await watchGmail();
  console.info(`historyId=${res.historyId}`);
})();
*/