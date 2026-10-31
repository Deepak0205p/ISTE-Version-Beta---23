# Money Matters — Financial Copilot & Wealth Engine

Money Matters is an AI-powered financial advisory platform and affordability copilot tailored for Indian personal finance, banking hygiene, automated transaction audits, and deterministic wealth planning.

---

## 🌟 Key Features

### 1. AI Financial Advisor & Copilot (`/advisor`)
* **Gemini 3.5 Flash Lite Core:** Hyper-personalized financial insights directly grounded in user's active bank balances, ongoing EMIs, investment portfolios, and monthly cash flow.
* **Real-time Tavily Internet Access:** Intelligent query classifier automatically triggers live web search for statutory rates, RBI repo updates, PPF/SSY yields, and Indian tax regimes.
* **Structured English Point-to-Point Output:** Rendered with `react-markdown` into clean bulleted lists, bold INR amounts, and verified source citations.
* **Full-Screen Responsive Canvas:** Edge-to-edge layout designed to maximize readability.

### 2. Pure Mathematical Wealth Calculators (`/tools`)
* **SIP Calculator:** Deterministic compounding with real inflation-adjusted purchasing power discounts and post-tax LTCG projections.
* **Step-Up SIP Calculator:** Career progression models with annual SIP top-ups (5-25%).
* **SWP Calculator:** Systematic withdrawal simulation with corpus longevity and inflation sustainability alerts.
* **STP Calculator:** Phased capital transitions from liquid/debt funds to equity growth funds.
* **Compact Single-Screen UI:** Modern dashboard with custom scrollbars and zero layout overflow.

### 3. Affordability Engine & Ledger Hygiene (`/affordability`)
* **Commitment & Anomaly Detection:** Automated tracking of recurring subscriptions, duplicate transactions, and unusual price jumps.
* **Custom UI Controls:** Fixed-height cards with custom scrollbars and branded dropdown menus.
* **Strict Safety Buffers:** Deterministic calculations ensuring capital preservation before high-value purchases.

### 4. Banking & Multi-Account Management (`/banking`)
* Multi-account management across major Indian commercial banks (HDFC, SBI, ICICI, etc.).
* Automated bank statement parsing via Gemini AI parser.
* Cloud Firestore real-time profile and chat history synchronization.

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons, Recharts, React-Markdown.
* **Backend:** Node.js, Express, TypeScript, Multer, SQLite/Memory Ledger Repository.
* **AI & Web Search:** Google Gemini 3.5 Flash Lite API, Tavily Search API.
* **Database & Cloud:** Firebase Firestore (live profile sync).

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+
* npm or pnpm

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```
Backend runs by default on `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🔒 Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
CORS_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
TAVILY_API_KEY=your_tavily_api_key
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
```

---

## 📄 License
MIT License. Developed for Hackathon 2026.
