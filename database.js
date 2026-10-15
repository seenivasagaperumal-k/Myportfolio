const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'portfolio.db');
const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode if needed
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
function initDatabase() {
  // 1. Settings / Profile table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      bio TEXT NOT NULL,
      education_primary TEXT NOT NULL,
      education_secondary TEXT NOT NULL,
      location TEXT NOT NULL,
      interests TEXT NOT NULL,
      email TEXT DEFAULT '',
      github_url TEXT DEFAULT '',
      linkedin_url TEXT DEFAULT '',
      twitter_url TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '/uploads/default-avatar.svg',
      resume_url TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Admin Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Skills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      proficiency TEXT DEFAULT 'Proficient',
      icon TEXT DEFAULT 'fas fa-code',
      display_order INTEGER DEFAULT 0
    );
  `);

  // 4. Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      screenshots TEXT DEFAULT '[]',
      technologies TEXT NOT NULL,
      github_url TEXT DEFAULT '',
      demo_url TEXT DEFAULT '',
      status TEXT DEFAULT 'Completed',
      featured INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Education & Achievements table
  db.exec(`
    CREATE TABLE IF NOT EXISTS education_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'Education', 'Certificate', 'Achievement', 'Workshop'
      title TEXT NOT NULL,
      institution TEXT NOT NULL,
      year TEXT NOT NULL,
      description TEXT DEFAULT '',
      credential_url TEXT DEFAULT '',
      display_order INTEGER DEFAULT 0
    );
  `);

  // 6. Messages table (Contact Form)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT DEFAULT 'Portfolio Contact',
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed / Update Admin account for Seenivasaga Perumal K.
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('seenukumar', salt);

  const existingEmailAdmin = db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get('seenukumar9345@gmail.com');
  if (!existingEmailAdmin) {
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('seenukumar9345@gmail.com', adminHash);
    console.log('[Database] Admin account configured: email "seenukumar9345@gmail.com"');
  } else {
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ? COLLATE NOCASE').run(adminHash, 'seenukumar9345@gmail.com');
  }

  // Also ensure legacy admin username has the updated password
  const legacyAdmin = db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get('admin');
  if (legacyAdmin) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ? COLLATE NOCASE').run(adminHash, 'admin');
  }

  // Seed / Update default Profile
  const existingProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  if (!existingProfile) {
    db.prepare(`
      INSERT INTO profile (
        id, name, title, bio, education_primary, education_secondary, location, interests, email, github_url, linkedin_url
      ) VALUES (
        1,
        'Seenivasaga Perumal K.',
        'Computer Science Student & Developer',
        'Passionate Computer Science student and software developer with a strong foundation in modern web development, Python, Android applications, and IoT innovations. Enthusiastic about creating impactful digital solutions and continuously learning new technologies.',
        'M.Sc Computer Science (Currently Pursuing)',
        'B.Sc Computer Science',
        'Rajapalayam, Tamil Nadu, India',
        'Web Development, Python, Android App Development, IoT Projects, Technology',
        'seenukumar9345@gmail.com',
        '',
        ''
      )
    `).run();
    console.log('[Database] Default profile initialized with email seenukumar9345@gmail.com');
  } else {
    // Update existing profile email to seenukumar9345@gmail.com
    db.prepare("UPDATE profile SET email = 'seenukumar9345@gmail.com' WHERE id = 1").run();
  }

  // Seed default Skills if table is empty
  const skillsCount = db.prepare('SELECT COUNT(*) as count FROM skills').get().count;
  if (skillsCount === 0) {
    const defaultSkills = [
      { name: 'HTML and CSS', category: 'Frontend', icon: 'fab fa-html5' },
      { name: 'JavaScript', category: 'Frontend', icon: 'fab fa-js' },
      { name: 'Python', category: 'Backend & Scripting', icon: 'fab fa-python' },
      { name: 'Web Development', category: 'Full Stack', icon: 'fas fa-globe' },
      { name: 'Android App Development', category: 'Mobile', icon: 'fab fa-android' },
      { name: 'IoT Projects', category: 'Hardware & IoT', icon: 'fas fa-microchip' },
      { name: 'Database Technologies', category: 'Database', icon: 'fas fa-database' }
    ];

    const insertSkill = db.prepare('INSERT INTO skills (name, category, icon, display_order) VALUES (?, ?, ?, ?)');
    defaultSkills.forEach((skill, index) => {
      insertSkill.run(skill.name, skill.category, skill.icon, index + 1);
    });
    console.log('[Database] Default skills initialized.');
  }

  // Seed default Education entries if table is empty
  const eduCount = db.prepare('SELECT COUNT(*) as count FROM education_achievements').get().count;
  if (eduCount === 0) {
    const insertEdu = db.prepare('INSERT INTO education_achievements (type, title, institution, year, description, display_order) VALUES (?, ?, ?, ?, ?, ?)');
    insertEdu.run(
      'Education',
      'M.Sc Computer Science',
      'Postgraduate Degree',
      'Currently Pursuing',
      'Advancing expertise in advanced algorithms, distributed computing, database systems, and software engineering.',
      1
    );
    insertEdu.run(
      'Education',
      'B.Sc Computer Science',
      'Undergraduate Degree',
      'Completed',
      'Gained strong core competencies in computer science, data structures, programming, and web technologies.',
      2
    );
    console.log('[Database] Default education details initialized.');
  }
}

initDatabase();

module.exports = db;
