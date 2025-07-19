# API Endpoints Verification for Vercel Deployment

## Test Endpoints

After deployment, test these endpoints to verify the API routing is working correctly:

### 1. Deployment Status Check
```
GET /api/deployment-status
```
Returns deployment status and timestamp. Should work immediately after deployment.

### 2. Authentication Check
```
GET /api/auth-check
Headers: AccessKey: your_bunny_api_key
```
Tests API key validation with Bunny.net credentials.

### 3. Bunny CDN Video Library
```
GET /api/proxy/base/videolibrary
Headers: AccessKey: your_bunny_api_key
Query: ?page=1&perPage=10
```
Proxies requests to Bunny.net video library API.

### 4. General Bunny CDN Base API
```
GET /api/proxy/base/{endpoint}
Headers: AccessKey: your_bunny_api_key
```
General proxy for Bunny.net base API endpoints.

### 5. Bunny CDN Video API
```
GET /api/proxy/video/{endpoint}
Headers: AccessKey: your_bunny_api_key
```
Proxy for Bunny.net video-specific API endpoints.

## Expected Behavior

1. **CORS Headers**: All endpoints should return proper CORS headers
2. **Environment Fallback**: API endpoints use environment variables if no AccessKey header provided
3. **Error Handling**: Proper error responses with status codes and messages
4. **Logging**: Comprehensive logging for debugging (visible in Vercel function logs)

## Environment Variables Required

Ensure these are configured in Vercel dashboard:
- `VITE_BUNNY_API_KEY`: Your Bunny.net API key
- `SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_URL`: Same as above (for client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

## Testing Command

After deployment, run:
```bash
curl -X GET "https://your-vercel-domain.vercel.app/api/deployment-status"
```

Should return:
```json
{
  "status": "success",
  "message": "Vercel deployment working correctly",
  "timestamp": "2025-07-19T...",
  "deployment": "vercel-fix-v0.0.1",
  "environment": "production"
}
```