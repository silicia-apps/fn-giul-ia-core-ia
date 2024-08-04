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
  //try {
    const gemini_si = `${process.env.GEMINI_SI!}; // $es_state ${ req.body.chat.profile.ltm? JSON.stringify(req.body.chat.profile.ltm) : '{}' } // $es_state ${ req.body.chat.profile.es? req.body.chat.profile.es : '{}' }` ;
    log(JSON.stringify(req));
    
    if (req.method === 'GET') {
      return res.send('Silicia - Giul-IA BOT - core');
    }
  //} catch (e: any) {
  //  error(JSON.stringify(e));
  //}
  return res.empty();
};
