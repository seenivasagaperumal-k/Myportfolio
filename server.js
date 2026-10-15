const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'seenu-portfolio-secure-session-key-2026';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// --- Simple & Robust Token-Based Authentication ---
// Active in-memory session store (or hash validation)
const activeSessions = new Map();

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
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = generateSessionToken(admin.username);
    res.cookie('admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24h
    });

    res.json({ success: true, message: 'Login successful', username: admin.username, token });
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

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(req.adminUser);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin user not found.' });
    }

    const isMatch = bcrypt.compareSync(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(newHash, req.adminUser);

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
    const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    res.json({ success: true, profile: profile || {} });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// Update Profile Details (Admin)
app.put('/api/admin/profile', verifyAdmin, (req, res) => {
  try {
    const {
      name,
      title,
      bio,
      education_primary,
      education_secondary,
      location,
      interests,
      email,
      github_url,
      linkedin_url,
      twitter_url,
      resume_url
    } = req.body;

    db.prepare(`
      UPDATE profile SET
        name = COALESCE(?, name),
        title = COALESCE(?, title),
        bio = COALESCE(?, bio),
        education_primary = COALESCE(?, education_primary),
        education_secondary = COALESCE(?, education_secondary),
        location = COALESCE(?, location),
        interests = COALESCE(?, interests),
        email = COALESCE(?, email),
        github_url = COALESCE(?, github_url),
        linkedin_url = COALESCE(?, linkedin_url),
        twitter_url = COALESCE(?, twitter_url),
        resume_url = COALESCE(?, resume_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      name,
      title,
      bio,
      education_primary,
      education_secondary,
      location,
      interests,
      email,
      github_url,
      linkedin_url,
      twitter_url,
      resume_url
    );

    const updated = db.prepare('SELECT * FROM profile WHERE id = 1').get();
    res.json({ success: true, message: 'Profile updated successfully.', profile: updated });
  } catch (error) {
    console.error('Update profile error:', error);
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
    db.prepare('UPDATE profile SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(avatarUrl);
    res.json({ success: true, message: 'Profile photo uploaded successfully.', avatar_url: avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload photo.' });
  }
});

// ----------------- SKILLS ROUTES -----------------

// Get Public Skills
app.get('/api/skills', (req, res) => {
  try {
    const skills = db.prepare('SELECT * FROM skills ORDER BY display_order ASC, id ASC').all();
    res.json({ success: true, skills });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skills.' });
  }
});

// Add Skill (Admin)
app.post('/api/admin/skills', verifyAdmin, (req, res) => {
  try {
    const { name, category, proficiency, icon, display_order } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Skill name is required.' });
    }

    const order = display_order ? parseInt(display_order) : 0;
    const result = db.prepare(`
      INSERT INTO skills (name, category, proficiency, icon, display_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), category || 'General', proficiency || 'Proficient', icon || 'fas fa-code', order);

    const newSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Skill added successfully.', skill: newSkill });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to add skill.' });
  }
});

// Update Skill (Admin)
app.put('/api/admin/skills/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, proficiency, icon, display_order } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Skill name is required.' });
    }

    db.prepare(`
      UPDATE skills SET
        name = ?,
        category = ?,
        proficiency = ?,
        icon = ?,
        display_order = ?
      WHERE id = ?
    `).run(name.trim(), category || 'General', proficiency || 'Proficient', icon || 'fas fa-code', display_order || 0, id);

    const updatedSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    res.json({ success: true, message: 'Skill updated successfully.', skill: updatedSkill });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to update skill.' });
  }
});

// Delete Skill (Admin)
app.delete('/api/admin/skills/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    res.json({ success: true, message: 'Skill removed successfully.' });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete skill.' });
  }
});

// ----------------- PROJECTS ROUTES (MOST IMPORTANT FEATURE) -----------------

// Get Public Projects (with optional category & search filter)
app.get('/api/projects', (req, res) => {
  try {
    const { category, search, limit } = req.query;
    let query = 'SELECT * FROM projects WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search && search.trim() !== '') {
      query += ' AND (title LIKE ? OR description LIKE ? OR technologies LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY featured DESC, created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const projects = db.prepare(query).all(...params);

    // Parse screenshots JSON for frontend consumption
    const parsedProjects = projects.map(p => {
      let screenshots = [];
      try {
        screenshots = JSON.parse(p.screenshots || '[]');
      } catch (e) {
        screenshots = [];
      }
      return {
        ...p,
        screenshots
      };
    });

    res.json({ success: true, projects: parsedProjects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
  }
});

// Get Single Project Details
app.get('/api/projects/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    let screenshots = [];
    try {
      screenshots = JSON.parse(project.screenshots || '[]');
    } catch (e) {
      screenshots = [];
    }

    res.json({
      success: true,
      project: {
        ...project,
        screenshots
      }
    });
  } catch (error) {
    console.error('Get single project error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch project details.' });
  }
});

// Upload New Project (Admin)
const projectUploadFields = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'screenshots', maxCount: 10 }
]);

app.post('/api/admin/projects', verifyAdmin, projectUploadFields, (req, res) => {
  try {
    const {
      title,
      description,
      category,
      technologies,
      github_url,
      demo_url,
      status,
      featured
    } = req.body;

    if (!title || !description || !category || !technologies) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, category, and technologies are required.'
      });
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

    const insertStmt = db.prepare(`
      INSERT INTO projects (
        title, description, category, thumbnail, screenshots,
        technologies, github_url, demo_url, status, featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = insertStmt.run(
      title.trim(),
      description.trim(),
      category.trim(),
      thumbnailUrl,
      JSON.stringify(screenshotsList),
      technologies.trim(),
      (github_url || '').trim(),
      (demo_url || '').trim(),
      status || 'Completed',
      featured === '1' || featured === true ? 1 : 0
    );

    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      success: true,
      message: 'Project created and published successfully!',
      project: {
        ...newProject,
        screenshots: screenshotsList
      }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Failed to create project.' });
  }
});

// Update Existing Project (Admin)
app.put('/api/admin/projects/:id', verifyAdmin, projectUploadFields, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const {
      title,
      description,
      category,
      technologies,
      github_url,
      demo_url,
      status,
      featured,
      existing_screenshots
    } = req.body;

    let thumbnailUrl = existing.thumbnail;
    if (req.files && req.files['thumbnail'] && req.files['thumbnail'][0]) {
      thumbnailUrl = '/uploads/' + req.files['thumbnail'][0].filename;
    }

    // Retain existing screenshots if specified, plus append any newly uploaded screenshots
    let screenshotsList = [];
    if (existing_screenshots) {
      try {
        screenshotsList = JSON.parse(existing_screenshots);
      } catch (e) {
        screenshotsList = [];
      }
    } else {
      try {
        screenshotsList = JSON.parse(existing.screenshots || '[]');
      } catch (e) {
        screenshotsList = [];
      }
    }

    if (req.files && req.files['screenshots']) {
      req.files['screenshots'].forEach(file => {
        screenshotsList.push('/uploads/' + file.filename);
      });
    }

    db.prepare(`
      UPDATE projects SET
        title = ?,
        description = ?,
        category = ?,
        thumbnail = ?,
        screenshots = ?,
        technologies = ?,
        github_url = ?,
        demo_url = ?,
        status = ?,
        featured = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title ? title.trim() : existing.title,
      description ? description.trim() : existing.description,
      category ? category.trim() : existing.category,
      thumbnailUrl,
      JSON.stringify(screenshotsList),
      technologies ? technologies.trim() : existing.technologies,
      github_url !== undefined ? github_url.trim() : existing.github_url,
      demo_url !== undefined ? demo_url.trim() : existing.demo_url,
      status || existing.status,
      featured !== undefined ? (featured === '1' || featured === true ? 1 : 0) : existing.featured,
      id
    );

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({
      success: true,
      message: 'Project updated successfully.',
      project: {
        ...updated,
        screenshots: screenshotsList
      }
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Failed to update project.' });
  }
});

// Delete Project (Admin)
app.delete('/api/admin/projects/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.json({ success: true, message: 'Project deleted successfully.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete project.' });
  }
});

// ----------------- EDUCATION & ACHIEVEMENTS ROUTES -----------------

// Get Public Education & Achievements
app.get('/api/education-achievements', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM education_achievements ORDER BY display_order ASC, id ASC').all();
    res.json({ success: true, items });
  } catch (error) {
    console.error('Get education error:', error);
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

    const result = db.prepare(`
      INSERT INTO education_achievements (type, title, institution, year, description, credential_url, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      type.trim(),
      title.trim(),
      institution.trim(),
      year.trim(),
      (description || '').trim(),
      (credential_url || '').trim(),
      display_order ? parseInt(display_order) : 0
    );

    const newItem = db.prepare('SELECT * FROM education_achievements WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Entry added successfully.', item: newItem });
  } catch (error) {
    console.error('Add education item error:', error);
    res.status(500).json({ success: false, message: 'Failed to add item.' });
  }
});

// Update Item (Admin)
app.put('/api/admin/education-achievements/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type, title, institution, year, description, credential_url, display_order } = req.body;

    db.prepare(`
      UPDATE education_achievements SET
        type = ?,
        title = ?,
        institution = ?,
        year = ?,
        description = ?,
        credential_url = ?,
        display_order = ?
      WHERE id = ?
    `).run(
      type.trim(),
      title.trim(),
      institution.trim(),
      year.trim(),
      (description || '').trim(),
      (credential_url || '').trim(),
      display_order ? parseInt(display_order) : 0,
      id
    );

    const updated = db.prepare('SELECT * FROM education_achievements WHERE id = ?').get(id);
    res.json({ success: true, message: 'Entry updated successfully.', item: updated });
  } catch (error) {
    console.error('Update education item error:', error);
    res.status(500).json({ success: false, message: 'Failed to update entry.' });
  }
});

// Delete Item (Admin)
app.delete('/api/admin/education-achievements/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM education_achievements WHERE id = ?').run(id);
    res.json({ success: true, message: 'Entry removed successfully.' });
  } catch (error) {
    console.error('Delete education item error:', error);
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    db.prepare(`
      INSERT INTO messages (name, email, subject, message, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(name.trim(), email.trim(), (subject || 'Portfolio Inquiry').trim(), message.trim());

    res.json({
      success: true,
      message: 'Thank you for your message! Seenivasaga Perumal K. will get back to you soon.'
    });
  } catch (error) {
    console.error('Contact message error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit message. Please try again.' });
  }
});

// Get Messages (Admin)
app.get('/api/admin/messages', verifyAdmin, (req, res) => {
  try {
    const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all();
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// Mark Message as Read (Admin)
app.put('/api/admin/messages/:id/read', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);
    res.json({ success: true, message: 'Message marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark message as read.' });
  }
});

// Delete Message (Admin)
app.delete('/api/admin/messages/:id', verifyAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (error) {
    console.error('Delete message error:', error);
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
  console.log(`=======================================================`);
});
