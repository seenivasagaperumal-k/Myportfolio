/**
 * Firebase Configuration & Initialization for Seenivasaga Perumal K. Portfolio
 * Project: myportfolio-c1b55
 */

const firebaseConfig = {
  apiKey: "AIzaSyA-mY6up5-bT0Kixm_eE2hag70Nqs-bGMY",
  authDomain: "myportfolio-c1b55.firebaseapp.com",
  projectId: "myportfolio-c1b55",
  storageBucket: "myportfolio-c1b55.firebasestorage.app",
  messagingSenderId: "292781424940",
  appId: "1:292781424940:web:c83a622bdc9f7fd3cd2c89",
  measurementId: "G-E1GBR5ECHP"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// References to Firebase Services
const firebaseDB = typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null;
const firebaseAuth = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null;
const firebaseStorage = typeof firebase !== 'undefined' && firebase.storage ? firebase.storage() : null;

// Initial Default Portfolio Data (Preserving all existing data bit-for-bit)
const INITIAL_DATA = {
  profile: {
    name: "Seenivasaga Perumal K.",
    title: "Computer Science Student & Developer",
    bio: "Passionate Computer Science student and software developer with a strong foundation in modern web development, Python, Android applications, and IoT innovations. Enthusiastic about creating impactful digital solutions and continuously learning new technologies.",
    education_primary: "M.Sc Computer Science (Currently Pursuing)",
    education_secondary: "B.Sc Computer Science",
    location: "Rajapalayam, Tamil Nadu, India",
    interests: "Web Development, Python, Android App Development, IoT Projects, Technology",
    email: "seenukumar9345@gmail.com",
    github_url: "",
    linkedin_url: "",
    avatar_url: "/uploads/default-avatar.svg"
  },
  skills: [
    { name: "HTML and CSS", category: "Frontend", icon: "fab fa-html5", display_order: 1 },
    { name: "JavaScript", category: "Frontend", icon: "fab fa-js", display_order: 2 },
    { name: "Python", category: "Backend & Scripting", icon: "fab fa-python", display_order: 3 },
    { name: "Web Development", category: "Full Stack", icon: "fas fa-globe", display_order: 4 },
    { name: "Android App Development", category: "Mobile", icon: "fab fa-android", display_order: 5 },
    { name: "IoT Projects", category: "Hardware & IoT", icon: "fas fa-microchip", display_order: 6 },
    { name: "Database Technologies", category: "Database", icon: "fas fa-database", display_order: 7 }
  ],
  education: [
    {
      type: "Education",
      title: "M.Sc Computer Science",
      institution: "Postgraduate Degree",
      year: "Currently Pursuing",
      description: "Advancing expertise in advanced algorithms, distributed computing, database systems, and software engineering.",
      display_order: 1
    },
    {
      type: "Education",
      title: "B.Sc Computer Science",
      institution: "Undergraduate Degree",
      year: "Completed",
      description: "Gained strong core competencies in computer science, data structures, programming, and web technologies.",
      display_order: 2
    }
  ],
  projects: [
    {
      id: "project-1",
      title: "FABBRIDGE",
      description: "FabBridge is a manufacturing collaboration platform that connects customers with suitable manufacturing companies.\nCustomers can request services, submit requirements, and receive quotations from companies.\nThey can accept quotations, confirm orders, and track manufacturing progress.\nFabBridge aims to simplify communication, improve resource utilization, and make manufacturing collaboration more efficient.",
      category: "Website",
      thumbnail: "/uploads/Screenshot__18_-1792038599320-25341.png",
      screenshots: ["/uploads/Screenshot_2026-10-13_114720-1792038599328-273711.png"],
      technologies: "Frontend: HTML, CSS, JavaScript  Backend: Python  Database: Firebase Firestore",
      github_url: "",
      demo_url: "https://poetic-cendol-27ceb8.netlify.app/",
      status: "Completed",
      featured: 1,
      created_at: "2026-10-15T04:29:59.000Z"
    }
  ]
};

// Auto-seed Firestore on first connection if collections are empty
async function autoSeedFirestore() {
  if (!firebaseDB) return;
  try {
    const profDoc = await firebaseDB.collection('profile').doc('main').get();
    if (!profDoc.exists) {
      await firebaseDB.collection('profile').doc('main').set(INITIAL_DATA.profile);
      console.log('[Firebase] Profile data seeded into Firestore.');
    }

    const skillsSnap = await firebaseDB.collection('skills').get();
    if (skillsSnap.empty) {
      for (const skill of INITIAL_DATA.skills) {
        await firebaseDB.collection('skills').add(skill);
      }
      console.log('[Firebase] Skills data seeded into Firestore.');
    }

    const eduSnap = await firebaseDB.collection('education').get();
    if (eduSnap.empty) {
      for (const edu of INITIAL_DATA.education) {
        await firebaseDB.collection('education').add(edu);
      }
      console.log('[Firebase] Education data seeded into Firestore.');
    }

    const projSnap = await firebaseDB.collection('projects').get();
    if (projSnap.empty) {
      for (const p of INITIAL_DATA.projects) {
        const id = p.id;
        const copy = { ...p };
        delete copy.id;
        await firebaseDB.collection('projects').doc(id).set(copy);
      }
      console.log('[Firebase] Projects data (FABBRIDGE) seeded into Firestore.');
    }
  } catch (err) {
    // If Firestore rules are locked or offline, fallback to INITIAL_DATA
    console.warn('[Firebase] Firestore read/seed check (will use local fallback if locked):', err.message);
  }
}

// Run autoSeed on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    autoSeedFirestore();
  });
}
