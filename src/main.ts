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
  $id: string;
  message: string;
  thought: Thought;
  bot: boolean;
  chat: Chat;
}

export interface Thought extends Models.Document {
  thought: string;
  message: Message;
}

export interface Chat {
  $id: string;
  channel: 'telegram' | 'alexa';
  messages: Message[];
  profile: Profile;
  chatid: string;
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

function hasJsonStructure(str: string) {
  if (typeof str !== 'string') return false;
  try {
    const result = JSON.parse(str);
    const type = Object.prototype.toString.call(result);
    return type === '[object Object]' || type === '[object Array]';
  } catch (err) {
    return false;
  }
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
      (es[property] as number) < 10
        ? (es[property] as number) + 1
        : 10;
  } else {
    log(`${property.toString()} goes Down`);
    (<number>new_es[property]) =
      (es[property] as number) > -10
        ? (es[property] as number) - 1
        : -10;
  }
  return new_es;
}

export default async ({ req, res, log, error }: Context) => {
  function debug(text: string) {
    if (process.env.DEBUG!.toLowerCase() === 'true') {
      error(text);
    }
  }
  try {
    const body: Message = req.body;
    debug(`request: ${JSON.stringify(body)}`);
    if (!body.bot) {
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
          [Query.equal('$id', String(body.chat.profile.$id)), Query.limit(1)]
        );
      if (profiles.total > 0) {
        const profile = profiles.documents[0];
        debug(`profile: ${JSON.stringify(profile)}`);
        const historyItems: HistoryItem[] = [];
        const messages: Message[] = [];
        const thoughts: Thought[] = [];
        log(`profile loaded id: ${profile.$id}`);
        log('extract es');
        let es: Es = profile.es;
        debug(`emotions state: ${JSON.stringify(es)}`);
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
        debug(`installed modules: ${JSON.stringify(modules)}`);
        log('search chat');
        let chatid = '';
        for (const chat of profile.chats) {
          if (chat.channel === body.chat.channel) {
            chatid = chat.$id;
            log(
              'extract messages/thought from chat and create history for gemini'
            );
            if (chat.messages.length > 1) {
              for (const message of chat.messages) {
                const thoughts: Models.DocumentList<Thought> =
                  await datastore.listDocuments(
                    process.env.APPWRITE_DATABASE_ID!,
                    process.env.APPWRITE_TABLE_TOUGHTS_ID!,
                    [Query.equal('message', message.$id)]
                  );

                historyItems.push({
                  parts: [{ text: message.message }],
                  role: message.bot ? 'model' : 'user',
                });

                if (thoughts.total > 0) {
                  historyItems.push({
                    parts: [{ text: thoughts.documents[0].thought }],
                    role: 'model',
                  });
                }
              }
            }
          }
        }
        debug(`history: ${JSON.stringify(historyItems)}`);
        log('extract ltm');
        const ltm: SlotLtm[] = [];
        let user_language: string = 'en';
        for (const slot of profile.ltm) {
          if (slot.key === 'user_language') user_language = slot.value[0];
          ltm.push({
            key: slot.key,
            value: slot.value,
          });
        }
        debug(`long term memory: ${JSON.stringify(ltm)}`);
        log('Generate system instructions for gemini');
        let system_instruction = `${process.env.GEMINI_SI!}; // extra $actions_list ${JSON.stringify(modules)} // $ltm_state ${JSON.stringify(ltm)} // ${JSON.stringify(es)}`;
        // add some extra test system instructions
        const extra_si = ``;
        log(`Add ${extra_si} to System Instructions`);
        system_instruction += ``;
        log(`Set language to ${user_language}`);
        system_instruction = system_instruction.replaceAll(
          '@user_language@',
          user_language
        );
        debug(`system instructions: ${system_instruction}`);
        log('start chat with gemini api');
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

        const chatSession = model.startChat({
          generationConfig: generationConfig,
          history: historyItems,
        });
        let message: string;
        console.log('Check if the message is in JSON format');
        try {
          JSON.parse(body.message);
          console.log('The message is in JSON format');
          message = body.message;
        } catch (e) {
          console.log('The message is a input from chat');
          message = `{ 'module': 'core', 'action': 'input', 'channel': '${body.chat.channel}', 'payload': { 'chatid': '${body.chat.chatid}', 'value' : '${body.message}' }}`;
        }
        log(`try to send message to gemini`);
        debug(`message: ${message}`);
        const gemini_answer = JSON.parse(
          (await chatSession.sendMessage(message)).response.text()
        );
        debug(`gemini answer: ${JSON.stringify(gemini_answer)}`);
        log('*** update es ***');
        let new_es: Es = { $id: profile.es.$id };
        gemini_answer.es['+'].forEach((emotion: any) => {
          new_es = emotionVariator(es, new_es, emotion);
        });
        gemini_answer.es['-'].forEach((emotion: any) => {
          new_es = emotionVariator(es, new_es, emotion, false);
        });
        log(`Try to write new ES in database`);
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
        debug(`Variation of emotions: ${JSON.stringify(new_es)}`);
        log(`*** write thoughts in db`);
        log(`write new thought`);
        debug(`new thought: ${JSON.stringify(gemini_answer.thoughts)}`);
        datastore
          .createDocument(
            process.env.APPWRITE_DATABASE_ID!,
            process.env.APPWRITE_TABLE_TOUGHTS_ID!,
            ID.unique(),
            {
              thought: JSON.stringify(gemini_answer.thoughts),
              chatid: chatid,
              message: req.body.$id,
            }
          )
          .then((thought) => {
            log(`*** Thought saved with id ${thought.$id} ***`);
            log(`*** parse actions ***`);
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
              debug(`new actions: ${JSON.stringify(action)}`);
            });
          });
      } else {
        error('profile not found');
      }
    }
    if (req.method === 'GET') {
      return res.send('Silicia - Giul-IA BOT - core');
    }
    return res.empty();
  } catch (e: any) {
    error(String(e));
  }
};
