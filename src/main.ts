import { Client, Databases } from 'node-appwrite';

import * as process from './env.js';

function log(text: string) {
  console.log(text);
}
function error(text: string) {
  console.error(text);
}

type Context = {
  req: any;
  res: any;
  log: (msg: string) => void;
  error: (msg: string) => void;
};

export default async ({ req, res, log, error }: Context) => {
  // try {
  log(req);
  log('connect to appwrite api');
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);
  let datastore = new Databases(client);
  /*let chat = await datastore.listDocuments(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_TABLE_CHATS_ID!,
      [
        Query.equal('channel', 'telegram'),
        Query.equal('chat_id', String(req.body.message.chat.id)),
        Query.limit(1),
      ]
    );
    /


    if (req.method === 'GET') {
      return res.send('Silicia - Giulia BOT - core');
    }

  } catch (e: any) {
    error(JSON.stringify(e));
  }*/
};
