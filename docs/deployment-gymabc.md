# GymABC Deployment Setup

Deploy a branded, GymABC-only version for direct client access (separate from the public Vercel app).

## Overview

- **Public app** (https://gymx-xyz.vercel.app): Metabox admin, all gyms, demo
- **GymABC app** (https://gymabc.example.com): Direct login, GymABC branding only, no gym switcher

Both connect to the same database and share code — difference is configuration.

## Option 1: Separate Vercel Project (Recommended)

**Pros:** Separate URLs, easier to manage independently, can have different team access
**Cons:** Two Vercel projects to manage

### Setup

**1. Create a second Vercel project**

On vercel.com:
- Click "Add New" → "Project"
- Import the same GitHub repo (`Abdullah-MetaBox/gymX`)
- Name it something like `gymx-gymabc`
- Root directory: `apps/admin`

**2. Add environment variables** (same as public app)

```
DATABASE_URL          = (same as public)
APP_DATABASE_URL      = (same as public)
AUTH_SECRET           = (same as public)
AUTH_URL              = https://gymabc.example.com (or your actual domain)
BLOB_READ_WRITE_TOKEN = (same as public)
CRON_SECRET           = (same as public)
GYMABC_MODE           = true  ← NEW: Hide gym switcher, brand as GymABC
```

**3. Deploy**

Vercel will auto-build and deploy.

**4. Custom domain (optional)**

In Vercel project settings:
- Go to Domains
- Add your custom domain (e.g., `gymabc.example.com` or `app.gymabc.mu`)
- Point DNS there

## Option 2: Environment Groups (Simpler, but same URL)

**Pros:** Single Vercel project, less overhead
**Cons:** Same base URL, need to switch environments

### Setup

On Vercel, in your existing `gymx` project:

**1. Create an environment group**

Settings → Environment Variables:
- Create a new group called `gymabc-client`
- Add the same 7 environment variables (set `GYMABC_MODE = true`)

**2. Deploy from that group**

You can promote a branch deployment with these variables, or use Vercel's environment configuration.

## Branding Configuration

The gym's look is stored in the database (`gyms.branding` JSONB field).

### GymABC branding (already seeded)

In the database, Gym ABC has branding:
```json
{
  "primaryColor": "#FF6B35",    // Orange
  "accentColor": "#004E89",     // Dark blue
  "logoUrl": "https://..."       // If you upload a logo
}
```

### To customize logo/colors:

**Option A: Via Vercel Blob (Phase 1)**
Upload logo to Vercel Blob, then update the gym in the database.

**Option B: Direct URL**
Point `logoUrl` to GymABC's domain if they host it.

**Option C: Update in code (dev only)**
Modify the seed pack in `packages/db/src/seed.ts`:
```ts
branding: {
  primaryColor: '#FF6B35',
  accentColor: '#004E89',
  logoUrl: 'https://gymabc.mu/logo.png',
},
```

## Sign-in Page Customization

### Current behavior:
- Shows generic "GymX" header
- Mentions "GymABC" in the seeded data

### To add GymABC branding to sign-in:

**File: `apps/admin/src/app/sign-in/page.tsx`**

Add a check for `GYMABC_MODE`:

```tsx
import { env } from '@/lib/env';

export default function SignInPage() {
  const isGymABCMode = env.GYMABC_MODE;
  
  return (
    <div>
      <header>
        {isGymABCMode ? (
          <h1>GymABC Member Portal</h1>
        ) : (
          <h1>GymX Platform</h1>
        )}
      </header>
      {/* rest of sign-in form */}
    </div>
  );
}
```

## Testing Before Launch

### 1. Local test with GYMABC_MODE
```bash
GYMABC_MODE=true pnpm dev
```

- Sign in as `manager@gymabc.mu`
- Verify:
  - Gym switcher is gone ✓
  - Still shows "Gym ABC" in header ✓
  - All functionality works ✓

### 2. On Vercel staging

Deploy to Vercel with `GYMABC_MODE=true`:
- Test login
- Test member list, subscriptions, payments
- Verify styling matches GymABC colors

### 3. Client UAT

Share the link with GymABC team:
- "Can you sign in as manager@gymabc.mu with password GymX!dev2026?"
- Gather feedback on branding, layout, missing features

## Go-Live Checklist

- [ ] Auth.js `AUTH_URL` points to correct domain
- [ ] `GYMABC_MODE=true` set in Vercel environment
- [ ] Logo/colors in database match GymABC brand
- [ ] Sign-in page shows "GymABC" not "GymX"
- [ ] Gym switcher hidden ✓
- [ ] Test login works ✓
- [ ] Test member lookup works ✓
- [ ] Test payment recording works ✓
- [ ] Accountant read-only access verified ✓
- [ ] Backup: if deployment fails, public Vercel app still works ✓

## Multi-Gym Future

When you have multiple tenants (next gyms), you have two options:

### Option A: Shared deployment
- Keep `GYMABC_MODE=false`
- Each gym can log in, see their gym by default
- Accountant from Gym B can see their data
- No branding customization (shows "GymX")

### Option B: Separate deployments
- Deploy once per gym
- Each with `GYMABC_MODE=true` + their own `AUTH_URL` domain
- Each branded to their gym
- More infrastructure, more isolated

---

## Environment Variables Summary

| Variable | Public | GymABC | Purpose |
|----------|--------|--------|---------|
| `DATABASE_URL` | ✓ | ✓ | Neon direct (migrations) |
| `APP_DATABASE_URL` | ✓ | ✓ | Neon pooled (app) |
| `AUTH_SECRET` | ✓ | ✓ | JWT signing key |
| `AUTH_URL` | https://gymx-xyz.vercel.app | https://gymabc.example.com | Auth redirect origin |
| `BLOB_READ_WRITE_TOKEN` | ✓ | ✓ | File uploads (Phase 1) |
| `CRON_SECRET` | ✓ | (optional) | Job authentication |
| `GYMABC_MODE` | false | **true** | Hide gym switcher |

---

## Rollback / Troubleshooting

**Sign-out redirects to localhost?**
→ Check `AUTH_URL` in Vercel environment

**Gym switcher still visible?**
→ Check `GYMABC_MODE=true` is actually set in Vercel

**Logo not showing?**
→ Check `logoUrl` in database is correct, CDN is accessible

**Members not loading?**
→ Check `APP_DATABASE_URL` points to right Neon region; check RLS policies
