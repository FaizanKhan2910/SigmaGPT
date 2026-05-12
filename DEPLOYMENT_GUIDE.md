# SigmaGPT Deployment Guide 🚀

This guide explains how to deploy your monolithic, single-link full-stack application (React + Express) to **Render.com**.

Because your repository is set up with a root `package.json`, Render can natively install packages for both ends, build the frontend, and run the backend sequentially from one trigger.

---

## 1. Preparing the Codebase

1. Ensure all your changes are pushed to your GitHub `main` branch. 
   *(This repo is fully configured if you have the root `package.json` and the static serving block in `ChatgptBackend/server.js`.)*

## 2. Deploying on Render

Instead of deploying static files and backend instances separately, we deploy the whole repo as a unified **Web Service**.

1. Create a free account or log into [Render.com](https://render.com).
2. From the dashboard, click **"New +" -> "Web Service"**.
3. Select **"Build and deploy from a Git repository"** and connect your `SigmaGPT` repository.
4. On the deployment configuration screen, fill out these fields precisely:
   - **Name:** *sigmagpt-app* (or any name you prefer)
   - **Root Directory:** *(Leave this completely blank so Render targets the root folder!)*
   - **Environment:** `Node`
   - **Build Command:** `npm run install-all && npm run build`
   - **Start Command:** `npm start`
5. Select the **Free** instance tier (or whichever tier suits your needs).

## 3. Configuring Environment Variables (Crucial!)

Before clicking Create, scroll down to the **Environment Variables** section. Your application will crash if these are missing.

1. Click **"Advanced"**.
2. **Add all your Backend Keys:** Open your local `ChatgptBackend/.env` file and manually copy-paste every single secret into Render (e.g., `MONGO_URI`, `JWT_SECRET_KEY`, `GEMINI_API_KEY`, etc.). *Never commit these to GitHub!*
3. **Add the Frontend Key:** Click "Add Environment Variable" and input the following:
   - **Key:** `VITE_SERVER_URL`
   - **Value:** `/`
   *(Setting this to `/` ensures your Vite frontend dynamically points its API requests to the same URL the app is hosted on).*

## 4. Launching!

Click **"Create Web Service"**.

**What happens next?**
1. Render will run `npm run install-all` which automatically enters both `Chatgpt/` and `ChatgptBackend/` to download modules.
2. Render triggers `npm run build` which packages your React code from `Chatgpt/` into a `dist/` folder.
3. Render runs `npm start` which boots up `node ChatgptBackend/server.js`.
4. Your server will intercept any backend `/api` requests, and smoothly serve the `dist/index.html` frontend React files for normal web traffic (including React-Router deep links)!

Congratulations! Your app should now be fully live on your `.onrender.com` link.
