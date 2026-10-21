import crypto from 'node:crypto';

const META_GRAPH_VERSION = 'v22.0';

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function hashValue(value, normalizer = (input) => String(input || '').trim().toLowerCase()) {
  const normalized = normalizer(value);
  return normalized ? sha256(normalized) : undefined;
}

const digits = (value) => String(value || '').replace(/\D/g, '').replace(/^0+/, '');
const compactLower = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '');

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function normalizedContents(contents) {
  return Array.isArray(contents)
    ? contents
      .map((item) => compact({
        id: String(item?.id || ''),
        quantity: Math.max(1, Number(item?.quantity || 1)),
        item_price: Number.isFinite(Number(item?.item_price)) ? Number(item.item_price) : undefined
      }))
      .filter((item) => item.id)
    : [];
}

export async function sendMetaEvent({
  eventName,
  eventId,
  eventTime = Math.floor(Date.now() / 1000),
  eventSourceUrl,
  actionSource = 'website',
  clientIp,
  clientUserAgent,
  fbc,
  fbp,
  customer = {},
  customData = {},
  testEventCode
}) {
  const pixelId = process.env.META_PIXEL_ID || '1032874294681740';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const resolvedTestEventCode = testEventCode || process.env.META_TEST_EVENT_CODE || process.env.TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    return {
      success: false,
      skipped: true,
      reason: 'META_CAPI_ACCESS_TOKEN must be configured on the tracking server'
    };
  }

  const contents = normalizedContents(customData.contents);
  const normalizedCustomData = compact({
    value: Number.isFinite(Number(customData.value)) ? Number(customData.value) : undefined,
    currency: customData.currency || undefined,
    order_id: customData.order_id || undefined,
    num_items: Number.isFinite(Number(customData.num_items)) ? Number(customData.num_items) : undefined,
    content_ids: Array.isArray(customData.content_ids) ? customData.content_ids.map(String).filter(Boolean) : undefined,
    content_type: customData.content_type || (contents.length ? 'product' : undefined),
    contents: contents.length ? contents : undefined,
    store: customData.store || 'lb',
    ref: customData.ref || undefined,
    whatsapp_reference: customData.whatsapp_reference || undefined,
    utm_source: customData.utm_source || undefined,
    utm_medium: customData.utm_medium || undefined,
    utm_campaign: customData.utm_campaign || undefined,
    utm_content: customData.utm_content || undefined,
    utm_term: customData.utm_term || undefined,
    ad_id: customData.ad_id || undefined
  });

  const userData = compact({
    em: hashValue(customer.email),
    ph: hashValue(customer.phone, digits),
    fn: hashValue(customer.first_name),
    ln: hashValue(customer.last_name),
    ct: hashValue(customer.city, compactLower),
    zp: hashValue(customer.zip, compactLower),
    country: hashValue(customer.country),
    external_id: hashValue(customer.external_id),
    client_ip_address: clientIp || undefined,
    client_user_agent: clientUserAgent || undefined,
    fbc: fbc || undefined,
    fbp: fbp || undefined
  });

  const body = {
    data: [{
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: actionSource,
      event_source_url: eventSourceUrl || undefined,
      user_data: userData,
      custom_data: normalizedCustomData
    }]
  };

  if (resolvedTestEventCode) body.test_event_code = resolvedTestEventCode;

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Meta CAPI rejected ${eventName}: ${result?.error?.message || response.status}`);
  }

  return { success: true, result };
}
