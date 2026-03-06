# 💰 FinanceAI — AI-Powered Personal Finance Manager

A full-stack intelligent personal finance management web application with AI-driven expense forecasting, budget tracking, interactive dashboards, and personalized recommendations.

---

## 📋 Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [AI Module](#ai-module)

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 🔐 Auth | Register/Login with JWT, secure password hashing |
| 💳 Transactions | Add/edit/delete, CSV import, filtering & pagination |
| 🎯 Budgets | Monthly budget creation, real-time progress tracking |
| 🤖 AI Predictions | Expense forecasting, savings projection, recommendations |
| 📊 Dashboard | Real-time charts: bar, pie, line graphs |
| 🔔 Alerts | Overspending alerts, budget warnings |
| 📈 Reports | PDF & Excel export, spending distribution |
| 👤 Profile | Settings, currency, savings goals, alert preferences |

---

## 🛠 Tech Stack

**Frontend:** React.js 18, React Router, Recharts, Axios, React Toastify  
**Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT Auth  
**AI Module:** Python (FastAPI), NumPy, Pandas, statsmodels (Holt-Winters), scikit-learn  
**Export:** PDFKit, ExcelJS  

---

## 📁 Project Structure

```
rtp_proj_1.4/
├── backend/                 # Node.js + Express API
│   ├── config/db.js         # MongoDB connection
│   ├── models/              # Mongoose schemas (User, Transaction, Budget, Alert)
│   ├── routes/              # API routes (auth, transactions, budgets, reports, predictions, alerts)
│   ├── middleware/auth.js   # JWT middleware
│   ├── utils/alertService.js# Scheduled alert checker
│   └── server.js            # Entry point
├── frontend/                # React.js SPA
│   └── src/
│       ├── context/         # Auth context
│       ├── components/      # Layout, Sidebar
│       └── pages/           # Dashboard, Transactions, Budgets, Predictions, Reports, Alerts, Profile
├── ai_module/               # Python FastAPI AI service
│   ├── main.py              # Prediction endpoints
│   └── requirements.txt
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js >= 16.x
- MongoDB (local or Atlas)
- Python >= 3.9 (optional, for AI service)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

### 3. AI Module Setup (Optional)

```bash
cd ai_module
pip install -r requirements.txt
```

---

## ▶️ Running the Application

### Start Backend
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

### Start Frontend
```bash
cd frontend
npm start
# Runs on http://localhost:3000
```

### Start AI Service (Optional)
```bash
cd ai_module
python main.py
# Runs on http://localhost:8000
# API docs: http://localhost:8000/docs
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login user |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/updateprofile | Update profile |
| GET | /api/transactions | Get transactions (paginated) |
| POST | /api/transactions | Add transaction |
| PUT | /api/transactions/:id | Update transaction |
| DELETE | /api/transactions/:id | Delete transaction |
| POST | /api/transactions/import | Import CSV |
| GET | /api/transactions/summary/monthly | Monthly summary |
| GET | /api/transactions/summary/cashflow | Cash flow data |
| GET | /api/budgets | Get budgets |
| POST | /api/budgets | Create budget |
| PUT | /api/budgets/:id | Update budget |
| DELETE | /api/budgets/:id | Delete budget |
| GET | /api/predictions/expenses | Expense forecast |
| GET | /api/predictions/savings | Savings projection |
| GET | /api/predictions/recommendations | AI recommendations |
| GET | /api/alerts | Get alerts |
| PUT | /api/alerts/:id/read | Mark alert as read |
| GET | /api/reports/export/pdf | Export PDF |
| GET | /api/reports/export/excel | Export Excel |

---

## 🤖 AI Module

The Python FastAPI service provides:

- **`POST /predict`** — Holt-Winters exponential smoothing forecast for next N months
- **`POST /predict/categories`** — Per-category expense prediction
- **`POST /anomaly`** — Z-score based unusual transaction detection

If the AI service is unavailable, the backend automatically falls back to a weighted moving average algorithm.

---

## 📊 Sample CSV Import Format

```csv
type,amount,category,description,date,paymentMethod
expense,45.50,Food & Dining,Lunch at café,2025-01-15,card
income,3000,Salary,Monthly salary,2025-01-01,bank_transfer
expense,120,Shopping,Clothes,2025-01-10,card
```

---

## 🔒 Security

- Passwords hashed with bcrypt (salt rounds: 10)
- JWT token-based authentication
- Protected routes with middleware
- Input validation with express-validator

---

## 📝 License

MIT License — Built for educational/project purposes.
