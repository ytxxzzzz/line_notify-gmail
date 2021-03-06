
import {google, gmail_v1, cloudkms_v1} from 'googleapis'
import {KeyManagementServiceClient} from '@google-cloud/kms';
import { OAuth2Client, Credentials } from 'google-auth-library';
import * as fs from 'fs';
import * as readline from 'readline';
import {promisify} from 'util';
import { MethodOptions } from 'googleapis-common';
import * as dotenv from 'dotenv';
import {encryptByKms} from './index';

dotenv.config();

const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_PATH = 'token.json';
const CREDENTIAL_PATH = 'client_id.json';

async function outputEncryptedCredential(credentialFilePath: string) {
  const credentialContents = await promisify(fs.readFile)(credentialFilePath);
  const encryptedCredential = await encryptByKms(credentialContents.toString());
  console.log(`KMS暗号化済みクレデンシャル：${encryptedCredential}`);
}

async function outputTokenFromCredentialFileWithOAuthLogin(credentialFilePath: string) {
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
  rl.question('↑に表示されたURLにアクセスして、GMail読み取り権限を付与したいGoogleアカウントを承認し、' +
              '結果出力されたコードをここに入力してください: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, async (err, token: Credentials) => {
      if (err) {
        return console.error('Error retrieving access token', err);
      }
      oAuth2Client.setCredentials(token);
      const encryptedToken = await encryptByKms(JSON.stringify(token));
      console.log(`KMS暗号化済みトークン: ${encryptedToken}`);
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

/////////////////////////// main処理 //////////////////////////////////
// クレデンシャルファイルとトークンをKMSで暗号化してBASE64エンコードした文字列を画面に出力する
// トークン発行の際には、OAuth認証を行うため、ブラウザでGmailアクセスを許可したいアカウントで認証
// を行う必要がある。プロンプトの指示通りやれば大丈夫なように作っているつもり
const credentialPath = "client_id.json";
(async () => {
  console.log('******************************************************************************************************')
  await outputEncryptedCredential(credentialPath);
  console.log('******************************************************************************************************')
  await outputTokenFromCredentialFileWithOAuthLogin(credentialPath);
  console.log('******************************************************************************************************')
})();
///////////////////////////////////////////////////////////////////////
