const express = require('express');
const eventBus = require('../utils/eventBus');
const { validateSession } = require('../middlewares/sessionManagement.middleware');
const router = express.Router();

router.get('/stream', validateSession, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const authenticatedUserId = req.user?.id;
  const currentSessionId = req.headers['x-session-id'];

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onSessionTerminated = (payload) => {
    // If payload targets a session or user, filter here
    if (payload?.sessionId && currentSessionId && payload.sessionId !== currentSessionId) return;
    if (payload?.userId && authenticatedUserId && payload.userId !== authenticatedUserId) return;
    sendEvent('session_terminated', payload);
  };

  const onBroadcast = (payload) => {
    // Optional: allow global messages or filter by userId
    if (payload?.userId && authenticatedUserId && payload.userId !== authenticatedUserId) return;
    sendEvent('broadcast', payload);
  };

  const onUserUpdated = (payload) => {
    if (!authenticatedUserId) return;
    // send if it concerns this user or the admin screens (admin can get all)
    if (payload?.userId === authenticatedUserId || req.user.role === 'admin' || req.user.isOwner) {
      sendEvent('user_updated', payload);
    }
  };

  eventBus.on('session_terminated', onSessionTerminated);
  eventBus.on('broadcast', onBroadcast);
  eventBus.on('user_updated', onUserUpdated);

  // heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('session_terminated', onSessionTerminated);
    eventBus.off('broadcast', onBroadcast);
    eventBus.off('user_updated', onUserUpdated);
    res.end();
  });

  // initial hello
  sendEvent('ready', { ok: true, userId: authenticatedUserId });
});

module.exports = router;