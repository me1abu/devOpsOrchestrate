# 🚀 Deploy Kestra to Railway

## Step-by-Step Deployment Instructions

### 1. **Create Railway Account**
- Go to https://railway.app
- Sign up and log in

### 2. **Create New Project**
- Click "New Project"
- Choose "Deploy from GitHub repo"

### 3. **Create GitHub Repository for Kestra**
```bash
# Create a new GitHub repository
echo "# Kestra Deployment" >> README.md
git init
git add .
git commit -m "Initial Kestra deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kestra-deployment.git
git push -u origin main
```

### 4. **Connect Repository to Railway**
- Select your `kestra-deployment` repository
- Railway will automatically detect the Dockerfile

### 5. **Add PostgreSQL Database**
- In Railway dashboard, go to your project
- Click "Add" → "Database" → "PostgreSQL"
- Note the connection URL (Railway provides this as `DATABASE_URL`)

### 6. **Configure Environment Variables**
In Railway project settings, add these environment variables:

```bash
# Required Database (Railway auto-provides)
DATABASE_URL=postgresql://postgres:xxxxx@containers-us-west-xxx.railway.app:xxxx/railway

# Authentication
KESTRA_USERNAME=admin@kestra.io
KESTRA_PASSWORD=your_secure_password_here

# OpenAI for AI features (optional)
OPENAI_API_KEY=your_openai_api_key

# Kestra Configuration
KESTRA_URL=https://your-app-name.railway.app

# GitHub Integration (optional)
GITHUB_CLIENT_ID=your_github_app_client_id
GITHUB_CLIENT_SECRET=your_github_app_client_secret

# Webhook Secret (generate random string)
WEBHOOK_SECRET=your_random_secret_string
```

### 7. **Deploy**
- Railway will build and deploy automatically
- Check deployment logs for any errors
- Access your Kestra instance at the provided Railway URL

### 8. **Verify Deployment**
1. Visit your Railway URL (e.g., `https://your-kestra-app.railway.app`)
2. Login with `admin@kestra.io` and your configured password
3. Check that flows can be imported and executed

### 9. **Configure Vercel Environment Variable**
Once deployed, your `NEXT_PUBLIC_KESTRA_URL` will be:
```
https://your-kestra-app-name.railway.app
```

---

## 📝 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection (Railway provides) | `postgresql://postgres:...` |
| `KESTRA_USERNAME` | Yes | Admin username | `admin@kestra.io` |
| `KESTRA_PASSWORD` | Yes | Admin password | `your_secure_password` |
| `KESTRA_URL` | Yes | Public URL of your Kestra instance | `https://your-app.railway.app` |
| `OPENAI_API_KEY` | Optional | For AI-powered workflows | `sk-proj-...` |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth App ID | `Iv1.xxxx` |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth App Secret | `xxxxx` |
| `WEBHOOK_SECRET` | Optional | Security secret for webhooks | `random_string_123` |

---

## 🔧 Troubleshooting

### Common Issues:

1. **Build Failures**: Check Railway logs for missing dependencies
2. **Database Connection**: Ensure PostgreSQL is properly linked
3. **Port Issues**: Railway automatically assigns ports, ensure Dockerfile exposes 8080
4. **Environment Variables**: Double-check all required variables are set

### Useful Commands:
```bash
# Check Railway logs
railway logs

# Restart deployment
railway restart

# Check environment variables
railway variables
