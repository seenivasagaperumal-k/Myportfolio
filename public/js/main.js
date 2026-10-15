/**
 * Seenivasaga Perumal K. - Portfolio Client Script (main.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTypewriter();
  loadProfileData();
  loadSkillsData();
  loadProjectsData('All');
  loadEducationData();
  initContactForm();
  initScrollTop();
});

/* ==================== NAVBAR ==================== */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = navToggle.querySelector('i');
      if (navMenu.classList.contains('active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
      } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
      }
    });

    // Close menu on nav-link click
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        const icon = navToggle.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-times');
          icon.classList.add('fa-bars');
        }
      });
    });
  }
}

/* ==================== TYPEWRITER EFFECT ==================== */
function initTypewriter() {
  const target = document.getElementById('typewriterText');
  if (!target) return;

  const words = [
    'Web Development',
    'Python',
    'Android App Development',
    'IoT Projects',
    'Technology'
  ];

  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingSpeed = 120;

  function type() {
    const currentWord = words[wordIndex];
    if (isDeleting) {
      target.textContent = currentWord.substring(0, charIndex - 1);
      charIndex--;
      typingSpeed = 60;
    } else {
      target.textContent = currentWord.substring(0, charIndex + 1);
      charIndex++;
      typingSpeed = 110;
    }

    if (!isDeleting && charIndex === currentWord.length) {
      typingSpeed = 1800; // Pause at end of word
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      typingSpeed = 400; // Pause before new word
    }

    setTimeout(type, typingSpeed);
  }

  type();
}

/* ==================== PROFILE DATA ==================== */
async function loadProfileData() {
  try {
    let res = await fetch('/api/profile');
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      const fb = await fetch('/profile.json');
      data = await fb.json();
    }
    if (!data.success || !data.profile) return;

    const p = data.profile;
    
    // Hero & Navbar Elements
    if (p.name) {
      document.getElementById('heroName').innerHTML = `${escapeHTML(p.name)}`;
      document.getElementById('aboutFullName').textContent = p.name;
    }

    if (p.bio) {
      document.getElementById('heroBio').textContent = p.bio;
      document.getElementById('aboutBioText').textContent = p.bio;
    }

    if (p.education_primary || p.education_secondary) {
      const eduSummary = `${p.education_secondary || 'B.Sc CS'}, Pursuing ${p.education_primary || 'M.Sc CS'}`;
      document.getElementById('heroEdu').textContent = eduSummary;
      document.getElementById('aboutEduPrimary').textContent = p.education_primary || 'M.Sc Computer Science';
      document.getElementById('aboutEduSecondary').textContent = p.education_secondary || 'B.Sc Computer Science';
    }

    if (p.location) {
      document.getElementById('heroLoc').textContent = p.location;
      document.getElementById('aboutLocation').textContent = p.location;
      document.getElementById('contactLocation').textContent = p.location;
    }

    if (p.avatar_url) {
      const heroAvatar = document.getElementById('heroAvatar');
      if (heroAvatar) heroAvatar.src = p.avatar_url;
    }

    if (p.email) {
      const contactEmailDisplay = document.getElementById('contactEmailDisplay');
      if (contactEmailDisplay) {
        contactEmailDisplay.innerHTML = `<a href="mailto:${escapeHTML(p.email)}">${escapeHTML(p.email)}</a>`;
      }
    }

    // Social Links
    const linkGithub = document.getElementById('linkGithub');
    const linkLinkedin = document.getElementById('linkLinkedin');
    if (linkGithub && p.github_url) {
      linkGithub.href = p.github_url;
      linkGithub.style.display = 'inline-flex';
    }
    if (linkLinkedin && p.linkedin_url) {
      linkLinkedin.href = p.linkedin_url;
      linkLinkedin.style.display = 'inline-flex';
    }

    // Interests pills
    if (p.interests) {
      const container = document.getElementById('interestsContainer');
      if (container) {
        const interestsList = p.interests.split(',').map(s => s.trim()).filter(Boolean);
        container.innerHTML = interestsList.map(item => `
          <span class="interest-pill"><i class="fas fa-check-circle"></i> ${escapeHTML(item)}</span>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load profile data:', err);
  }
}

/* ==================== SKILLS DATA ==================== */
async function loadSkillsData() {
  const grid = document.getElementById('skillsGrid');
  if (!grid) return;

  try {
    let res = await fetch('/api/skills');
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      const fb = await fetch('/profile.json');
      const fbData = await fb.json();
      data = { success: true, skills: fbData.skills || [] };
    }
    if (!data.success || !data.skills) return;

    if (data.skills.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No skills listed yet.</div>`;
      return;
    }

    grid.innerHTML = data.skills.map(skill => {
      return `
        <div class="skill-card">
          <div class="skill-icon-wrapper">
            <i class="${escapeHTML(skill.icon || 'fas fa-code')}"></i>
          </div>
          <div class="skill-info">
            <h4>${escapeHTML(skill.name)}</h4>
            <span>${escapeHTML(skill.category || 'Specialization')}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load skills:', err);
  }
}

/* ==================== PROJECTS DATA ==================== */
let currentCategory = 'All';

async function loadProjectsData(category = 'All') {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
      <i class="fas fa-spinner fa-spin fa-2x"></i>
      <p style="margin-top: 1rem;">Loading projects...</p>
    </div>
  `;

  try {
    let url = `/api/projects?limit=9`;
    if (category && category !== 'All') {
      url += `&category=${encodeURIComponent(category)}`;
    }

    let res = await fetch(url);
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      const fb = await fetch('/projects.json');
      const fbData = await fb.json();
      let list = fbData.projects || [];
      if (category && category !== 'All') {
        list = list.filter(p => p.category === category);
      }
      data = { success: true, projects: list.slice(0, 9) };
    }

    if (!data.success || !data.projects || data.projects.length === 0) {
      grid.innerHTML = `
        <div class="projects-empty-state">
          <i class="fas fa-layer-group"></i>
          <h3>No Projects Uploaded in "${escapeHTML(category)}" Yet</h3>
          <p>Seenivasaga can upload and showcase projects directly from the Owner Admin Dashboard.</p>
          <a href="/login.html" class="btn btn-primary btn-sm">
            <i class="fas fa-plus"></i> Upload First Project
          </a>
        </div>
      `;
      return;
    }

    grid.innerHTML = data.projects.map(proj => {
      const isCompleted = (proj.status || 'Completed').toLowerCase() === 'completed';
      const statusClass = isCompleted ? 'completed' : 'inprogress';
      const techList = (proj.technologies || '').split(',').map(t => t.trim()).filter(Boolean);

      return `
        <article class="project-card">
          <div class="project-thumb-container">
            <img src="${escapeHTML(proj.thumbnail || '/uploads/default-project.svg')}" alt="${escapeHTML(proj.title)}" class="project-thumb-img" onerror="this.src='/uploads/default-project.svg'">
            <span class="project-category-badge">${escapeHTML(proj.category)}</span>
            <span class="project-status-badge ${statusClass}">${escapeHTML(proj.status || 'Completed')}</span>
          </div>

          <div class="project-body">
            <h3 class="project-title">${escapeHTML(proj.title)}</h3>
            <p class="project-desc">${escapeHTML(proj.description)}</p>

            <div class="project-tech-tags">
              ${techList.slice(0, 4).map(t => `<span class="tech-tag">${escapeHTML(t)}</span>`).join('')}
              ${techList.length > 4 ? `<span class="tech-tag">+${techList.length - 4}</span>` : ''}
            </div>

            <div class="project-footer-links">
              <a href="/project-details.html?id=${proj.id}" class="btn btn-outline btn-sm">
                View Details <i class="fas fa-arrow-right"></i>
              </a>

              <div class="project-links-group">
                ${proj.github_url ? `
                  <a href="${escapeHTML(proj.github_url)}" target="_blank" class="project-icon-link" title="Source Code">
                    <i class="fab fa-github"></i>
                  </a>
                ` : ''}
                ${proj.demo_url ? `
                  <a href="${escapeHTML(proj.demo_url)}" target="_blank" class="project-icon-link" title="Live Preview">
                    <i class="fas fa-external-link-alt"></i>
                  </a>
                ` : ''}
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load projects:', err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 2rem;">Error loading projects.</div>`;
  }
}

// Category filter button listeners
const filterBar = document.getElementById('categoryFilterBar');
if (filterBar) {
  filterBar.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-btn')) {
      filterBar.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.getAttribute('data-category');
      loadProjectsData(currentCategory);
    }
  });
}

/* ==================== EDUCATION DATA ==================== */
async function loadEducationData() {
  const container = document.getElementById('educationTimeline');
  if (!container) return;

  try {
    let res = await fetch('/api/education-achievements');
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      const fb = await fetch('/profile.json');
      const fbData = await fb.json();
      data = { success: true, items: fbData.education || [] };
    }
    if (!data.success || !data.items || data.items.length === 0) return;

    container.innerHTML = data.items.map(item => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-meta">
            <span class="timeline-inst">${escapeHTML(item.institution)}</span>
            <span class="timeline-year">${escapeHTML(item.year)}</span>
          </div>
          <h4>${escapeHTML(item.title)}</h4>
          <p>${escapeHTML(item.description || '')}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load education data:', err);
  }
}

/* ==================== CONTACT FORM ==================== */
function initContactForm() {
  const form = document.getElementById('contactForm');
  const feedback = document.getElementById('contactFeedback');
  const submitBtn = document.getElementById('btnSubmitContact');
  if (!form || !feedback) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.className = 'form-feedback';
    feedback.style.display = 'none';

    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const subject = document.getElementById('contactSubject').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !email || !message) {
      feedback.textContent = 'Please complete all required fields.';
      feedback.className = 'form-feedback error';
      feedback.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending message...';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });
      const data = await res.json();

      if (data.success) {
        feedback.textContent = data.message;
        feedback.className = 'form-feedback success';
        feedback.style.display = 'block';
        form.reset();
      } else {
        feedback.textContent = data.message || 'Failed to deliver message.';
        feedback.className = 'form-feedback error';
        feedback.style.display = 'block';
      }
    } catch (err) {
      feedback.textContent = 'Network error. Please try again later.';
      feedback.className = 'form-feedback error';
      feedback.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    }
  });
}

/* ==================== SCROLL TO TOP ==================== */
function initScrollTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* Helper to prevent XSS */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
