const { CronJob } = require('cron');
const db = require('../db');
const { sendPoll, isConnected } = require('./whatsapp');

const activeJobs = new Map(); // sessionId -> CronJob

function scheduleSession(sessionId, cronExpr, timezone, emitFn) {
  // Clear existing job
  unscheduleSession(sessionId);

  const job = new CronJob(cronExpr, async () => {
    console.log(`[scheduler] Cron fired for session ${sessionId} at ${new Date().toISOString()}`);
    const session = db.getSession(sessionId);
    if (!session || !session.enabled) return;
    if (!session.group_jid) {
      db.addHistory(sessionId, { group_name: null, poll_question: session.poll_question, status: 'failed', error: 'No group configured' });
      return;
    }

    const options = JSON.parse(session.poll_options || '[]');
    const entry = {
      group_name: session.group_name,
      poll_question: session.poll_question,
      status: 'sent',
    };

    try {
      if (!isConnected(sessionId)) throw new Error('WhatsApp not connected');
      console.log(`[scheduler] Sending poll to "${session.group_name}"...`);
      await sendPoll(sessionId, session.group_jid, session.poll_question, options);
      console.log(`[scheduler] Poll sent successfully to "${session.group_name}"`);
      emitFn(sessionId, 'poll_sent', { at: new Date().toISOString(), group: session.group_name });
    } catch (err) {
      console.error(`[scheduler] Poll FAILED:`, err.message);
      entry.status = 'failed';
      entry.error = err.message;
      emitFn(sessionId, 'poll_failed', { error: err.message });
    }

    db.addHistory(sessionId, entry);
  }, null, true, timezone);

  const nextRun = job.nextDate().toISO();
  console.log(`[scheduler] Scheduled | cron: ${cronExpr} | tz: ${timezone} | next run: ${nextRun}`);
  activeJobs.set(sessionId, job);
  return nextRun;
}

function unscheduleSession(sessionId) {
  const job = activeJobs.get(sessionId);
  if (job) {
    job.stop();
    activeJobs.delete(sessionId);
  }
}

function getNextRun(sessionId) {
  const job = activeJobs.get(sessionId);
  return job ? job.nextDate().toISO() : null;
}

module.exports = { scheduleSession, unscheduleSession, getNextRun };
