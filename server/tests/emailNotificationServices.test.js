const test = require('node:test');
const assert = require('node:assert/strict');

function loadWithStubs(targetPath, stubMap) {
  const touched = [];

  for (const [requestPath, exports] of Object.entries(stubMap)) {
    const resolved = require.resolve(requestPath);
    touched.push({ resolved, previous: require.cache[resolved] });
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports,
    };
  }

  const targetResolved = require.resolve(targetPath);
  const previousTarget = require.cache[targetResolved];
  delete require.cache[targetResolved];

  try {
    return require(targetPath);
  } finally {
    delete require.cache[targetResolved];
    if (previousTarget) {
      require.cache[targetResolved] = previousTarget;
    }

    for (const { resolved, previous } of touched.reverse()) {
      if (previous) {
        require.cache[resolved] = previous;
      } else {
        delete require.cache[resolved];
      }
    }
  }
}

test('sendStatusNotification skips opted-out client/provider and still emails admins', async () => {
  const sendMailCalls = [];
  const userById = new Map([
    [21, { id: 21, email: 'provider@example.com', email_notifications: { 'status.completed': false } }],
  ]);

  const { sendStatusNotification, emailTemplate } = loadWithStubs(
    '../services/statusNotificationService',
    {
      '../models/ServiceRequest': {
        findById: async () => ({
          id: 123456,
          client_email: 'client@example.com',
          client_name: 'Client',
          provider_id: 9,
          provider_name: 'Provider',
        }),
      },
      '../models/Provider': {
        findById: async () => ({ id: 9, user_id: 21 }),
      },
      '../models/User': {
        findById: async (id) => userById.get(id) || null,
        findAll: async () => [{ id: 1, email: 'admin@example.com', full_name: 'Admin User' }],
      },
      '../utils/mailer': {
        sendMail: async (payload) => {
          sendMailCalls.push(payload);
        },
      },
      '../../constants/constant': {
        FRONTEND_ORIGIN: 'https://frontend.example',
      },
      '../utils/emailPreferences': {
        emailWantsEmail: async () => false,
        wantsEmail: () => false,
        userWantsEmail: async () => false,
      },
    }
  );

  assert.equal(typeof emailTemplate, 'function');

  const result = await sendStatusNotification({ request_id: 123456, new_status: 'completed' });

  assert.equal(result.ok, true);
  assert.deepEqual(
    sendMailCalls.map((call) => call.to),
    ['admin@example.com']
  );
});

test('notifyOfferStatusChange skips opted-out client/provider and keeps admin email', async () => {
  const sendMailCalls = [];
  const userById = new Map([
    [21, { id: 21, email: 'provider@example.com', email_notifications: { 'offer.accepted': false } }],
  ]);

  const { notifyOfferStatusChange } = loadWithStubs('../services/notificationService', {
    '../db/db': {
      executeSQL: async (sql) => {
        if (sql.includes('SELECT user_id FROM clients')) return [{ user_id: 11 }];
        if (sql.includes('SELECT user_id FROM providers')) return [{ user_id: 21 }];
        if (sql.includes("SELECT user_id FROM admins WHERE status = 'active'")) return [{ user_id: 31 }];
        if (sql.includes('INSERT INTO notifications')) return { insertId: 1 };
        return [];
      },
    },
    '../realtime/sseBus': {
      publishToUser: () => {},
    },
    '../models/ServiceRequest': {
      findById: async () => ({
        id: 654321,
        client_id: 5,
        client_email: 'client@example.com',
        client_name: 'Client',
        provider_name: 'Provider',
      }),
    },
    '../models/Offer': {
      findById: async () => ({
        id: 77,
        request_id: 654321,
        provider_id: 9,
        total_amount: 250,
      }),
    },
    '../models/Provider': {},
    '../models/User': {
      findById: async (id) => userById.get(id) || null,
      findAll: async () => [{ id: 31, email: 'admin@example.com', full_name: 'Admin User' }],
    },
    '../utils/mailer': {
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
      },
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/statusNotificationService': loadWithStubs('../services/statusNotificationService', {
      '../models/ServiceRequest': { findById: async () => null },
      '../models/Provider': { findById: async () => null },
      '../models/User': { findById: async () => null, findAll: async () => [] },
      '../utils/mailer': { sendMail: async () => {} },
      '../../constants/constant': { FRONTEND_ORIGIN: 'https://frontend.example' },
      '../utils/emailPreferences': {
        emailWantsEmail: async () => true,
        wantsEmail: () => true,
        userWantsEmail: async () => true,
      },
    }),
    '../utils/emailPreferences': {
      emailWantsEmail: async () => false,
      wantsEmail: () => false,
      userWantsEmail: async () => false,
    },
  });

  await notifyOfferStatusChange(77, 'accepted');

  assert.deepEqual(
    sendMailCalls.map((call) => call.to),
    ['admin@example.com']
  );
});

test('sendPaymentConfirmationEmail skips opted-out client', async () => {
  const sendMailCalls = [];

  const { sendPaymentConfirmationEmail } = loadWithStubs('../services/paymentConfirmationEmail', {
    '../models/Payment': {
      findById: async () => ({
        id: 1,
        request_id: 99,
        type: 'deposit',
        amount: 100,
      }),
    },
    '../models/ServiceRequest': {
      findById: async () => ({
        id: 99,
        client_email: 'client@example.com',
        client_name: 'Client',
        provider_name: 'Provider',
      }),
    },
    '../utils/mailer': {
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
      },
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../utils/emailPreferences': {
      emailWantsEmail: async () => false,
    },
  });

  const result = await sendPaymentConfirmationEmail(1);

  assert.deepEqual(result, { ok: true, skipped: true, reason: 'prefs' });
  assert.equal(sendMailCalls.length, 0);
});

test('sendPaymentReminders skips opted-out client reminders but keeps admin overdue alert', async () => {
  const sendMailCalls = [];
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 3);

  const { sendPaymentReminders } = loadWithStubs('../services/paymentRemindersService', {
    '../models/Payment': {
      findAll: async () => [
        {
          id: 42,
          request_id: 99,
          type: 'final',
          amount: 500,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ],
    },
    '../models/ServiceRequest': {
      findById: async () => ({
        id: 99,
        client_email: 'client@example.com',
        client_name: 'Client',
        provider_name: 'Provider',
        status: 'date_confirmed',
        confirmed_date: eventDate.toISOString(),
      }),
    },
    '../models/User': {
      findAll: async () => [{ id: 1, email: 'admin@example.com' }],
    },
    '../utils/mailer': {
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
      },
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../utils/paymentWindow': require('../utils/paymentWindow'),
    '../utils/emailPreferences': {
      emailWantsEmail: async (_email, key) => key !== 'payments.reminder_overdue',
    },
  });

  const result = await sendPaymentReminders({ days_before: 3, days_after: 1 });

  assert.equal(result.success, true);
  assert.deepEqual(
    sendMailCalls.map((call) => call.to),
    ['admin@example.com']
  );
  assert.ok(result.details.some((d) => d.type === 'admin_overdue_alert'));
});

test('notifyComboRequestCreated emails all combo targets after in-app notifications', async () => {
  const sendMailCalls = [];
  const insertedNotifications = [];

  const { notifyComboRequestCreated } = loadWithStubs('../services/notificationService', {
    '../db/db': {
      executeSQL: async (sql, params) => {
        if (sql.includes('SELECT user_id FROM providers')) {
          if (params[0] === 9) return [{ user_id: 21 }];
          return [];
        }
        if (sql.includes("SELECT user_id FROM admins WHERE status = 'active'")) return [{ user_id: 31 }];
        if (sql.includes('SELECT user_id FROM clients')) return [{ user_id: 11 }];
        if (sql.includes('INSERT INTO notifications')) {
          insertedNotifications.push(params);
          return { insertId: insertedNotifications.length };
        }
        return [];
      },
    },
    '../realtime/sseBus': {
      publishToUser: () => {},
    },
    '../models/ServiceRequest': {},
    '../models/Offer': {},
    '../models/Provider': {},
    '../models/User': {
      findById: async (id) =>
        ({
          11: { id: 11, email: 'client@example.com' },
          21: { id: 21, email: 'provider@example.com' },
          31: { id: 31, email: 'admin@example.com' },
        })[id] || null,
      findAll: async () => [],
    },
    '../utils/mailer': {
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
      },
    },
    '../utils/emailPreferences': {
      emailWantsEmail: async () => true,
      userWantsEmail: async () => true,
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/statusNotificationService': {
      sendStatusNotification: async () => ({ ok: true }),
      STATUS_CONFIG: {},
      emailTemplate: (_title, bodyHtml, ctaUrl) => `${bodyHtml} :: ${ctaUrl}`,
    },
  });

  await notifyComboRequestCreated({
    id: 654321,
    client_id: 5,
    client_name: 'Client',
    collaborators: [{ provider_id: 9 }],
  });

  assert.equal(insertedNotifications.length, 3);
  assert.deepEqual(
    sendMailCalls.map((call) => call.to),
    ['provider@example.com', 'admin@example.com', 'client@example.com']
  );
});

test('notifyCollaborationInvite emails invitee and inviter when allowed', async () => {
  const sendMailCalls = [];
  const insertedNotifications = [];

  const { notifyCollaborationInvite } = loadWithStubs('../services/notificationService', {
    '../db/db': {
      executeSQL: async (sql, params) => {
        if (sql.includes('SELECT user_id FROM providers')) {
          if (params[0] === 8) return [{ user_id: 18 }];
          if (params[0] === 9) return [{ user_id: 19 }];
          return [];
        }
        if (sql.includes('SELECT display_name FROM providers')) return [{ display_name: 'Lead Provider' }];
        if (sql.includes('INSERT INTO notifications')) {
          insertedNotifications.push(params);
          return { insertId: insertedNotifications.length };
        }
        return [];
      },
    },
    '../realtime/sseBus': {
      publishToUser: () => {},
    },
    '../models/ServiceRequest': {},
    '../models/Offer': {},
    '../models/Provider': {},
    '../models/User': {
      findById: async (id) =>
        ({
          18: { id: 18, email: 'invitee@example.com' },
          19: { id: 19, email: 'inviter@example.com' },
        })[id] || null,
      findAll: async () => [],
    },
    '../utils/mailer': {
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
      },
    },
    '../utils/emailPreferences': {
      emailWantsEmail: async () => true,
      userWantsEmail: async () => true,
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/statusNotificationService': {
      sendStatusNotification: async () => ({ ok: true }),
      STATUS_CONFIG: {},
      emailTemplate: (_title, bodyHtml, ctaUrl) => `${bodyHtml} :: ${ctaUrl}`,
    },
  });

  await notifyCollaborationInvite(777111, 8, 9);

  assert.equal(insertedNotifications.length, 1);
  assert.deepEqual(
    sendMailCalls.map((call) => call.to),
    ['invitee@example.com', 'inviter@example.com']
  );
});

test('notifyCollaborationResponse emails only the lead and not admins', async () => {
  const sendMailCalls = [];
  const insertedNotifications = [];

  const { notifyCollaborationResponse } = loadWithStubs('../services/notificationService', {
    '../db/db': {
      executeSQL: async (sql, params) => {
        if (sql.includes("SELECT provider_id FROM service_request_collaborators")) return [{ provider_id: 9 }];
        if (sql.includes('SELECT user_id FROM providers')) {
          if (params[0] === 9) return [{ user_id: 19 }];
          return [];
        }
        if (sql.includes("SELECT user_id FROM admins WHERE status = 'active'")) return [{ user_id: 31 }];
        if (sql.includes('SELECT display_name FROM providers')) return [{ display_name: 'Invitee Provider' }];
        if (sql.includes('INSERT INTO notifications')) {
          insertedNotifications.push(params);
          return { insertId: insertedNotifications.length };
        }
        return [];
      },
    },
    '../realtime/sseBus': {
      publishToUser: () => {},
    },
    '../models/ServiceRequest': {},
    '../models/Offer': {},
    '../models/Provider': {},
    '../models/User': {
      findById: async (id) =>
        ({
          19: { id: 19, email: 'lead@example.com' },
          31: { id: 31, email: 'admin@example.com' },
        })[id] || null,
      findAll: async () => [],
    },
    '../utils/mailer': {
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
      },
    },
    '../utils/emailPreferences': {
      emailWantsEmail: async () => true,
      userWantsEmail: async () => true,
    },
    '../../constants/constant': {
      FRONTEND_ORIGIN: 'https://frontend.example',
    },
    '../services/statusNotificationService': {
      sendStatusNotification: async () => ({ ok: true }),
      STATUS_CONFIG: {},
      emailTemplate: (_title, bodyHtml, ctaUrl) => `${bodyHtml} :: ${ctaUrl}`,
    },
  });

  await notifyCollaborationResponse(444222, 8, 'accepted');

  assert.equal(insertedNotifications.length, 2);
  assert.deepEqual(
    sendMailCalls.map((call) => call.to),
    ['lead@example.com']
  );
});
