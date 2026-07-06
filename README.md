# StudyFlow.uz

CRM/LMS platform for educational centers in Uzbekistan — student management, course scheduling, payments, and teacher-student communication in one system.

## Features

- **Student Management** — enrollment, profiles, attendance tracking, progress history
- **Course & Group Scheduling** — flexible timetables for classes and groups
- **Payments & Billing** — track tuition payments, invoices, and outstanding balances
- **Teacher Dashboard** — attendance marking, grading, and student progress reports
- **Notifications** — SMS/automated reminders for classes and payments
- **Role-Based Access** — separate permissions for admins, teachers, and staff
- **Multi-Center Support** — manage multiple branches/centers from one account

## Tech Stack

**Backend**
- Python / Django
- PostgreSQL
- Redis (caching, background tasks)
- Docker & Docker Compose

**Frontend**
- React

## Project Structure

```
studyflow/
├── backend/
│   ├── apps/
│   │   ├── students/
│   │   ├── courses/
│   │   ├── payments/
│   │   └── users/
│   ├── config/
│   └── manage.py
├── frontend/
│   ├── src/
│   └── public/
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/Zarnigor/studyflow.git
   cd studyflow
   ```

2. Set up environment variables
   ```bash
   cp .env.example .env
   ```

3. Run with Docker Compose
   ```bash
   docker-compose up --build
   ```

4. Apply migrations
   ```bash
   docker-compose exec backend python manage.py migrate
   ```

5. Create a superuser
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

6. Access the app
   - Backend API: `http://localhost:8000`
   - Frontend: `http://localhost:3000`

### Running Without Docker

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | Debug mode (True/False) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

## API Documentation

API docs available at `/api/docs/` (Swagger/OpenAPI) once the server is running.

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit your changes: `git commit -m "Add your feature"`
3. Push to the branch: `git push origin feature/your-feature`
4. Open a pull request

## License

Proprietary — All rights reserved.

## Contact

**Developer:** Zarnigor
**Email:** mercurial1255@gmail.com
