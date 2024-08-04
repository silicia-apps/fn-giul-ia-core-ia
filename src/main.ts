import { Client, Databases, Query, ID } from 'node-appwrite';

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

export default async ({ req, res, log, error }: Context) => {
  try {
    const gemini_si = `${process.env.GEMINI_SI!}; // $ltm_state ${ req.body.chat.identity.emotional_state? JSON.stringify(req.body.chat.identity.emotional_state) : '{}' } // $em_state ${ req.body.chat.identity.memories? req.body.chat.identity.memories : '{}' }` ;
    log(JSON.stringify(req));
    
    if (req.method === 'GET') {
      return res.send('Silicia - Giul-IA BOT - core');
    }
  } catch (e: any) {
    error(JSON.stringify(e));
  }
  return res.empty();
};
