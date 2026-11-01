# LiveProof (working name)

> Your PayPal payment only goes to the person who just proved, live on camera, that they have the item.

Built for the PayPal AI Hackathon 2026. Work in progress.

## The problem
Strangers trading on Reddit, Facebook Marketplace and forums rely on "timestamp" photos to prove the seller has the item, and on PayPal Goods & Services to protect the buyer. In October 2026 the moderators of r/hardwareswap reported that AI-generated timestamps and compromised PayPal accounts are now common.

## How it works (planned)
1. The seller logs in with PayPal, which binds their verified PayPal account.
2. The seller completes a short live camera challenge with the item in frame.
3. The buyer pays with PayPal, and the order's payee is locked to the verified account.

## Run locally
```bash
cp .env.example .env.local   # fill in your PayPal sandbox credentials
npm install
npm run dev
```

PayPal's dashboard only accepts an `https://` return URL for Log in with PayPal, so the login flow is tested on the deployed URL.

## License
MIT
