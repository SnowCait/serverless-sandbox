import 'websocket-polyfill';
import { Kind, SimplePool, getEventHash, getPublicKey, nip19, signEvent } from "nostr-tools";

export const run = async (e, context) => {
  const time = new Date();
  console.log(`Your cron function "${context.functionName}" ran at ${time}`);

  const nsec = await getNsec('nostr-test-bot-nsec');
  const {type, data: seckey} = nip19.decode(nsec);

  if (type !== 'nsec' || typeof seckey !== 'string') {
    throw new Error(`[invalid nsec] type: ${type}, typeof seckey: ${typeof seckey}`);
  }

  const pubkey = getPublicKey(seckey);

  const now = new Date();

  const event = {
    kind: Kind.Text,
    pubkey,
    created_at: Math.floor(now / 1000),
    tags: [],
    content: `❄️ ${now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })}`
  };
  event.id = getEventHash(event);
  event.sig = signEvent(event, seckey);

  await publish(event);
};

async function publish(event) {
  console.log('[publish]', event);

  const pool = new SimplePool();

  const relays = [
    'wss://relay.nostr.wirednet.jp',
    'wss://nostr-relay.nokotaro.com',
  ];

  return new Promise((resolve) => {
    const pub = pool.publish(relays, event);
    pub.on('ok', relay => {
      console.log('[ok]', relay);
    });
    pub.on('failed', relay => {
      console.log('[failed]', relay);
    });
    setTimeout(() => {
      pool.close(relays);
      resolve();
    }, 3000);
  })
}

async function getNsec(name) {
  const response = await fetch(`http://localhost:2773/systemsmanager/parameters/get?name=${name}&withDecryption=true`, {
    method: 'GET',
    headers: {
      'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const secrets = await response.json();
  return secrets.Parameter.Value;
}
