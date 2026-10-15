# Seenivasaga Perumal K. - Personal Portfolio Website

A modern, professional, fully responsive Personal Portfolio Website with integrated Project Management and Owner Admin Dashboard.

---

## 🌟 Highlights & Features

- **Modern Dark Theme:** Premium aesthetic with black, navy blue, and glowing purple/violet accents.
- **Hero Section:** Dynamic typewriter effect cycling through technical interests, greeting, and profile picture.
- **About Me:** Complete educational background (B.Sc CS & M.Sc CS pursuing), location (Rajapalayam, Tamil Nadu), and biography.
- **Skills Showcase:** Interactive skill cards for HTML & CSS, JavaScript, Python, Web Development, Android Apps, IoT, and Database Technologies.
- **Projects Management (Core Feature):**
  - Dedicated **Projects Explorer** page with category filtering (Website, Android App, IoT, Python, Other) and real-time live search.
  - Dedicated **Project Details** page displaying multiple screenshot carousel, technology tags, and live demo / GitHub links.
  - Full **Admin Dashboard** to upload new projects with cover images and multiple screenshots, edit existing projects, or delete them without writing any code!
- **Education & Milestones:** Academic timeline detailing B.Sc & M.Sc Computer Science degrees.
- **Contact Section:** Working contact form with instant validation that saves messages permanently to the database and alerts the owner in the dashboard.
- **Permanent SQLite Storage:** All projects, profile details, and inquiries persist reliably in a local SQLite database (`portfolio.db`).

---

## 🚀 Quick Start Guide

### 1. Start the Server
In PowerShell or Terminal inside this folder:
```bash
npm start
```

### 2. Open in Your Browser
- **Public Portfolio:** [http://localhost:3000](http://localhost:3000)
- **Projects Explorer:** [http://localhost:3000/projects.html](http://localhost:3000/projects.html)
- **Admin Dashboard Login:** [http://localhost:3000/login.html](http://localhost:3000/login.html)

---

## 🔐 Admin Credentials

- **Admin Email / Username:** `seenukumar9345@gmail.com`
- **Password:** `seenukumar`
- **Contact Email:** `seenukumar9345@gmail.com`

*(You can change the password at any time inside the Admin Dashboard under the "Security" tab).*

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Custom Responsive Dark Theme with Glassmorphism), Vanilla JavaScript, FontAwesome Icons.
- **Backend:** Node.js (v24), Express.
- **Database:** SQLite (Node.js native `node:sqlite` DatabaseSync engine).
- **File Uploads:** Multer (images uploaded to `/uploads` folder).
- **Authentication:** Bcrypt password hashing and secure token-based cookies.
