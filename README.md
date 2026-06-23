# ONX Intelligence

## Founder Alpha — Full Deployment

**Version:** founder-alpha-20260623
**Status:** DEPLOYED
**Sovereignty Score:** 71.67/100
**KSR:** 95.00%
**PDR:** 5.00%

---

## Quick Start

```bash
npm install
npm run db:push
npm run build
npm start
```

## Architecture

### Model Gateway
- 5 providers (OpenAI, OpenAI Fallback, Qwen, DeepSeek, Llama)
- ISES: 12-dimension source evaluation
- Provider Capital: 11-dimension capital profiles
- Sovereignty Loop: 5 pre-call questions
- Provider switching: configuration change only

### Tool Gateway
- 8 tools across 6 categories
- Tool replacement validation
- Sovereignty checks
- Runway integration via Tool Gateway only

### Intelligence Core
- 10 database tables
- 6 quality indices (UQI, JQI, WQI, ICI, OQI, IRS)
- Constitutional extensions integrated
- ISMF: KSR, PDR, KRR, KOR, SCG, SAI

## Deployment

See `deployment/founder-alpha/DEPLOYMENT.md`

## Author

Onur Aymac | Elite Vet Care Group
