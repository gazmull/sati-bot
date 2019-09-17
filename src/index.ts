import { exec as _exec } from 'child_process';
import { Client, MessageAttachment, TextChannel } from 'discord.js';
import { gzip } from 'zlib';
import { createReadStream, ReadStream, remove } from 'fs-nextra';
import { promisify } from 'util';
import auth from '../auth';
import Winston from '@gazmull/logger';
import { CronJob } from 'cron';

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
      onTick: () => startDumping(auth.dbs),
      start: true
    });
  })
  .on('error', err => logger.error(err))
  .login(auth.token);

async function startDumping (dbs: string[]) {
  logger.info('Started dumping databases.');

  for (const db of dbs)
    await writeDump(db);

  logger.info('Done dumping databases.');
}

async function writeDump (db: string) {
  try {
    const channel = client.channels.get(auth.channel) as TextChannel;

    if (!channel) throw new Error(`${db}: Cancelled. Discord channel cannot be resolved.`);

    const dumpPath = `dumps/${db}-dump.sql`;

    await exec(
      `mysqldump -u${auth.user}${auth.pass ? ` -p${auth.pass}` : ''} ${db} > ${dumpPath}`,
      { cwd: process.cwd() }
    );
    logger.info(`${db} Dumped.`);

    const dumpStream = createReadStream(dumpPath);
    const dumpBuffer = await toBuffer(dumpStream);
    const gzBuffer = await toGzip(dumpBuffer);
    const date = new Date().toISOString().split('T')[0];
    const attachment = new MessageAttachment(gzBuffer).setName(`${db}.${date}.sql.gz`);

    await remove(dumpPath);
    logger.info(`${db} Deleted dump.`);

    await channel.send(`Here is the backup that you requested to me for \`${db}\`!`, attachment);
    logger.info(`${db} as gzip sent to Discord.`);

    // Plan: add a functionality to save to actual backup storage (B2 comes to mind)
  } catch (err) { logger.error(err); }
}

function toBuffer (readableStream: ReadStream): Promise<Buffer> {
  let buffer = '';

  return new Promise((resolve, reject) => {
    readableStream
      .on('data', chunk => buffer += chunk)
      .once('error', reject)
      .once('end', () => resolve(Buffer.from(buffer)));
  });
}

function toGzip (buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gzip(buffer, (err, resBuffer) => {
      if (err) return reject(err);

      resolve(resBuffer);
    });
  });
}
