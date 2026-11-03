# Minecraft Server Portal

A modern, high-performance community Minecraft server portal featuring Java & Bedrock edition cross-play details, connection guides, an administrative dashboard, and a direct-to-Cloudflare-R2 multipart APK upload and download system.

Designed for seamless deployment on **Render** as two decoupled services:
1. **Frontend**: Static Site (loads immediately, non-blocking, zero cold-start delay).
2. **Backend**: Node.js / Express Web Service with `/api/health`, Neon PostgreSQL, and Cloudflare R2 S3-compatible object storage.

---

## Key Features

- **Dark Fantasy Minecraft Aesthetic**: Charcoal, obsidian, and deep forest backgrounds with emerald green & diamond cyan accents, glowing buttons, and ambient motes.
- **Java Edition Support**:
  - Version 26.3, TLauncher support, Aternos hosting badge.
  - Server address and port with 1-click clipboard copy and interactive connection guide.
- **Bedrock Edition Support**:
  - Android and Bedrock cross-play devices.
  - Separate Bedrock server address and port with 1-click copy buttons.
  - Step-by-step tutorial on adding external servers in Minecraft Bedrock.
- **Authorized Large-File APK Upload & Download (~400 MB to 1 GB)**:
  - **Browser-to-R2 Direct Upload**: Uploads directly from the browser to Cloudflare R2 via presigned chunked multipart URLs. Render's memory and disk are never burdened.
  - **SHA-256 Checksum Verification**: Enforces cryptographic integrity hashing before upload and displays checksums for visitor verification.
  - **Direct Presigned Downloads**: Downloads are served directly via Cloudflare R2 presigned URLs.
  - **Ownership & Auth Enforcement**: Multipart endpoints are protected by administrator JWT authentication and ownership validation.
  - Only displayed on the homepage when an authorized file is actively published.
- **Protected Administrator Dashboard**:
  - Secure login with bcrypt password hashing and JWT sessions.
  - Edit Java & Bedrock server addresses, ports, supported versions, and announcements.
  - Track upload progress (speed, elapsed time, percentage) and monitor download statistics.
- **Independent Frontend Resilience**:
  - Frontend static assets render instantly.
  - Unobtrusive network status pill polls the backend during Render free-tier cold starts without covering the screen with a blackout loading veil.

---

## Repository Structure

```
.
├── frontend/                  # Render Static Site
│   ├── index.html             # Public community portal
│   ├── admin.html             # Protected admin panel
│   ├── css/
│   │   ├── style.css          # Dark fantasy styling & glassmorphism
│   │   └── admin.css          # Admin dashboard UI
│   └── js/
│       ├── config.js          # Dynamic API endpoint detection
│       ├── app.js             # Public portal logic & non-blocking polling
│       ├── admin.js           # R2 multipart uploader & settings manager
│       └── particles.js       # Subtle ambient Minecraft pixel motes
├── backend/                   # Render Web Service
│   ├── server.js              # Express entry point (PORT, 0.0.0.0, /api/health)
│   ├── package.json           # Node.js dependencies
│   ├── .env.example           # Environment template
│   └── src/
│       ├── config/
│       │   ├── db.js          # Neon PostgreSQL pool & auto-migrations
│       │   └── r2.js          # Cloudflare R2 S3-compatible service
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── serverController.js
│       │   └── apkController.js
│       ├── middleware/
│       │   ├── auth.js        # JWT admin verification
│       │   └── security.js    # Helmet, CORS, and rate limiting
│       └── routes/
│           ├── api.js         # Central router & /health
│           ├── auth.js
│           ├── server.js
│           └── apk.js
├── .gitignore
└── README.md
```

---

## Local Development Setup

### 1. Prerequisites
- Node.js v18+ (tested on Node.js v24)
- Git

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm start
```

The backend server starts on `http://localhost:4000`.
Health check: `http://localhost:4000/api/health`.

### 3. Frontend Setup
Open `frontend/index.html` in your browser (or use VS Code Live Server / Python HTTP server):
```bash
cd frontend
# Optional simple static server:
npx serve -l 5500 .
```

Access the public portal at `http://localhost:5500` and the admin dashboard at `http://localhost:5500/admin.html`.

---

## Cloudflare R2 Bucket CORS Configuration

In the Cloudflare dashboard:
1. Navigate to **R2** > Select your bucket (`minecraft-storage`) > **Settings** > **CORS Policy**.
2. Add the following CORS configuration:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5500",
      "https://*.onrender.com"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

> **Important**: The `ExposeHeaders: ["ETag"]` directive is required so the browser can read the chunk ETags to complete multipart uploads.

---

## Render Deployment Guide

### Service 1: Frontend (Static Site)
- **Type**: Static Site
- **Root Directory**: `frontend`
- **Build Command**: *(leave empty)*
- **Publish Directory**: `.`

### Service 2: Backend (Web Service)
- **Type**: Web Service
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `PORT`: `4000`
  - `NODE_ENV`: `production`
  - `FRONTEND_URL`: URL of your deployed Frontend Static Site
  - `DATABASE_URL`: Connection string from Neon PostgreSQL
  - `JWT_SECRET`: Random 32+ character string
  - `ADMIN_USERNAME`: Desired admin username
  - `ADMIN_PASSWORD`: Secure admin password
  - `R2_ACCOUNT_ID`: Cloudflare Account ID
  - `R2_ACCESS_KEY_ID`: Cloudflare R2 Access Key ID
  - `R2_SECRET_ACCESS_KEY`: Cloudflare R2 Secret Access Key
  - `R2_BUCKET_NAME`: Bucket name in Cloudflare R2
