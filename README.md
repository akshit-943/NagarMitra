# NagarMitra

NagarMitra is an intelligent civic reporting, tracking, and analytics platform.

This repository contains the decoupled full-stack architecture initialized for the project foundation phase.

---

## 🏗️ Architecture Overview

```text
ForgeProject/
├── .gitignore                      # Root git safety rules (blocks all .env files)
├── README.md                       # Project documentation
├── backend/                        # Node.js + Express API server
│   ├── .env                        # Local development variables (gitignored)
│   ├── .env.example                # Template with placeholder credentials
│   ├── .gitignore                  # Backend specific gitignore
│   ├── package.json                # Express, Mongoose, JWT, Cloudinary dependencies
│   └── src/
│       ├── config/
│       │   ├── db.js               # MongoDB connection helper (Mongoose)
│       │   └── cloudinary.js       # Cloudinary media configuration
│       ├── middleware/
│       │   ├── auth.js             # JWT verification middleware
│       │   └── errorHandler.js     # Global error handling middleware
│       ├── routes/
│       │   ├── api.js              # Aggregated API route dispatcher
│       │   └── healthRoutes.js     # Health check route (/api/health)
│       └── server.js               # Express application initialization & entry
└── frontend/                       # React 19 + Vite client application
    ├── .env                        # Client development variables (gitignored)
    ├── .env.example                # Template (only public variables, NO secrets)
    ├── .gitignore                  # Frontend specific gitignore
    ├── index.html                  # HTML5 entry point
    ├── package.json                # React, Leaflet, Recharts, Tailwind CSS, Axios
    ├── vite.config.js              # Vite bundler + Tailwind v4 plugin config
    └── src/
        ├── main.jsx                # React root mount
        ├── App.jsx                 # Foundation verification dashboard
        ├── index.css               # Tailwind & Leaflet global styles
        ├── components/
        │   ├── Navbar.jsx          # Header navigation
        │   ├── HealthStatus.jsx    # Real-time backend health check monitor
        │   └── TechStackGrid.jsx   # Stack readiness visualization
        └── services/
            ├── api.js              # Axios instance with interceptors
            └── healthService.js    # Health check service
```

---

## 🔒 Security & Environment Variables

All sensitive credentials reside exclusively within the `backend/.env` file and **never** enter frontend bundles or repository commits.

### Backend (`backend/.env.example`)
| Key | Purpose |
|---|---|
| `PORT` | Backend server port (Default: `5000`) |
| `NODE_ENV` | Application environment (`development` / `production`) |
| `CLIENT_URL` | Allowed CORS origin (`http://localhost:5173`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for signing authentication tokens |
| `JWT_EXPIRES_IN` | Token validity duration |
| `GEMINI_API_KEY` | Google Gemini API key (AI features) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary storage account name |
| `CLOUDINARY_API_KEY` | Cloudinary API access key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Frontend (`frontend/.env.example`)
| Key | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API URL (`http://localhost:5000/api`) |

---

## 🚀 Startup Commands

### 1. Run Backend Server
```bash
cd backend
npm install
npm run dev
# Server runs at http://localhost:5000
# Health check available at http://localhost:5000/api/health
```

### 2. Run Frontend Client
```bash
cd frontend
npm install
npm run dev
# Client runs at http://localhost:5173
```
