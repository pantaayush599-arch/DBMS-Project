const app = require('./app');
const { ensureDatabase } = require('./init');

const port = Number(process.env.PORT || 3000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start() {
  // Creates the database on first start unless AUTO_INIT_DB=false.
  // On a fresh cloud deploy MySQL may still be booting, so retry for about a minute.
  if (process.env.AUTO_INIT_DB !== 'false') {
    for (let attempt = 1; ; attempt++) {
      try {
        await ensureDatabase();
        break;
      } catch (err) {
        const retryable = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'PROTOCOL_CONNECTION_LOST'].includes(err.code);
        if (!retryable || attempt >= 12) throw err;
        console.log(`Database not reachable yet (${err.code}), retrying in 5s... [${attempt}/12]`);
        await sleep(5000);
      }
    }
  }
  app.listen(port, () => console.log(`Inventory system running on port ${port}`));
}

start().catch((err) => {
  console.error('Could not start:', err.message);
  process.exit(1);
});
