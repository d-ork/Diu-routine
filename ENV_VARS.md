# Environment Variables for Render Deployment

When deploying to Render, you need to set these environment variables:

## Required Variables

### `NODE_ENV`
- **Value:** `production`
- **Description:** Tells the app it's running in production mode

### `PORT`
- **Value:** `3000`
- **Description:** Port for the backend server (Render provides this automatically)

### `DATABASE_URL`
- **Value:** Get from Render PostgreSQL dashboard
- **Format:** `postgresql://user:password@host:port/database`
- **Example:** `postgresql://routine_user:abc123@dpg-xxxxx.oregon-postgres.render.com/routine_scrapper`
- **Description:** Connection string for PostgreSQL database

## Optional Variables

These are already configured in the Manus platform and don't need to be set for Render:

- `BUILT_IN_FORGE_API_KEY` - For AI features (if using)
- `BUILT_IN_FORGE_API_URL` - AI API endpoint
- `JWT_SECRET` - For user authentication
- `OAUTH_SERVER_URL` - OAuth provider URL

## How to Set in Render

1. Go to your web service dashboard
2. Click "Environment" tab
3. Click "Add Environment Variable"
4. Enter the key and value
5. Click "Save Changes"

The service will automatically redeploy with the new variables.
