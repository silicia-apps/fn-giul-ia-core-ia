import { Client, Databases, Query, ID, Models } from 'node-appwrite';
import { GoogleGenerativeAI } from '@google/generative-ai';

//import * as process from './env.js';

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

export interface HistoryItem {
  role: 'model' | 'user';
  parts: {
    text: string;
  }[];
}

export interface Message {
  message: string;
  tought: Thought;
  bot: boolean;
}

export interface Thought {
  tought: string;
  message: Message;
}

export interface Chat {
  $id: string;
  channel: 'telegram' | 'alexa';
  messages: Message[];
}

export interface Module {
  name: string;
  description: string;
  queue: string[];
  actions: string[];
  events: string[];
}
export interface SlotLtm {
  key: string;
  value: string[];
}

export interface Es {
  $id: string;
  fear?: number;
  happiness?: number;
  sadness?: number;
  anger?: number;
  surprise?: number;
  disgust?: number;
  anxiety?: number;
  excitement?: number;
  frustration?: number;
  satisfaction?: number;
  curiosity?: number;
  boredom?: number;
  nostalgia?: number;
  hope?: number;
  pride?: number;
  shame?: number;
  concentration?: number;
  confusion?: number;
  calm?: number;
  stress?: number;
  creativity?: number;
  empathy?: number;
  logic?: number;
  humor?: number;
  learning?: number;
  connection?: number;
  autonomy?: number;
}

export interface Profile extends Models.Document {
  name: string;
  chats: Chat[];
  es: Es;
  queue: string[];
  ltm: SlotLtm[];
  modules: Module[];
}

function emotionVariator(
  es: Es,
  new_es: Es,
  property: keyof Es,
  positive: boolean = true
): Es {
  if (positive) {
    log(`${property.toString()} goes UP`);
    (<number>new_es[property]) =
      es[property] && (es[property] as number) < 10
        ? (es[property] as number) + 1
        : 1;
  } else {
    log(`${property.toString()} goes Down`);
    (<number>new_es[property]) =
      es[property] && (es[property] as number) > -10
        ? (es[property] as number) - 1
        : -1;
  }
  return new_es;
}

export default async ({ req, res, log, error }: Context) => {
  //try {
  if (!req.body.bot) {
    log('connect to appwrite api');
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);
    let datastore = new Databases(client);
    log(
      'extract current profile id from request and search profile in database'
    );
    const profiles: Models.DocumentList<Profile> =
      await datastore.listDocuments(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_TABLE_PROFILES_ID!,
        [Query.equal('$id', String(req.body.chat.profile.$id)), Query.limit(1)]
      );
    if (profiles.total > 0) {
      const profile = profiles.documents[0];
      const historyItems: HistoryItem[] = [];
      const messages: Message[] = [];
      const thoughts: Thought[] = [];

      log('profile loaded');

      log('extract es');
      let es: Es = profile.es;

      const modules: Module[] = [];
      log('extract modules');
      for (const module of profile.modules) {
        modules.push({
          name: module.name,
          description: module.description,
          queue: module.queue,
          actions: module.actions,
          events: module.events,
        });
      }
      log('search chat');
      let chat_id = '';
      for (const chat of profile.chats) {
        if (chat.channel === req.body.chat.channel) {
          chat_id = chat.$id;
          log(
            'extract messages/thought from chat and create history for gemini'
          );
          if (chat.messages.length > 1) {
            for (const message of chat.messages) {
              historyItems.push({
                parts: [
                  { text: message.message },
                  { text: message.tought.tought },
                ],
                role: message.bot ? 'model' : 'user',
              });
            }
          }
        }
      }
      log('extract ltm');
      const ltm: SlotLtm[] = [];
      for (const slot of profile.ltm) {
        ltm.push({
          key: slot.key,
          value: slot.value,
        });
      }
      log('generate system instructions for gemini');
      let system_instruction = `${process.env.GEMINI_SI!}; // extra $actions_list ${JSON.stringify(modules)} // $ltm_state ${JSON.stringify(ltm)} // ${JSON.stringify(es)}`;
      system_instruction += ``;
      log(system_instruction);
      log(JSON.stringify(historyItems));
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY!);
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL!,
        systemInstruction: system_instruction,
      });
      const generationConfig = {
        temperature: 2,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      };
      log('start chat with gemini');
      const chatSession = model.startChat({
        generationConfig: generationConfig,
        history: historyItems,
      });
      const message = `{ 'module': 'core', 'action': 'event', 'channel': '${req.body.chat.channel}', 'payload': { 'chatid': '${req.body.chat.chat_id}', 'value' : '${req.body.message}' }}`;
      log(`try to send this message : ${message}`);
      const gemini_answer = JSON.parse(
        (await chatSession.sendMessage(message)).response.text()
      );
      log('*** update es ***');
      let new_es: Es = { $id: profile.es.$id };
      gemini_answer.es['+'].forEach((emotion: any) => {
        new_es = emotionVariator(es, new_es, emotion);
      });
      gemini_answer.es['-'].forEach((emotion: any) => {
        new_es = emotionVariator(es, new_es, emotion, false);
      });
      //try {
      log(`Try to write new ES in database`);
      log(JSON.stringify(new_es));
      datastore
        .updateDocument(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_TABLE_EM_ID!,
          es.$id,
          new_es
        )
        .then(() => {
          log(`*** Es updated ***`);
        });
      /*} catch (e) {
          error(`error on write es to db: ${JSON.stringify(e)}`);
        }*/
      log(`*** write thoughts in db`);
      //try {
      log(`try to write`);
      datastore
        .createDocument(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_TABLE_TOUGHTS_ID!,
          ID.unique(),
          {
            thought: JSON.stringify(gemini_answer.thoughts),
            message: req.body.message.$id,
          }
        )
        .then((thought) => {
          log(`*** Thought saved with id ${thought.$id} ***`);
          log(`*** parse actions ***`);
          console.log(JSON.stringify(gemini_answer.actions));
          gemini_answer.actions.forEach((action: any) => {
            console.log('*** try to write action in queue ***');
            datastore.createDocument(
              process.env.APPWRITE_DATABASE_ID!,
              process.env.APPWRITE_TABLE_ACTIONS_ID!,
              ID.unique(),
              {
                action: JSON.stringify(action),
                thought: thought.$id,
              }
            );
          });
        });
      /*} catch (e) {
          error(`error on write es to db: ${JSON.stringify(e)}`);
        }*/
    } else {
      error('profile not found');
    }
  }
  /*} catch (e: any) {
    error(JSON.stringify(e));
  }*/
  if (req.method === 'GET') {
    return res.send('Silicia - Giul-IA BOT - core');
  }
  return res.empty();
};
