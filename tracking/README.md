# WeeWonders tracking deployment — Lebanon

This theme intentionally contains **no Meta Pixel or CAPI access token**. A token in Liquid or JavaScript is public and must never be deployed in a theme.

## Required Shopify configuration

1. Deploy the private tracking endpoint described in the shared developer SOW. Store `META_CAPI_ACCESS_TOKEN` only in that endpoint's encrypted environment variables.
2. In Shopify Admin, open **Settings → Customer events → Add custom pixel** and paste `shopify-custom-pixel.js` after replacing `TRACKING_ENDPOINT` with the deployed HTTPS endpoint.
3. Create a Shopify webhook for `orders/paid` (and, if required, `orders/create`) to the same endpoint. The endpoint must emit `WW_Order` using `event_id = order_{order id}`.
4. Keep Shopify's Meta sales channel enabled while testing. Disable it only after Meta Events Manager shows one browser event and one server event deduplicated by the same event ID.

## Test matrix

- Product view → `ViewContent`
- Add to cart → `WW_AddToCart`
- Start checkout → `WW_Checkout`
- Payment submitted → `WW_Payment`
- Paid order webhook → `WW_Order`

The endpoint must reject unapproved fields. Send only the SOW-approved metadata: event ID/name, store, value, currency, item count, order ID, fbc/fbp, hashed contact data on the server, IP/UA on the server, country and source URL.
