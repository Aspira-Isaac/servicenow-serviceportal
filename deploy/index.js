/**
 * Aspira Help Center — PRODUCTION portal deploy
 * Target: aspiraconnect.service-now.com  (.env)
 * KB: Consumer Service
 *
 * For dev (aspiraconnecttest.service-now.com, Rainger KB): run deploy/index-dev.js
 */
require('dotenv').config();

const steps = [
  { name: '00-preflight',     fn: require('./00-preflight') },
  { name: '01-theme',         fn: require('./01-theme') },
  { name: '02-header-footer', fn: require('./02-header-footer') },
  { name: '03-portal',        fn: require('./03-portal') },
  { name: '04-pages',         fn: require('./04-pages') },
  { name: '05-widgets',       fn: require('./05-widgets') },
  { name: '06-layout',        fn: require('./06-layout') }
];

// Shared context — sys_ids flow between steps
const ctx = {};

async function run() {
  console.log('\n========================================');
  console.log('  Aspira Help Center — Portal Deploy');
  console.log('========================================\n');

  for (const step of steps) {
    console.log(`\n[${step.name}]`);
    try {
      await step.fn(ctx);
    } catch (err) {
      console.error(`\nFATAL: Step "${step.name}" failed`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('\n========================================');
  console.log('  Deploy complete!');
  console.log(`  Portal: ${process.env.SNOW_INSTANCE}/help`);
  console.log('========================================\n');
}

run();
