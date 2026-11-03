# Minecraft Server Portal

A modern, high-performance community Minecraft server portal featuring Java & Bedrock edition cross-play details, connection guides, an administrative dashboard, and a 100% free APK distribution system.

Designed for seamless deployment on **Render** as two decoupled services with **zero paid services and zero extra cloud accounts required**:
1. **Frontend**: Static Site (deployed at [https://minecraftjnb.onrender.com](https://minecraftjnb.onrender.com)).
2. **Backend**: Lightweight Node.js / Express Web Service with `/api/health`.

---

## Key Features

- **Dark Fantasy Minecraft Aesthetic**: Charcoal, obsidian, and deep forest backgrounds with emerald green (`#10b981`) and diamond cyan (`#06b6d4`) accents, glowing buttons, and ambient motes.
- **Java Edition Support**:
  - Highlights version **26.3**, **TLauncher** support, and **Aternos** cloud hosting.
  - Server address and port with 1-click clipboard copy buttons and animated feedback.
  - Interactive accordion connection guide.
- **Bedrock Edition Support**:
  - Android & Bedrock cross-play devices and **Aternos** hosting.
  - Displays Bedrock Server IP and Port separately with independent copy buttons.
  - Step-by-step tutorial on adding an external server in Bedrock.
- **100% Free APK Distribution (Google Drive, GitHub Releases, MediaFire)**:
  - Host your ~400MB APK for free on Google Drive, MediaFire, Mega, or GitHub Releases.
  - Paste the direct download link in the Admin Dashboard.
  - **SHA-256 Checksum**: The admin panel automatically computes the file size and cryptographic SHA-256 hash when you select your local APK.
  - **Dynamic Visibility**: Automatically stays hidden until an administrator publishes an authorized link. Never bundles unauthorized APKs inside the Git repository.
- **Protected Administrator Dashboard**:
  - Secure login with bcrypt password hashing and signed JWT sessions.
  - Edit Java & Bedrock server addresses, ports, supported versions, and announcements.
  - Track real-time download statistics.
- **Render Resilience**:
  - Frontend static assets render instantly.
  - Unobtrusive network status pill polls the backend during Render free-tier cold starts without covering the screen with a blackout loading veil.

---

## Render Backend Web Service Setup

1. In [dashboard.render.com](https://dashboard.render.com/), click **New +** > **Web Service**.
2. Select your repository: **`Rookie2345/minecraft`**.
3. Settings:
   - **Name**: `minecraft-backend` *(or any name you choose)*
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Add Environment Variables:
   - `FRONTEND_URL`: `https://minecraftjnb.onrender.com`
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: *(Your preferred password)*
   - `JWT_SECRET`: *(Any random string, e.g. `super_secret_portal_key_123456789`)*
5. Click **Create Web Service**.
