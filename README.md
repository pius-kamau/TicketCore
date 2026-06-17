
---

````md
# TicketCore

**A real-time ticket booking system with M-Pesa integration built with Node.js, TypeScript, and PostgreSQL.**

---

## What It Does

TicketCore handles the entire ticket booking flow — from browsing events and selecting seats to making payments and receiving digital tickets with QR codes.

The system prevents double booking using Redis distributed locking and processes payments through M-Pesa.

---

## Tech Stack

- **Backend:** Node.js, Express, TypeScript  
- **Database:** PostgreSQL with TypeORM  
- **Cache & Locking:** Redis  
- **Payments:** M-Pesa Daraja API  
- **Queues:** BullMQ for background jobs  
- **Real-time:** Socket.io  
- **Email:** Brevo API  
- **Deployment:** Docker + Render  

---

## Features

- User registration and authentication with JWT and refresh tokens  
- Role-based access (customers and admins)  
- Event management with venue support  
- Seat inventory with Redis locking (10-minute holds)  
- M-Pesa STK Push payment integration  
- QR code ticket generation  
- Ticket verification and check-in system  
- Email notifications (welcome, ticket confirmation, payment receipts)  
- Real-time seat updates via WebSocket  
- Admin analytics dashboard  
- Background job processing using BullMQ  
- Swagger API documentation  

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Docker (optional)

---

## Installation

```bash
# Clone the repository
git clone https://github.com/pius-kamau/TicketCore.git

cd TicketCore

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL and Redis (via Docker)
docker-compose up -d

# Run migrations (if applicable)
npm run migrate

# Start development server
npm run dev
````

---

## Environment Variables

Create a `.env` file:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=ticketuser
DB_PASSWORD=your_password
DB_NAME=ticketcore_db

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m

MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey

EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=your_brevo_login
EMAIL_PASS=your_brevo_smtp_key
EMAIL_FROM=TicketCore <noreply@ticketcore.com>

APP_URL=http://localhost:3001
```

---

## API Endpoints

| Method | Endpoint                         | Description                       |
| ------ | -------------------------------- | --------------------------------- |
| POST   | `/api/auth/register`             | Register a new user               |
| POST   | `/api/auth/login`                | Login and get tokens              |
| POST   | `/api/auth/refresh-token`        | Refresh access token              |
| POST   | `/api/auth/logout`               | Logout user                       |
| GET    | `/api/events`                    | List all events                   |
| GET    | `/api/events/:id`                | Get event details with seat stats |
| GET    | `/api/events/:id/seats`          | Get seat layout                   |
| POST   | `/api/reservations/hold`         | Hold a seat                       |
| POST   | `/api/reservations/confirm`      | Confirm booking                   |
| POST   | `/api/payments/mpesa/initiate`   | Initiate M-Pesa payment           |
| GET    | `/api/tickets/verify/:code`      | Verify ticket                     |
| POST   | `/api/tickets/checkin/:code`     | Check-in ticket                   |
| GET    | `/api/admin/analytics/dashboard` | Admin dashboard stats             |

Full API documentation is available at `/api-docs` when the server is running.

---

## Deployment

### Docker Deployment

```bash
# Build image
docker build -t ticketcore-api .

# Run container
docker run -p 3000:3000 --env-file .env ticketcore-api
```

---

### Deploy to Render

1. Push code to GitHub
2. Create a new Web Service on Render
3. Connect repository
4. Add environment variables
5. Deploy

---

## Project Structure

```text
src/
├── config/         # Database, Redis, email, queue config
├── controllers/    # Request handlers
├── models/         # TypeORM entities
├── routes/         # API routes
├── services/       # Business logic
├── workers/        # Background job processors
├── middlewares/    # Auth & validation
├── utils/          # Helpers & logger
├── validators/     # Joi schemas
├── jobs/           # Scheduled jobs
└── socket/         # Socket.io setup
```

---

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test -- --coverage
```

---

## License

MIT

```

---

If you want, I can also:
- make this README **“GitHub top 1% portfolio level” (with badges, diagrams, screenshots section, and deployment links)**
- or add a **system architecture diagram (very powerful for hiring visibility)**
```
