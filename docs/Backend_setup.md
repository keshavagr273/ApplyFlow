# Backend Setup Guide

This document describes how to configure, run, and host the ApplyFlow extension services and optional backend integrations (such as the database synchronization service and Supabase connections).

## Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js**: Version 18.x or later (LTS recommended)
- **npm**: Version 9.x or later (bundled with Node.js)

---

## 1. Running the Extension Locally

Since ApplyFlow is a client-side Chrome Extension, the main "backend" components (like database syncing and AI integrations) run locally in the background service worker.

### Installation

Clone the repository and install dependencies:
```bash
npm install
```

### Running in Development Mode
To start the Vite development server with hot-reload for option page / popup views:
```bash
npm run dev
```

### Building for Production
To bundle the extension and package it into a zip file ready for the Chrome Web Store:
```bash
npm run build
```
This builds the files into the `dist` directory.

---

## 2. Setting Up an API/Mock Server for testing

If you need a local development mock server (e.g., to proxy AI calls or mock third-party forms):
1. Create a script in `scratch/mock-server.js` or run a local Express/Node app on port `3000`.
2. Start it:
   ```bash
   node scratch/mock-server.js
   ```

---

## 3. Hosting & Deployment Guidelines

Since ApplyFlow is a Google Chrome Extension, you host the client bundle directly in the Chrome Web Store. However, any backend API proxies or Supabase database endpoints must be hosted on cloud providers.

### Option A: Static Frontend Hosting (for Options/Dashboard landing page)
If you publish a web version of the dashboard, you can host the build outputs on:
- **Vercel**: Push to GitHub, import the project, and Vercel will automatically deploy using `npm run build` with output directory `dist`.
- **Netlify**: Set build command to `npm run build` and publish directory to `dist`.
- **GitHub Pages**: Build the project and deploy the build folder using the `gh-pages` branch.

### Option B: Node.js API Hosting (e.g., Express Proxy servers)
If you build a Node.js backend proxy to secure API keys (like Groq or Gemini keys):
- **Render.com**: Create a new Web Service, link your GitHub repository, choose `Node` environment, and set:
  - **Build Command**: `npm install`
  - **Start Command**: `node server.js`
- **Heroku**: Deploy via the Heroku Git CLI. Heroku detects the `package.json` file and starts the web dyno automatically.
- **AWS (Elastic Beanstalk or EC2)**: Package the Node application and configure a reverse proxy (like Nginx) routing traffic to port `3000`.
