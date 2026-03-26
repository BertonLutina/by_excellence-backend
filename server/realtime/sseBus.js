const channels = new Map();

function subscribe(userId, res) {
  const key = String(userId);
  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);

  return () => {
    const set = channels.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) channels.delete(key);
  };
}

function publishToUser(userId, event, payload) {
  const key = String(userId);
  const set = channels.get(key);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload ?? {});
  for (const res of set) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${data}\n\n`);
  }
}

function publishToUsers(userIds, event, payload) {
  for (const userId of userIds || []) {
    publishToUser(userId, event, payload);
  }
}

module.exports = { subscribe, publishToUser, publishToUsers };
