# AI Disaster Supply Chain Optimizer

This repository is organized into two directories:

- `backend/` — placeholder backend files and a Node.js server example.
- `frontend/` — the static browser application.

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` and fill in your actual values:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `HUGGINGFACE_API_KEY`: Your Hugging Face API key (for AI features)
   - `PORT`: Server port (default: 3000)

**Important**: The `.env` file is ignored by git for security. Never commit sensitive credentials.

## Run the frontend

Open `frontend/index.html` directly in a browser, or run a local static server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/frontend/index.html
```

## Deployment walkthrough

### Frontend on Vercel

1. Sign in to Vercel and connect your repository.
2. When configuring the project, set the root directory to `frontend`.
3. Choose the `Static` deployment type (no build command required for plain HTML).
4. Deploy the site. The published URL will serve `frontend/index.html`.

Alternative local deployment:

```bash
cd frontend
npx vercel --prod
```

### Backend on Render

1. Sign in to Render and create a new Web Service.
2. Connect the same repository and set the root directory to `backend`.
3. Use the `Node` environment with `npm install` and `npm start`.
4. Add environment variables in Render:
   - `MONGODB_URI` — your Atlas connection string, including the database name.
   - `HUGGINGFACE_API_KEY` — your Hugging Face API key.
   - `PORT` — optional, defaults to 3000.
5. Deploy the service.

### MongoDB Atlas setup

1. Create a new MongoDB Atlas cluster.
2. Create a database user and password.
3. Get the connection string and place it in `MONGODB_URI`.
   Example:

```text
mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/disaster_optimizer?retryWrites=true&w=majority
```

4. Make sure network access is allowed from Render and your local machine if needed.

### Notes

- The frontend is a static site and can be deployed independently on Vercel.
- The backend is a Node.js service and should be deployed on Render.
- The backend uses the MongoDB Atlas URI to connect; the database name is included in that URI.

## Optional Node.js backend

From the `backend` directory:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

The backend serves the `frontend/` folder and exposes example API routes like `/api/status`, `/api/db/status`, and `/api/huggingface`.

The Hugging Face route is currently a placeholder and is controlled by the following env values:

- `HUGGINGFACE_API_KEY`
- `MONGODB_URI`

Only the Hugging Face API key is required for the current placeholder implementation; the model is fixed internally.

## What changed

- Backend and database code have been separated into `backend/`.
- No MongoDB, MySQL, or external AI API keys are required.
- The app runs entirely in the browser using `localStorage`.
- `frontend/` contains the UI, optimization logic, and map display.

## Files

- `frontend/index.html` — main static UI and logic.
- `frontend/static/` — CSS and JavaScript assets.
- `backend/server.js` — Node.js backend placeholder server.
- `backend/package.json` — Node.js backend manifest.
- `backend/.env.example` — backend environment example.
- `.gitignore` — ignores `.env`.

## Notes

- Data is stored in browser `localStorage`.
- To reset the app, clear storage for the page in your browser.
- The frontend can be served as a static site without a server backend.
