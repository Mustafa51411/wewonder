import { BROWSER_EVENTS } from '../lib/tracking-config.js';
import { sendMetaEvent } from '../lib/meta-capi.js';
import { hasProcessedEvent, markEventProcessed } from '../lib/store.js';
import { applyCors, clientIp, safeAttribution, safeText } from '../lib/security.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body || {};
  const eventName = safeText(payload.event_name, 80);
  const eventId = safeText(payload.event_id, 160);

  if (!BROWSER_EVENTS.has(eventName)) return res.status(400).json({ error: 'Unsupported browser event' });
  if (!eventId) return res.status(400).json({ error: 'event_id is required' });

  if (await hasProcessedEvent(eventId)) return res.status(200).json({ ok: true, deduplicated: true });

  try {
    const attribution = safeAttribution(payload.attribution);
    const customData = {
      ...(payload.custom_data || {}),
      ...attribution,
      store: 'lb'
    };

    const result = await sendMetaEvent({
      eventName,
      eventId,
      eventTime: Number(payload.event_time) || Math.floor(Date.now() / 1000),
      eventSourceUrl: safeText(payload.event_source_url, 2048),
      clientIp: clientIp(req),
      clientUserAgent: safeText(req.headers['user-agent'], 512),
      fbc: safeText(payload.fbc, 512),
      fbp: safeText(payload.fbp, 512),
      customer: payload.customer || {},
      customData,
      testEventCode: safeText(payload.test_event_code, 200)
    });

    if (!result.success) {
      return res.status(503).json({ ok: false, configuration: result.reason });
    }

    await markEventProcessed(eventId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('CAPI browser event failed:', error.message);
    return res.status(502).json({ error: 'Unable to forward event' });
  }
}
