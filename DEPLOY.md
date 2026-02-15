# Deploy Trip Tracker to Vercel

Use this when you want to run the app in the browser (e.g. on your phone via a saved link or “Add to Home Screen”) instead of Expo Go.

## 1. Push your code to GitHub

From the **trip-tracker** folder (or repo root):

```bash
git add .
git commit -m "Add Vercel config and web build"
git push origin main
```

If your repo is **TripTracker** with a **trip-tracker** folder inside, push from the repo root so GitHub has the full repo.

## 2. Connect the repo to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest).
2. Click **Add New…** → **Project**.
3. **Import** your **TripTracker** (or trip-tracker) GitHub repo.
4. **Root Directory:**  
   - If the repo root is the folder that contains `package.json` and `app/`, leave blank.  
   - If the repo root is the parent (e.g. `TripTracker`) and the app is in `trip-tracker`, set **Root Directory** to `trip-tracker`.
5. **Build and Output:**  
   Vercel should pick these up from `vercel.json`:
   - Build Command: `npx expo export --platform web`
   - Output Directory: `dist`
6. **Environment variables:**  
   In **Settings → Environment Variables**, add:
   - `EXPO_PUBLIC_SUPABASE_URL` = your Supabase project URL  
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon/public key  
   - (Optional) `EXPO_PUBLIC_MAPBOX_TOKEN` if you use maps  
   Apply to **Production** (and Preview if you want).
7. Click **Deploy**.

## 3. Use it on your phone

- Open the Vercel URL (e.g. `https://trip-tracker-xxx.vercel.app`) in your phone browser.
- **“Login icon” / app shortcut:**  
  - **iOS Safari:** Share → **Add to Home Screen**.  
  - **Android Chrome:** Menu (⋮) → **Add to Home screen** or **Install app**.  
  You’ll get an icon that opens the app in the browser (or in a browser window if the device supports it).

## 4. Later changes

Push to `main` (or the branch you connected). Vercel will build and deploy automatically.

## Troubleshooting

- **Build fails:** Check the Vercel build logs. Ensure **Root Directory** points to the folder that has `package.json` and `app/`.
- **Blank or wrong routes:** The `vercel.json` rewrites send unknown paths to `index.html` so Expo Router works. If you changed the output directory, update `outputDirectory` in `vercel.json` to match.
- **Supabase errors in production:** Confirm `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel and that Supabase allows requests from your Vercel domain (e.g. in URL allowlist if you use one).
