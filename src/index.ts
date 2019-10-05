import { exec as _exec } from 'child_process';
import { Client, MessageAttachment, TextChannel } from 'discord.js';
import * as fs from 'fs-nextra';
import { Readable } from 'stream';
import Tar from 'tar';
import { promisify } from 'util';
import { Auth } from '../typings/auth';
import Winston from '@gazmull/logger';
import { CronJob } from 'cron';
import CloudStore from 'smcloudstore';

const auth: Auth = require('../auth');
const date = () => new Date().toISOString().split('T')[0];
const archiveName = () => `${auth.name ? `${auth.name}.` : ''}${date()}.tgz`;

const exec = promisify(_exec);
const logger = new Winston('sati').logger;
const client = new Client({
  disabledEvents: [
    'GUILD_MEMBER_ADD', 'WEBHOOKS_UPDATE',
    'GUILD_MEMBER_REMOVE', 'GUILD_MEMBER_UPDATE',
    'GUILD_MEMBERS_CHUNK', 'GUILD_INTEGRATIONS_UPDATE',
    'GUILD_ROLE_CREATE', 'GUILD_ROLE_DELETE',
    'GUILD_ROLE_UPDATE', 'GUILD_BAN_ADD',
    'GUILD_BAN_REMOVE', 'GUILD_EMOJIS_UPDATE',
    'CHANNEL_DELETE', 'CHANNEL_PINS_UPDATE',
    'MESSAGE_CREATE', 'MESSAGE_DELETE',
    'MESSAGE_UPDATE', 'MESSAGE_DELETE_BULK',
    'MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE',
    'MESSAGE_REACTION_REMOVE_ALL', 'USER_UPDATE',
    'PRESENCE_UPDATE', 'TYPING_START',
    'VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE',
  ],
  disableEveryone: true,
  messageCacheMaxSize: 1,
  presence: {
    activity: {
      name: 'as a backup bot',
      type: 'PLAYING'
    },
    status: 'dnd'
  }
});

client
  .once('ready', () => {
    logger.info(`Logged in as ${client.user.tag}. Starting CronJob...`);

    return new CronJob({
      cronTime: '0 0 * * *',
      onTick: () => startDumping(),
      start: true
    });
  })
  .on('error', err => logger.error(err))
  .login(auth.discord.token);

async function startDumping () {
  try {
    const dumpsExists = await fs.pathExists('dumps');

    if (!dumpsExists)
      await fs.mkdir('dumps');
    else {
      await fs.emptyDir('dumps');
      logger.info('Cleared dumps directory.');
    }

    logger.info('Started dumping.');

    const { mysql } = auth;

    if (mysql.dbs && mysql.dbs.length) {
      logger.info('Started dumping databases.');

      for (const db of mysql.dbs)
        await writeDbDump(db);

      logger.info('Done dumping databases.');
    }
    if (auth.nginxPath)
      await writeNginxDump();

    const tgzStream = Tar.c({ gzip: true }, [ 'dumps' ]);
    const tgzBuffer = await toBuffer(tgzStream);

    if (auth.discord.channel)
      await sendToDiscord(tgzBuffer);
    else
      logger.warn('Skipped dumping to Discord channel: not specified.');

    const { cloud } = auth;

    if (cloud && cloud.provider && cloud.container && cloud.credentials)
      await sendToCloud(tgzBuffer);
    else
      logger.warn('Skipped dumping to Cloud Storage: not specified.');

  } catch (err) { logger.error(err); }
}

async function writeDbDump (db: string) {
  const dumpPath = `dumps/${db}-dump.sql`;
  const { mysql } = auth;

  await exec(
    `mysqldump -u${mysql.user}${mysql.pass ? ` -p${mysql.pass}` : ''} ${db} > ${dumpPath}`,
    { cwd: process.cwd() }
  );
  logger.info(`${db} dumped.`);
}

async function writeNginxDump () {
  logger.info('Started dumping NGINX config.');

  const tgzStream = Tar.c({ gzip: true }, [ auth.nginxPath ]);
  const tgzBuffer = await toBuffer(tgzStream);

  await fs.writeFile('dumps/nginx.tgz', tgzBuffer);
  logger.info(`NGINX config dumped.`);
}

async function sendToCloud (zip: Buffer) {
  const { cloud } = auth;
  const store = CloudStore.Create(cloud.provider, cloud.credentials);

  logger.info(`Cloud provider is ${cloud.provider}`);
  logger.info(`Ensuring that bucket ${cloud.container.name} exists...`);
  await store.ensureContainer(cloud.container.name, cloud.container.options);
  logger.info(`Bucket ${cloud.container.name} is ensured.`);

  logger.info(`Uploading archived backup to bucket ${cloud.container.name} as ${archiveName()}...`);
  await store.putObject(
    cloud.container.name,
    archiveName(),
    zip,
    {
      metadata: {
        'Content-Type': 'application/gzip'
      }
    }
  );
  logger.info(`Uploaded ${archiveName()} to bucket ${cloud.container.name}.`);

  await sendToDiscord(`Backup has been sent to ${cloud.provider} under ${cloud.container.name} as \`${archiveName()}\`!`);
}

async function sendToDiscord (content: Buffer | string) {
  const channel = await client.channels.fetch(auth.discord.channel) as TextChannel;

  if (Buffer.isBuffer(content)) {
    const attachment = new MessageAttachment(content, archiveName());

    await channel.send('Here is the backup the you requested to me!', attachment);
    logger.info('Backup sent to Discord channel.');
  } else {
    await channel.send(content);
    logger.info('Sent message to Discord channel.');
  }
}

function toBuffer (readableStream: Readable): Promise<Buffer> {
  let buffer = Buffer.concat([]);

  return new Promise((resolve, reject) => {
    readableStream
      .on('data', chunk => buffer = Buffer.concat([ buffer, chunk ]))
      .once('error', reject)
      .once('end', () => resolve(buffer));
  });
}
