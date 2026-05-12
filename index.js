require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { CronJob } = require('cron');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const path = require('path');
const pino = require('pino');

const GROUP_NAME = process.env.GROUP_NAME || 'Biorad Systems D&D';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 7 * * *'; // 7 AM daily
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';
const AUTH_FOLDER = './auth_info_baileys';

const POLL_QUESTION = process.env.POLL_QUESTION || '🍽️ Will you be opting for office lunch today?';
const POLL_OPTIONS = ['✅ Yes, I\'ll have lunch', '❌ No, I\'ll skip today'];

// Silent logger — only show warnings/errors, not noise
const logger = pino({ level: 'silent' });

let sock = null;
let groupJid = null;
let isConnected = false;
const isSetupMode = process.argv.includes('--setup');
let setupDone = false;

async function findGroupJid(socket, name) {
  try {
    const groups = await socket.groupFetchAllParticipating();
    const match = Object.values(groups).find(
      (g) => g.subject && g.subject.trim() === name.trim()
    );
    if (match) {
      console.log(`✅ Found group "${name}" → JID: ${match.id}`);
      return match.id;
    }
    console.error(`❌ Group "${name}" not found. Available groups:`);
    Object.values(groups).forEach((g) => console.log(`   - "${g.subject}"`));
    return null;
  } catch (err) {
    console.error('Error fetching groups:', err.message);
    return null;
  }
}

async function sendMealCheck() {
  if (!isConnected || !sock) {
    console.error('❌ Cannot send: WhatsApp not connected');
    return;
  }
  if (!groupJid) {
    console.log('🔍 Group JID not cached, searching...');
    groupJid = await findGroupJid(sock, GROUP_NAME);
  }
  if (!groupJid) {
    console.error(`❌ Cannot send: group "${GROUP_NAME}" not found`);
    return;
  }
  try {
    await sock.sendMessage(groupJid, {
      poll: {
        name: POLL_QUESTION,
        values: POLL_OPTIONS,
        selectableCount: 1,
      },
    });
    console.log(`✅ [${new Date().toLocaleString('en-IN', { timeZone: TIMEZONE })}] Poll sent to "${GROUP_NAME}"`);
  } catch (err) {
    console.error('❌ Failed to send poll:', err.message);
  }
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: false, // we handle QR ourselves
    browser: ['Meal Hook', 'Chrome', '120.0.0'],
  });

  // Print QR code in terminal on first run
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Scan this QR code with your WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nWaiting for scan...\n');

      // Also save as PNG for easy scanning
      const qrPath = path.join(__dirname, 'whatsapp-qr.png');
      QRCode.toFile(qrPath, qr, { width: 400 }, (err) => {
        if (!err) console.log(`📸 QR image saved → open this file on your Mac to scan:\n   ${qrPath}\n`);
      });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
      isConnected = true;

      // Cache the group JID once on connect
      groupJid = await findGroupJid(sock, GROUP_NAME);

      // If running in --setup mode, send a test poll immediately then exit
      if (isSetupMode && !setupDone) {
        setupDone = true;
        console.log('🧪 Setup mode: sending test poll now...');
        await sendMealCheck();
        console.log('✅ Setup complete! Bot is configured.');
        console.log('   Run: pm2 restart meal-hook');
        process.exit(0);
      }
    }

    if (connection === 'close') {
      isConnected = false;
      groupJid = null;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`⚠️  Connection closed (code: ${code}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect && !isSetupMode) {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(connectToWhatsApp, 5000);
      } else if (!shouldReconnect) {
        console.error('🚫 Logged out. Delete auth_info_baileys/ and restart to re-link.');
        process.exit(1);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

async function main() {
  console.log('🚀 WhatsApp Meal Hook starting...');
  console.log(`   Group   : ${GROUP_NAME}`);
  console.log(`   Schedule: ${CRON_SCHEDULE} (${TIMEZONE})`);
  console.log('');

  await connectToWhatsApp();

  // Schedule daily message
  const job = new CronJob(
    CRON_SCHEDULE,
    sendMealCheck,
    null,
    true,        // start immediately
    TIMEZONE
  );

  console.log(`⏰ Cron job scheduled: ${CRON_SCHEDULE} (${TIMEZONE})`);
  console.log(`   Next run: ${job.nextDate().toLocaleString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
