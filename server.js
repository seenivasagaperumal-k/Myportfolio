const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Data paths
const profileJsonPath = path.join(__dirname, 'public', 'profile.json');
const projectsJsonPath = path.join(__dirname, 'public', 'projects.json');
const messagesJsonPath = path.join(__dirname, 'messages.json');

// Helper to read JSON safely
function readJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultValue;
}

// Helper to write JSON safely
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Multer storage configuration for local uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `${cleanBase}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only valid image files (JPG, PNG, WEBP, GIF, SVG) are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: fileFilter
});

// Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// --- Token-Based Authentication ---
const activeSessions = new Map();
let currentAdminPasswordHash = bcrypt.hashSync('seenukumar', 10);

function generateSessionToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  return token;
}

function verifyAdmin(req, res, next) {
  const token = req.cookies.admin_token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeSessions.delete(token);
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }

  req.adminUser = session.username;
  next();
}

// ----------------- AUTHENTICATION ROUTES -----------------

// Admin Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanUser = username.trim().toLowerCase();
    const isValidUser = cleanUser === 'seenukumar9345@gmail.com' || cleanUser === 'admin';
    const isMatch = isValidUser && bcrypt.compareSync(password, currentAdminPasswordHash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateSessionToken(cleanUser);
    res.cookie('admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ success: true, message: 'Login successful', username: cleanUser, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Admin Auth Status Check
app.get('/api/auth/status', (req, res) => {
  const token = req.cookies.admin_token || req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.json({ authenticated: false });
  }
  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, username: session.username });
});

// Admin Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.admin_token || req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    activeSessions.delete(token);
  }
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Change Admin Password
app.post('/api/admin/change-password', verifyAdmin, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const isMatch = bcrypt.compareSync(currentPassword, currentAdminPasswordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    currentAdminPasswordHash = bcrypt.hashSync(newPassword, 10);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Error updating password.' });
  }
});

// ----------------- PROFILE ROUTES -----------------

// Get Public Profile
app.get('/api/profile', (req, res) => {
  try {
    const doc = readJson(profileJsonPath, { profile: {} });
    res.json({ success: true, profile: doc.profile || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// Update Profile Details (Admin)
app.put('/api/admin/profile', verifyAdmin, (req, res) => {
  try {
    const doc = readJson(profileJsonPath, { profile: {}, skills: [], education: [] });
    doc.profile = {
      ...doc.profile,
      ...req.body,
      updated_at: new Date().toISOString()
    };
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Profile updated successfully.', profile: doc.profile });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// Upload Profile Photo (Admin)
app.post('/api/admin/profile/avatar', verifyAdmin, upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded.' });
    }
    const avatarUrl = '/uploads/' + req.file.filename;
    const doc = readJson(profileJsonPath, { profile: {}, skills: [], education: [] });
    doc.profile.avatar_url = avatarUrl;
    doc.profile.updated_at = new Date().toISOString();
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Profile photo uploaded successfully.', avatar_url: avatarUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to upload photo.' });
  }
});

// ----------------- SKILLS ROUTES -----------------

// Get Public Skills
app.get('/api/skills', (req, res) => {
  try {
    const doc = readJson(profileJsonPath, { skills: [] });
    res.json({ success: true, skills: doc.skills || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch skills.' });
  }
});

// Add Skill (Admin)
app.post('/api/admin/skills', verifyAdmin, (req, res) => {
  try {
    const { name, category, proficiency, icon, display_order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Skill name is required.' });

    const doc = readJson(profileJsonPath, { skills: [] });
    const newSkill = {
      id: Date.now(),
      name: name.trim(),
      category: category || 'General',
      proficiency: proficiency || 'Proficient',
      icon: icon || 'fas fa-code',
      display_order: display_order ? parseInt(display_order) : (doc.skills.length + 1)
    };
    doc.skills = doc.skills || [];
    doc.skills.push(newSkill);
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Skill added successfully.', skill: newSkill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add skill.' });
  }
});

// Update Skill (Admin)
app.put('/api/admin/skills/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(profileJsonPath, { skills: [] });
    const idx = (doc.skills || []).findIndex(s => String(s.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Skill not found.' });

    doc.skills[idx] = { ...doc.skills[idx], ...req.body };
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Skill updated successfully.', skill: doc.skills[idx] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update skill.' });
  }
});

// Delete Skill (Admin)
app.delete('/api/admin/skills/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(profileJsonPath, { skills: [] });
    doc.skills = (doc.skills || []).filter(s => String(s.id) !== String(id));
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Skill removed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete skill.' });
  }
});

// ----------------- PROJECTS ROUTES -----------------

// Get Public Projects
app.get('/api/projects', (req, res) => {
  try {
    const { category, search, limit } = req.query;
    const doc = readJson(projectsJsonPath, { projects: [] });
    let projects = doc.projects || [];

    if (category && category !== 'All') {
      projects = projects.filter(p => p.category === category);
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      projects = projects.filter(p =>
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.technologies && p.technologies.toLowerCase().includes(q))
      );
    }

    if (limit) {
      projects = projects.slice(0, parseInt(limit));
    }

    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
  }
});

// Get Single Project Details
app.get('/api/projects/:id', (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(projectsJsonPath, { projects: [] });
    const project = (doc.projects || []).find(p => String(p.id) === String(id));
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch project.' });
  }
});

// Upload New Project (Admin)
const projectUploadFields = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'screenshots', maxCount: 10 }
]);

app.post('/api/admin/projects', verifyAdmin, projectUploadFields, (req, res) => {
  try {
    const { title, description, category, technologies, github_url, demo_url, status, featured } = req.body;
    if (!title || !description || !category || !technologies) {
      return res.status(400).json({ success: false, message: 'Required fields missing.' });
    }

    let thumbnailUrl = '/uploads/default-project.svg';
    if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
      thumbnailUrl = '/uploads/' + req.files['thumbnail'][0].filename;
    }

    const screenshotsList = [];
    if (req.files && req.files['screenshots']) {
      req.files['screenshots'].forEach(file => {
        screenshotsList.push('/uploads/' + file.filename);
      });
    }

    const doc = readJson(projectsJsonPath, { projects: [] });
    const newProject = {
      id: Date.now(),
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      thumbnail: thumbnailUrl,
      screenshots: screenshotsList,
      technologies: technologies.trim(),
      github_url: (github_url || '').trim(),
      demo_url: (demo_url || '').trim(),
      status: status || 'Completed',
      featured: featured === '1' || featured === true ? 1 : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    doc.projects = doc.projects || [];
    doc.projects.unshift(newProject);
    writeJson(projectsJsonPath, doc);

    res.json({ success: true, message: 'Project created successfully!', project: newProject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create project.' });
  }
});

// Update Existing Project (Admin)
app.put('/api/admin/projects/:id', verifyAdmin, projectUploadFields, (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(projectsJsonPath, { projects: [] });
    const idx = (doc.projects || []).findIndex(p => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Project not found.' });

    const existing = doc.projects[idx];
    let thumbnailUrl = existing.thumbnail;
    if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
      thumbnailUrl = '/uploads/' + req.files['thumbnail'][0].filename;
    }

    let screenshotsList = existing.screenshots || [];
    if (req.body.existing_screenshots) {
      try {
        screenshotsList = JSON.parse(req.body.existing_screenshots);
      } catch (e) {}
    }
    if (req.files && req.files['screenshots']) {
      req.files['screenshots'].forEach(file => {
        screenshotsList.push('/uploads/' + file.filename);
      });
    }

    doc.projects[idx] = {
      ...existing,
      ...req.body,
      thumbnail: thumbnailUrl,
      screenshots: screenshotsList,
      updated_at: new Date().toISOString()
    };

    writeJson(projectsJsonPath, doc);
    res.json({ success: true, message: 'Project updated successfully.', project: doc.projects[idx] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update project.' });
  }
});

// Delete Project (Admin)
app.delete('/api/admin/projects/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(projectsJsonPath, { projects: [] });
    doc.projects = (doc.projects || []).filter(p => String(p.id) !== String(id));
    writeJson(projectsJsonPath, doc);
    res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete project.' });
  }
});

// ----------------- EDUCATION & ACHIEVEMENTS ROUTES -----------------

// Get Public Education & Achievements
app.get('/api/education-achievements', (req, res) => {
  try {
    const doc = readJson(profileJsonPath, { education: [] });
    res.json({ success: true, items: doc.education || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch education/achievements.' });
  }
});

// Add Item (Admin)
app.post('/api/admin/education-achievements', verifyAdmin, (req, res) => {
  try {
    const { type, title, institution, year, description, credential_url, display_order } = req.body;
    if (!type || !title || !institution || !year) {
      return res.status(400).json({ success: false, message: 'Type, title, institution, and year are required.' });
    }

    const doc = readJson(profileJsonPath, { education: [] });
    const newItem = {
      id: Date.now(),
      type: type.trim(),
      title: title.trim(),
      institution: institution.trim(),
      year: year.trim(),
      description: (description || '').trim(),
      credential_url: (credential_url || '').trim(),
      display_order: display_order ? parseInt(display_order) : ((doc.education || []).length + 1)
    };

    doc.education = doc.education || [];
    doc.education.push(newItem);
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Entry added successfully.', item: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add item.' });
  }
});

// Update Item (Admin)
app.put('/api/admin/education-achievements/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(profileJsonPath, { education: [] });
    const idx = (doc.education || []).findIndex(e => String(e.id) === String(id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Item not found.' });

    doc.education[idx] = { ...doc.education[idx], ...req.body };
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Entry updated successfully.', item: doc.education[idx] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update entry.' });
  }
});

// Delete Item (Admin)
app.delete('/api/admin/education-achievements/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const doc = readJson(profileJsonPath, { education: [] });
    doc.education = (doc.education || []).filter(e => String(e.id) !== String(id));
    writeJson(profileJsonPath, doc);
    res.json({ success: true, message: 'Entry removed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete entry.' });
  }
});

// ----------------- CONTACT FORM & MESSAGES ROUTES -----------------

// Submit Contact Message (Public)
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    const messages = readJson(messagesJsonPath, []);
    const newMsg = {
      id: Date.now(),
      name: name.trim(),
      email: email.trim(),
      subject: (subject || 'Portfolio Inquiry').trim(),
      message: message.trim(),
      is_read: false,
      created_at: new Date().toISOString()
    };
    messages.unshift(newMsg);
    writeJson(messagesJsonPath, messages);

    res.json({
      success: true,
      message: 'Thank you for your message! Seenivasaga Perumal K. will get back to you soon.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit message.' });
  }
});

// Get Messages (Admin)
app.get('/api/admin/messages', verifyAdmin, (req, res) => {
  try {
    const messages = readJson(messagesJsonPath, []);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// Mark Message as Read (Admin)
app.put('/api/admin/messages/:id/read', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    const messages = readJson(messagesJsonPath, []);
    const msg = messages.find(m => String(m.id) === String(id));
    if (msg) msg.is_read = true;
    writeJson(messagesJsonPath, messages);
    res.json({ success: true, message: 'Message marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark message as read.' });
  }
});

// Delete Message (Admin)
app.delete('/api/admin/messages/:id', verifyAdmin, (req, res) => {
  try {
    const id = req.params.id;
    let messages = readJson(messagesJsonPath, []);
    messages = messages.filter(m => String(m.id) !== String(id));
    writeJson(messagesJsonPath, messages);
    res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Seenivasaga Perumal K. Portfolio Server is RUNNING!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Admin Dashboard: http://localhost:${PORT}/login.html`);
  console.log(` Admin Email: seenukumar9345@gmail.com`);
  console.log(` Backend: Firebase Firestore + JSON (No SQLite)`);
  console.log(`=======================================================`);
});
