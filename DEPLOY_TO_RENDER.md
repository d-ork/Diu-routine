# Deploy to Render Guide

This guide will help you deploy the Routine Scrapper backend to Render for permanent hosting.

## Prerequisites

- Render account (sign up at [render.com](https://render.com) - free tier available)
- GitHub account
- This project code pushed to a GitHub repository

## Step 1: Push Code to GitHub

1. Create a new GitHub repository (e.g., `routine-scrapper-ios`)
2. Push this project code to the repository:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/routine-scrapper-ios.git
git push -u origin main
```

## Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

## Step 3: Deploy Database

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name:** `routine-scrapper-db`
   - **Database:** `routine_scrapper`
   - **User:** `routine_user`
   - **Region:** Oregon (US West)
   - **Plan:** Free
3. Click **"Create Database"**
4. Wait for database to be provisioned (~2 minutes)
5. Copy the **Internal Database URL** (starts with `postgresql://`)

## Step 4: Deploy Backend API

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `routine-scrapper-api`
   - **Region:** Oregon (US West)
   - **Branch:** `main`
   - **Root Directory:** leave empty
   - **Runtime:** Node
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `pnpm start`
   - **Plan:** Free

4. Add Environment Variables:
   - Click **"Advanced"** → **"Add Environment Variable"**
   - Add these variables:
     ```
     NODE_ENV=production
     DATABASE_URL=<paste the Internal Database URL from Step 3>
     PORT=3000
     ```

5. Click **"Create Web Service"**
6. Wait for deployment (~5-10 minutes)

## Step 5: Get Your Backend URL

After deployment completes:
1. Your backend URL will be: `https://routine-scrapper-api.onrender.com`
2. Test it by visiting: `https://routine-scrapper-api.onrender.com/health`
3. You should see: `{"status":"ok","timestamp":"...","uptime":...}`

## Step 6: Update Mobile App

Update the mobile app to use your Render backend URL:

1. Open `lib/trpc.ts`
2. Change the API URL from:
   ```typescript
   const apiUrl = "http://127.0.0.1:3000";
   ```
   to:
   ```typescript
   const apiUrl = "https://routine-scrapper-api.onrender.com";
   ```

3. Save and restart Expo dev server

## Step 7: Test the App

1. Open the app in Expo Go
2. Search for a section (e.g., "71_I")
3. It should now fetch data from your Render backend!

## Important Notes

### Free Tier Limitations
- **Spin down after 15 minutes of inactivity** - First request after inactivity takes 30-60 seconds
- **750 hours/month** - Enough for testing and personal use
- **Database:** 1GB storage, 97 hours/month

### Keeping the Server Awake
To prevent spin-down, you can:
1. Use a service like [UptimeRobot](https://uptimerobot.com) to ping your `/health` endpoint every 14 minutes
2. Upgrade to Render's paid plan ($7/month) for always-on service

### Updating Your App
When you make changes:
1. Push to GitHub: `git push`
2. Render auto-deploys from `main` branch
3. Wait 2-3 minutes for deployment
4. App automatically uses the updated backend

## Troubleshooting

### "Service Unavailable" Error
- Wait 60 seconds - server is spinning up from sleep
- Check Render dashboard for deployment errors

### "Database Connection Failed"
- Verify `DATABASE_URL` environment variable is set correctly
- Check database is running in Render dashboard

### App Still Uses Local Server
- Make sure you updated `lib/trpc.ts` with Render URL
- Restart Expo dev server
- Clear app cache (pull-to-refresh)

## Need Help?

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Verify environment variables are set correctly
3. Test the `/health` endpoint to confirm server is running

---

**Congratulations!** Your app now has a permanent backend that works reliably without sandbox resets.
