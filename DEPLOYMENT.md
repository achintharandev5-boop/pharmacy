# Deployment Guide

This guide explains how to deploy the Pharmacy Label Software.
The frontend (`apps/web`) is deployed to Vercel, and the backend (`apps/api`) is deployed to Render.

## 1. Backend Deployment (Render)

Render is recommended for the NestJS API as it natively supports Node.js web services and provides a simple, automated deployment pipeline from GitHub.

### Prerequisites
1. Create an account on [Render](https://render.com/).
2. Connect your GitHub account to Render.

### Steps
1. In the Render Dashboard, click **New +** and select **Web Service**.
2. Connect the GitHub repository for this project.
3. Configure the service:
   - **Name**: `pharmacy-label-api` (or your preferred name)
   - **Root Directory**: `apps/api`
   - **Environment**: Node
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start:prod`
4. Set the Environment Variables. **Do not use default or example values!** You must provide actual credentials.
   - `PORT`: `3001` (Render usually sets this automatically, but you can explicitly specify it)
   - `SUPABASE_URL`: Your Supabase Project URL (e.g., `https://[PROJECT-REF].supabase.co`) ⚠️ **Needs real value**
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key ⚠️ **Needs real secret value**
   - `FRONTEND_URL`: The URL of your deployed Vercel frontend (e.g., `https://pharmacy-label-web.vercel.app`). *Note: Set this after deploying the frontend.* ⚠️ **Needs real value**
5. Click **Create Web Service**. Render will build and deploy your NestJS API.
6. Once deployed, note the Render URL (e.g., `https://pharmacy-label-api.onrender.com`).

## 2. Frontend Deployment (Vercel)

Vercel is the recommended platform for the Next.js frontend.

### Prerequisites
1. Create an account on [Vercel](https://vercel.com/).
2. Connect your GitHub account to Vercel.

### Steps
1. In the Vercel Dashboard, click **Add New...** -> **Project**.
2. Import the GitHub repository for this project.
3. Configure the project:
   - **Project Name**: `pharmacy-label-web`
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
4. Set the Environment Variables. **Do not use default or example values!**
   - `NEXT_PUBLIC_API_URL`: The Render URL of your deployed API (e.g., `https://pharmacy-label-api.onrender.com`) ⚠️ **Needs real value**
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL ⚠️ **Needs real value**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key ⚠️ **Needs real value**
5. Click **Deploy**. Vercel will build and deploy your Next.js application.

## 3. Final Integration (CORS Configuration)

By default, the backend API is locked down. It will only accept cross-origin requests from the origins specified in the `FRONTEND_URL` environment variable.

1. After your frontend is successfully deployed to Vercel, copy its production URL.
2. Go back to your Render Dashboard for the API service.
3. Under **Environment**, update or add the `FRONTEND_URL` variable with your Vercel URL.
4. Render will automatically redeploy the service to apply the updated environment variables.

## Rollback Procedures

### Rolling Back the Frontend (Vercel)
1. Go to your project on the Vercel Dashboard.
2. Navigate to the **Deployments** tab.
3. Find the previous deployment you want to revert to.
4. Click the three dots (`...`) next to the deployment and select **Promote to Production** (or **Redeploy**).

### Rolling Back the Backend (Render)
1. Go to your Web Service on the Render Dashboard.
2. Navigate to the **Events** tab.
3. Find the deployment you want to revert to.
4. Click **Deploy This Commit**.
