const test = require('node:test');
const assert = require('node:assert/strict');

const { toE164, isValidE164 } = require('../notifications/phone');
const { render } = require('../notifications/templates');
const { notifyUser } = require('../notifications/dispatcher');
const { CHANNEL_RESULT } = require('../notifications/channels/Channel');

// --- phone normalization --------------------------------------------------

test('phone: already-international numbers are preserved', () => {
  assert.equal(toE164('+225 07 00 00 00 00'), '+2250700000000');
  assert.equal(toE164('+234-802-123-4567'), '+2348021234567');
});

test('phone: 00 international prefix becomes +', () => {
  assert.equal(toE164('002250700000000'), '+2250700000000');
});

test('phone: local format uses the default dial code and drops trunk 0', () => {
  assert.equal(toE164('0700000000', '225'), '+225700000000');
  assert.equal(toE164('0802 123 4567', '234'), '+2348021234567');
});

test('phone: local number without a default dial code is rejected', () => {
  assert.equal(toE164('0700000000'), null);
});

test('phone: garbage is rejected', () => {
  assert.equal(toE164('abc'), null);
  assert.equal(toE164(''), null);
  assert.equal(toE164(null), null);
  assert.equal(isValidE164('+0123'), false);
  assert.equal(isValidE164('+2250700000000'), true);
});

// --- templates ------------------------------------------------------------

test('templates: render substitutes params and trims', () => {
  const s = render('booking_confirmed', { name: 'Ama', ref: '#123', url: 'https://x/y' });
  assert.match(s, /bonjour Ama/);
  assert.match(s, /#123/);
  assert.match(s, /https:\/\/x\/y/);
});

test('templates: missing params render empty, not "undefined"', () => {
  const s = render('reminder', { ref: '#9' });
  assert.doesNotMatch(s, /undefined/);
});

test('templates: unknown template throws', () => {
  assert.throws(() => render('nope', {}));
});

// --- dispatcher: fallback + best-effort -----------------------------------

function fakeChannel(id, status) {
  return { id, isConfigured: () => true, async send() { return { status }; } };
}

test('dispatcher: falls back from a skipping channel to the next', async () => {
  const channels = {
    whatsapp: fakeChannel('whatsapp', CHANNEL_RESULT.SKIPPED),
    sms: fakeChannel('sms', CHANNEL_RESULT.SENT),
  };
  const r = await notifyUser({
    to: '+2250700000000',
    templateName: 'booking_confirmed',
    params: { name: 'A', ref: '#1' },
    preferredChannels: ['whatsapp', 'sms'],
    channels,
  });
  assert.equal(r.delivered, true);
  assert.equal(r.channel, 'sms');
  assert.equal(r.attempts.length, 2);
});

test('dispatcher: preferred channel wins when it succeeds', async () => {
  const channels = {
    whatsapp: fakeChannel('whatsapp', CHANNEL_RESULT.SENT),
    sms: fakeChannel('sms', CHANNEL_RESULT.SENT),
  };
  const r = await notifyUser({
    to: '+2250700000000', templateName: 'reminder', params: { ref: '#2' },
    preferredChannels: ['whatsapp', 'sms'], channels,
  });
  assert.equal(r.channel, 'whatsapp');
  assert.equal(r.attempts.length, 1);
});

test('dispatcher: never throws — invalid phone returns a result', async () => {
  const r = await notifyUser({ to: 'not-a-phone', templateName: 'reminder', params: {} });
  assert.equal(r.delivered, false);
  assert.equal(r.reason, 'no_valid_phone');
});

test('dispatcher: a throwing channel is caught and does not break delivery', async () => {
  const channels = {
    whatsapp: { id: 'whatsapp', isConfigured: () => true, async send() { throw new Error('boom'); } },
    sms: fakeChannel('sms', CHANNEL_RESULT.SENT),
  };
  const r = await notifyUser({
    to: '+2250700000000', templateName: 'reminder', params: { ref: '#3' },
    preferredChannels: ['whatsapp', 'sms'], channels,
  });
  assert.equal(r.delivered, true);
  assert.equal(r.channel, 'sms');
  assert.equal(r.attempts[0].status, CHANNEL_RESULT.FAILED);
});

test('dispatcher: all channels exhausted reports cleanly', async () => {
  const channels = {
    whatsapp: fakeChannel('whatsapp', CHANNEL_RESULT.SKIPPED),
    sms: fakeChannel('sms', CHANNEL_RESULT.SKIPPED),
  };
  const r = await notifyUser({
    to: '+2250700000000', templateName: 'reminder', params: { ref: '#4' },
    preferredChannels: ['whatsapp', 'sms'], channels,
  });
  assert.equal(r.delivered, false);
  assert.equal(r.reason, 'all_channels_exhausted');
});
