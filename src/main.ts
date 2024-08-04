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
    const system_instruction = `${process.env.GEMINI_SI!}; // $es_state ${ req.body.chat.profile.ltm? JSON.stringify(req.body.chat.profile.ltm) : '{}' } // $es_state ${ req.body.chat.profile.es? req.body.chat.profile.es : '{}' }` ;
    const message = req.body.message;
    
    console.log(system_instruction);
    console.log(message);

    
    if (req.method === 'GET') {
      return res.send('Silicia - Giul-IA BOT - core');
    }
  //} catch (e: any) {
  //  error(JSON.stringify(e));
  //}
  return res.empty();
};
