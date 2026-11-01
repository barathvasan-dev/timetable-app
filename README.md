# Class timetable (demo)

React + FastAPI + MongoDB, with WhatsApp Cloud API settings you fill in later.
Runs on your own computer. Nothing is sent anywhere until you add WhatsApp details in **Settings**.

## What you need
- Python 3.10+
- Node.js 18+
- MongoDB running locally on the default port. Easiest options:
  - Docker: `docker run -d --name tt-mongo -p 27017:27017 mongo:7`
  - or install MongoDB Community Server and start the service.

## Start it (two terminals)

**1. Backend**
```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows      (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
No MongoDB handy? For a throw-away try-out only: set `TT_MEMORY=1` before starting
(data is lost when the server stops).
Optional settings: `MONGO_URL` (default `mongodb://localhost:27017`), `MONGO_DB` (default `timetable`).

**2. Frontend**
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Using it
- First screen is the **sign in** page. Default login: **admin / admin**.
  "Just view the timetable" opens the read-only student view.
- **Edit timetable** (after signing in):
  - drag a course onto a slot (on a phone: touch and hold, or tap a course and then tap a slot)
  - **Edit class details**: programme, track, semester and venue. Use it for Semester II next year.
  - **+ Add course** / **Edit** / **Delete** on each course card (name, code, faculty, colour, lab or not)
  - **Edit slot times**: change, add or remove slots
  - **Save** shows a summary of every change first.
- **Settings**: WhatsApp Cloud API (Phone number ID, access token, API version, student numbers),
  a test-message button, and change of the admin username and password.
  Change the default password before you share the link.

## WhatsApp notes
- Messages are sent through Meta's Graph API `POST /{version}/{phone-number-id}/messages` to each number you list.
- Free-form text only reaches a person who messaged your business number in the last 24 hours.
  For everyone else Meta requires an approved message template. When you get one, change
  `backend/whatsapp.py` (`send_text`) to send a template instead.
- If WhatsApp is off or not set up, saving still works and the screen shows the message so you can copy it
  or open it in WhatsApp yourself.
- The access token is stored in MongoDB and is never sent back to the browser.

## Tests
```
cd backend  && python tests/test_backend.py        # API logic, no packages needed
cd frontend && npm test                            # change summary and message wording
```

## Folder map
```
backend/   main.py (routes), logic.py (checks), store.py (MongoDB), whatsapp.py, security.py, default_data.py
frontend/  src/App.jsx, src/components/{Login,Timetable,Dialogs,Settings,Modal}.jsx, src/lib/{time,diff}.js
```
