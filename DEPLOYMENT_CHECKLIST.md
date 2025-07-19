# Vercel Deployment Checklist

## Pre-Deployment ✅
- [x] Fixed `vercel.json` configuration
- [x] Updated to use proper Node.js runtime (18.x)
- [x] Configured CORS headers and API rewrites
- [x] Created environment variables template
- [x] Added deployment status test endpoint
- [x] Validated API routing structure (8 endpoints)
- [x] Verified build process works locally
- [x] Incremented version to trigger redeployment

## Post-Deployment Actions Required

### 1. Environment Variables Setup
Configure these in Vercel Dashboard → Project → Settings → Environment Variables:

**Required:**
- `VITE_BUNNY_API_KEY`: Your Bunny.net API key
- `SUPABASE_URL`: Your Supabase project URL  
- `NEXT_PUBLIC_SUPABASE_URL`: Same as SUPABASE_URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

**Database (if using Supabase):**
- `POSTGRES_URL`: Connection string with pooling
- `POSTGRES_PRISMA_URL`: Connection string for Prisma
- `POSTGRES_URL_NON_POOLING`: Direct connection string

**Optional:**
- `GOOGLE_SHEETS_SPREADSHEET_ID`: For sheet integration
- `GOOGLE_SHEETS_CREDENTIALS_JSON`: Service account credentials
- `GOOGLE_SHEET_NAME`: Sheet name (default: OPERATIONS)

### 2. Verification Tests
After environment variables are set:

1. **Basic deployment test:**
   ```
   curl https://your-domain.vercel.app/api/deployment-status
   ```

2. **API authentication test:**
   ```
   curl -H "AccessKey: your_api_key" https://your-domain.vercel.app/api/auth-check
   ```

3. **Bunny CDN proxy test:**
   ```
   curl -H "AccessKey: your_api_key" https://your-domain.vercel.app/api/proxy/base/videolibrary
   ```

### 3. Frontend Verification
- [ ] Main application loads correctly
- [ ] API calls from frontend work
- [ ] File upload functionality works
- [ ] Video library fetching works (PR #10 fixes)

### 4. Monitoring
- [ ] Check Vercel function logs for any errors
- [ ] Monitor API response times
- [ ] Verify CORS headers are working for cross-origin requests

## Troubleshooting

If deployment fails:
1. Check Vercel build logs for errors
2. Verify all environment variables are set correctly
3. Ensure API key has proper permissions in Bunny.net dashboard
4. Check function timeout limits (current default is 10s)

## Success Criteria
- [ ] Deployment completes without errors
- [ ] `/api/deployment-status` returns success response
- [ ] Bunny CDN API proxying works
- [ ] Frontend can communicate with backend APIs
- [ ] No CORS errors in browser console

---

**Note:** The deployment will automatically trigger when these changes are pushed to GitHub, thanks to Vercel's GitHub integration.