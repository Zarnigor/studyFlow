# StudyFlow — O'quv Markaz CRM

React + Vite loyihasi. O'zbek va ingliz tillarini qo'llab-quvvatlaydi.

## Ishga tushirish

```bash
# 1. O'rnatish
npm install

# 2. Dev server
npm run dev

# 3. Build (production)
npm run build
```

## Loyiha tuzilmasi

```
src/
├── App.jsx                        ← Asosiy komponent, tab routing
├── main.jsx                       ← Entry point
│
├── i18n/
│   ├── translations.js            ← UZ + EN barcha matnlar
│   └── LangContext.jsx            ← useLang() hook
│
├── data/
│   └── mockData.js                ← Mock ma'lumotlar + ranglar
│
├── components/
│   ├── ui/index.jsx               ← Shared: Avatar, Badge, Modal, Table...
│   └── layout/Sidebar.jsx         ← Sidebar navigatsiya
│
└── pages/
    ├── Students/index.jsx         ← Talabalar moduli
    ├── Payments/index.jsx         ← To'lovlar moduli
    ├── Attendance/index.jsx       ← Davomat moduli
    ├── Teachers/index.jsx         ← O'qituvchilar moduli
    └── Leads/index.jsx            ← Arizalar (Kanban + List)
```

## Tayyor modullar

| Modul        | Fayl                          | Holat |
|---|---|---|
| Sidebar      | components/layout/Sidebar.jsx | ✅    |
| Talabalar    | pages/Students/index.jsx      | ✅    |
| To'lovlar    | pages/Payments/index.jsx      | ✅    |
| Davomat      | pages/Attendance/index.jsx    | ✅    |
| O'qituvchilar| pages/Teachers/index.jsx      | ✅    |
| Arizalar     | pages/Leads/index.jsx         | ✅    |
| Dashboard    | — (keyingi versiya)           | 🔜    |
| Guruhlar     | — (keyingi versiya)           | 🔜    |

## Tarjima qo'shish

`src/i18n/translations.js` faylida `uz` va `en` obyektlarini kengaytiring.

## Backend ulash

Hozir mock ma'lumotlar ishlatilmoqda (`src/data/mockData.js`).
API ulash uchun har bir sahifadagi `useState(INITIAL_*)` ni
`useQuery` yoki `useSWR` bilan almashtiring:

```js
// Misol — React Query bilan
import { useQuery } from "@tanstack/react-query";

const { data: students } = useQuery({
  queryKey: ["students"],
  queryFn: () => fetch("/api/students").then(r => r.json()),
});
```

## Stack

- **React 18** — UI
- **Vite 5** — Build tool
- **Recharts** — Grafiklar (Dashboard uchun)
- **CSS Variables** — Theming (light/dark mode avtomatik)

## Keyingi qadamlar (V2)

- [ ] Dashboard (Recharts LineChart + PieChart)
- [ ] Guruhlar moduli
- [ ] Hisobotlar (PDF export)
- [ ] Telegram bot integratsiya
- [ ] Payme/Click to'lov integratsiya
- [ ] Backend: Node.js + PostgreSQL
- [ ] JWT autentifikatsiya
