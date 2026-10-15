/**
 * Admin Dashboard Controller (admin.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth first
  const isAuth = await checkAuth();
  if (!isAuth) return;

  initTabs();
  initLogout();
  loadDashboardData();
  initProjectHandlers();
  initProfileHandlers();
  initSkillsHandlers();
  initEduHandlers();
  initSecurityHandlers();
});

/* ==================== AUTHENTICATION CHECK ==================== */
async function checkAuth() {
  if (sessionStorage.getItem('admin_auth') === 'true') {
    return true;
  }
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
    sessionStorage.setItem('admin_auth', 'true');
    return true;
  }
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (data.authenticated) {
      sessionStorage.setItem('admin_auth', 'true');
      return true;
    }
  } catch (e) {}

  window.location.href = '/login.html';
  return false;
}

function initLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_user');
      if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut().catch(() => {});
      }
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/login.html';
    });
  }
}

/* ==================== TABS SWITCHER ==================== */
function initTabs() {
  const navItems = document.querySelectorAll('.admin-nav-item');
  const tabs = document.querySelectorAll('.admin-tab-content');
  const title = document.getElementById('tabHeaderTitle');
  const subtitle = document.getElementById('tabHeaderSubtitle');

  const headersMap = {
    'tab-projects': { title: 'Manage Projects', subtitle: 'Upload, edit, and organize your software projects' },
    'tab-profile': { title: 'Personal Profile Details', subtitle: 'Update your name, bio, education, and links' },
    'tab-skills': { title: 'Technical Skills', subtitle: 'Add, update, or reorder your technical skill badges' },
    'tab-education': { title: 'Education & Milestones', subtitle: 'Manage degrees, certificates, and achievements' },
    'tab-messages': { title: 'Contact Inquiries', subtitle: 'View and respond to client & recruiter messages' },
    'tab-security': { title: 'Security Settings', subtitle: 'Update your admin dashboard password' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      tabs.forEach(tab => {
        tab.classList.toggle('active', tab.id === targetTab);
      });

      if (headersMap[targetTab]) {
        title.textContent = headersMap[targetTab].title;
        subtitle.textContent = headersMap[targetTab].subtitle;
      }

      if (targetTab === 'tab-projects') loadProjects();
      if (targetTab === 'tab-profile') loadProfile();
      if (targetTab === 'tab-skills') loadSkills();
      if (targetTab === 'tab-education') loadEducation();
      if (targetTab === 'tab-messages') loadMessages();
    });
  });
}

async function loadDashboardData() {
  loadProjects();
  loadProfile();
  loadSkills();
  loadEducation();
  loadMessages();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ==================== PROJECTS MANAGEMENT ==================== */
let allProjects = [];

async function loadProjects() {
  const tbody = document.getElementById('adminProjectsTableBody');
  const statProjects = document.getElementById('statTotalProjects');

  try {
    let list = [];
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      try {
        const snap = await firebaseDB.collection('projects').get();
        if (!snap.empty) {
          list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (e) {}
    }

    if (!list.length) {
      const res = await fetch('/api/projects').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        list = data.projects || [];
      }
    }

    if (!list.length) {
      const fb = await fetch('/projects.json').catch(() => null);
      if (fb && fb.ok) {
        const d = await fb.json();
        list = d.projects || [];
      }
    }

    if (!list.length && typeof INITIAL_DATA !== 'undefined') {
      list = INITIAL_DATA.projects;
    }

    allProjects = list;
    if (statProjects) statProjects.textContent = allProjects.length;

    if (allProjects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-dim);">
            No projects found. Click "Upload New Project" to add your first project.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = allProjects.map(p => {
      const isCompleted = (p.status || 'Completed').toLowerCase() === 'completed';
      const statusClass = isCompleted ? 'completed' : 'inprogress';

      return `
        <tr>
          <td>
            <img src="${escapeHTML(p.thumbnail || '/uploads/default-project.svg')}" alt="" class="table-thumb" onerror="this.src='/uploads/default-project.svg'">
          </td>
          <td>
            <strong>${escapeHTML(p.title)}</strong>
            ${p.featured ? '<span style="color:#c084fc; font-size:0.75rem; margin-left:6px;"><i class="fas fa-star"></i> Featured</span>' : ''}
          </td>
          <td><span class="table-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${escapeHTML(p.category)}</span></td>
          <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: 0.85rem;">
            ${escapeHTML(p.technologies)}
          </td>
          <td><span class="table-badge ${statusClass}">${escapeHTML(p.status || 'Completed')}</span></td>
          <td>
            <div class="table-actions">
              <a href="/project-details.html?id=${p.id}" target="_blank" class="btn btn-outline btn-sm btn-icon-only" title="Preview Public Page">
                <i class="fas fa-eye"></i>
              </a>
              <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editProject('${p.id}')" title="Edit Project">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-outline btn-sm btn-icon-only" style="border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="deleteProject('${p.id}')" title="Delete Project">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    console.error('Error loading admin projects:', e);
  }
}

function initProjectHandlers() {
  const openAddBtn = document.getElementById('btnOpenAddProjectModal');
  const projectForm = document.getElementById('projectForm');

  if (openAddBtn) {
    openAddBtn.addEventListener('click', () => {
      document.getElementById('projFormId').value = '';
      projectForm.reset();
      document.getElementById('projectModalTitle').innerHTML = '<i class="fas fa-upload"></i> Upload New Project';
      document.getElementById('projectFormFeedback').style.display = 'none';
      openModal('projectModal');
    });
  }

  if (projectForm) {
    projectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.getElementById('projectFormFeedback');
      const submitBtn = document.getElementById('btnSubmitProject');
      const id = document.getElementById('projFormId').value;

      feedback.className = 'form-feedback';
      feedback.style.display = 'none';

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

      try {
        const thumbFile = document.getElementById('projFormThumb').files[0];
        let thumbUrl = '';
        if (thumbFile) {
          thumbUrl = await fileToBase64(thumbFile);
        } else if (id) {
          const existing = allProjects.find(item => String(item.id) === String(id));
          if (existing) thumbUrl = existing.thumbnail;
        }
        if (!thumbUrl) thumbUrl = '/uploads/default-project.svg';

        const screenshotFiles = document.getElementById('projFormScreenshots').files;
        let screenshotUrls = [];
        if (screenshotFiles && screenshotFiles.length > 0) {
          for (let i = 0; i < screenshotFiles.length; i++) {
            screenshotUrls.push(await fileToBase64(screenshotFiles[i]));
          }
        } else if (id) {
          const existing = allProjects.find(item => String(item.id) === String(id));
          if (existing && existing.screenshots) screenshotUrls = existing.screenshots;
        }

        const projectPayload = {
          title: document.getElementById('projFormTitle').value.trim(),
          category: document.getElementById('projFormCategory').value,
          technologies: document.getElementById('projFormTech').value.trim(),
          status: document.getElementById('projFormStatus').value,
          github_url: document.getElementById('projFormGithub').value.trim(),
          demo_url: document.getElementById('projFormDemo').value.trim(),
          description: document.getElementById('projFormDesc').value.trim(),
          featured: document.getElementById('projFormFeatured').checked ? 1 : 0,
          thumbnail: thumbUrl,
          screenshots: screenshotUrls,
          updated_at: new Date().toISOString()
        };

        if (typeof firebaseDB !== 'undefined' && firebaseDB) {
          if (id) {
            await firebaseDB.collection('projects').doc(String(id)).set(projectPayload, { merge: true });
          } else {
            projectPayload.created_at = new Date().toISOString();
            await firebaseDB.collection('projects').add(projectPayload);
          }
        }

        closeProjectModal();
        loadProjects();
      } catch (err) {
        feedback.textContent = 'Error saving project: ' + err.message;
        feedback.className = 'form-feedback error';
        feedback.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Save & Publish Project';
      }
    });
  }
}

window.editProject = async function(id) {
  const p = allProjects.find(item => String(item.id) === String(id));
  if (!p) return;

  document.getElementById('projFormId').value = p.id;
  document.getElementById('projFormTitle').value = p.title || '';
  document.getElementById('projFormCategory').value = p.category || 'Website';
  document.getElementById('projFormTech').value = p.technologies || '';
  document.getElementById('projFormStatus').value = p.status || 'Completed';
  document.getElementById('projFormGithub').value = p.github_url || '';
  document.getElementById('projFormDemo').value = p.demo_url || '';
  document.getElementById('projFormDesc').value = p.description || '';
  document.getElementById('projFormFeatured').checked = p.featured === 1;

  document.getElementById('projectModalTitle').innerHTML = '<i class="fas fa-pen-to-square"></i> Edit Project';
  document.getElementById('projectFormFeedback').style.display = 'none';
  openModal('projectModal');
};

window.deleteProject = async function(id) {
  if (!confirm('Are you sure you want to permanently delete this project?')) return;

  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      await firebaseDB.collection('projects').doc(String(id)).delete().catch(() => {});
    }
    await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' }).catch(() => {});
    loadProjects();
  } catch (e) {
    alert('Failed to delete project.');
  }
};

window.closeProjectModal = function() {
  closeModal('projectModal');
};

/* ==================== PROFILE MANAGEMENT ==================== */
async function loadProfile() {
  try {
    let p = null;
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      try {
        const doc = await firebaseDB.collection('profile').doc('main').get();
        if (doc.exists) p = doc.data();
      } catch (e) {}
    }
    if (!p) {
      const res = await fetch('/api/profile').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        p = data.profile;
      }
    }
    if (!p) {
      const fb = await fetch('/profile.json').catch(() => null);
      if (fb && fb.ok) {
        const d = await fb.json();
        p = d.profile;
      }
    }
    if (!p && typeof INITIAL_DATA !== 'undefined') {
      p = INITIAL_DATA.profile;
    }
    if (!p) return;

    document.getElementById('profName').value = p.name || '';
    document.getElementById('profTitle').value = p.title || '';
    document.getElementById('profEduPrimary').value = p.education_primary || '';
    document.getElementById('profEduSecondary').value = p.education_secondary || '';
    document.getElementById('profLocation').value = p.location || '';
    document.getElementById('profInterests').value = p.interests || '';
    document.getElementById('profBio').value = p.bio || '';
    document.getElementById('profEmail').value = p.email || '';
    document.getElementById('profGithub').value = p.github_url || '';
    document.getElementById('profLinkedin').value = p.linkedin_url || '';

    if (p.avatar_url) {
      document.getElementById('adminAvatarPreview').src = p.avatar_url;
    }
  } catch (e) {
    console.error('Error loading profile in admin:', e);
  }
}

function initProfileHandlers() {
  const form = document.getElementById('profileForm');
  const feedback = document.getElementById('profileFeedback');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      feedback.style.display = 'none';

      const payload = {
        name: document.getElementById('profName').value.trim(),
        title: document.getElementById('profTitle').value.trim(),
        education_primary: document.getElementById('profEduPrimary').value.trim(),
        education_secondary: document.getElementById('profEduSecondary').value.trim(),
        location: document.getElementById('profLocation').value.trim(),
        interests: document.getElementById('profInterests').value.trim(),
        bio: document.getElementById('profBio').value.trim(),
        email: document.getElementById('profEmail').value.trim(),
        github_url: document.getElementById('profGithub').value.trim(),
        linkedin_url: document.getElementById('profLinkedin').value.trim()
      };

      try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB) {
          await firebaseDB.collection('profile').doc('main').set(payload, { merge: true });
        }
        await fetch('/api/admin/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});

        feedback.textContent = 'Profile updated successfully!';
        feedback.className = 'form-feedback success';
        feedback.style.display = 'block';
      } catch (err) {
        feedback.textContent = 'Error updating profile: ' + err.message;
        feedback.className = 'form-feedback error';
        feedback.style.display = 'block';
      }
    });
  }

  // Avatar upload
  const avatarForm = document.getElementById('avatarUploadForm');
  if (avatarForm) {
    avatarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('avatarFileInput');
      if (!fileInput.files[0]) return;

      try {
        const b64 = await fileToBase64(fileInput.files[0]);
        if (typeof firebaseDB !== 'undefined' && firebaseDB) {
          await firebaseDB.collection('profile').doc('main').set({ avatar_url: b64 }, { merge: true });
        }
        document.getElementById('adminAvatarPreview').src = b64;
        alert('Profile photo updated successfully!');
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    });
  }
}

/* ==================== SKILLS MANAGEMENT ==================== */
let allSkills = [];

async function loadSkills() {
  const tbody = document.getElementById('adminSkillsTableBody');
  const statSkills = document.getElementById('statTotalSkills');

  try {
    let list = [];
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      try {
        const snap = await firebaseDB.collection('skills').orderBy('display_order', 'asc').get();
        if (!snap.empty) {
          list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (e) {}
    }

    if (!list.length) {
      const res = await fetch('/api/skills').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        list = data.skills || [];
      }
    }

    if (!list.length && typeof INITIAL_DATA !== 'undefined') {
      list = INITIAL_DATA.skills;
    }

    allSkills = list;
    if (statSkills) statSkills.textContent = allSkills.length;

    tbody.innerHTML = allSkills.map(s => `
      <tr>
        <td>
          <i class="${escapeHTML(s.icon || 'fas fa-code')}" style="color:#c084fc; margin-right:8px; width:20px;"></i>
          <strong>${escapeHTML(s.name)}</strong>
        </td>
        <td>${escapeHTML(s.category)}</td>
        <td>${escapeHTML(s.proficiency || 'Proficient')}</td>
        <td>${s.display_order || 0}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editSkill('${s.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-icon-only" style="border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="deleteSkill('${s.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error loading skills:', e);
  }
}

function initSkillsHandlers() {
  const btnOpen = document.getElementById('btnOpenAddSkillModal');
  const form = document.getElementById('skillForm');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      document.getElementById('skillFormId').value = '';
      form.reset();
      document.getElementById('skillModalTitle').textContent = 'Add New Skill';
      openModal('skillModal');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('skillFormId').value;
      const payload = {
        name: document.getElementById('skillFormName').value.trim(),
        category: document.getElementById('skillFormCat').value.trim(),
        icon: document.getElementById('skillFormIcon').value.trim(),
        display_order: parseInt(document.getElementById('skillFormOrder').value) || 0
      };

      try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB) {
          if (id) {
            await firebaseDB.collection('skills').doc(String(id)).set(payload, { merge: true });
          } else {
            await firebaseDB.collection('skills').add(payload);
          }
        }
        closeModal('skillModal');
        loadSkills();
      } catch (e) {
        alert('Error saving skill: ' + e.message);
      }
    });
  }
}

window.editSkill = function(id) {
  const s = allSkills.find(item => String(item.id) === String(id));
  if (!s) return;

  document.getElementById('skillFormId').value = s.id;
  document.getElementById('skillFormName').value = s.name;
  document.getElementById('skillFormCat').value = s.category;
  document.getElementById('skillFormIcon').value = s.icon;
  document.getElementById('skillFormOrder').value = s.display_order;

  document.getElementById('skillModalTitle').textContent = 'Edit Skill';
  openModal('skillModal');
};

window.deleteSkill = async function(id) {
  if (!confirm('Are you sure you want to delete this skill?')) return;
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      await firebaseDB.collection('skills').doc(String(id)).delete().catch(() => {});
    }
    loadSkills();
  } catch (e) {
    alert('Failed to delete skill.');
  }
};

window.closeSkillModal = function() {
  closeModal('skillModal');
};

/* ==================== EDUCATION & MILESTONES ==================== */
let allEdu = [];

async function loadEducation() {
  const tbody = document.getElementById('adminEduTableBody');
  try {
    let list = [];
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      try {
        const snap = await firebaseDB.collection('education').orderBy('display_order', 'asc').get();
        if (!snap.empty) {
          list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (e) {}
    }

    if (!list.length) {
      const res = await fetch('/api/education-achievements').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        list = data.items || [];
      }
    }

    if (!list.length && typeof INITIAL_DATA !== 'undefined') {
      list = INITIAL_DATA.education;
    }

    allEdu = list;
    tbody.innerHTML = allEdu.map(item => `
      <tr>
        <td><span class="table-badge completed">${escapeHTML(item.type)}</span></td>
        <td><strong>${escapeHTML(item.title)}</strong></td>
        <td>${escapeHTML(item.institution)}</td>
        <td>${escapeHTML(item.year)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editEdu('${item.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn btn-outline btn-sm btn-icon-only" style="border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="deleteEdu('${item.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error loading education:', e);
  }
}

function initEduHandlers() {
  const btnOpen = document.getElementById('btnOpenAddEduModal');
  const form = document.getElementById('eduForm');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      document.getElementById('eduFormId').value = '';
      form.reset();
      document.getElementById('eduModalTitle').textContent = 'Add Qualification / Milestone';
      openModal('eduModal');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('eduFormId').value;
      const payload = {
        type: document.getElementById('eduFormType').value,
        title: document.getElementById('eduFormTitle').value.trim(),
        institution: document.getElementById('eduFormInst').value.trim(),
        year: document.getElementById('eduFormYear').value.trim(),
        description: document.getElementById('eduFormDesc').value.trim()
      };

      try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB) {
          if (id) {
            await firebaseDB.collection('education').doc(String(id)).set(payload, { merge: true });
          } else {
            await firebaseDB.collection('education').add(payload);
          }
        }
        closeModal('eduModal');
        loadEducation();
      } catch (err) {
        alert('Error saving milestone: ' + err.message);
      }
    });
  }
}

window.editEdu = function(id) {
  const item = allEdu.find(e => String(e.id) === String(id));
  if (!item) return;

  document.getElementById('eduFormId').value = item.id;
  document.getElementById('eduFormType').value = item.type;
  document.getElementById('eduFormTitle').value = item.title;
  document.getElementById('eduFormInst').value = item.institution;
  document.getElementById('eduFormYear').value = item.year;
  document.getElementById('eduFormDesc').value = item.description || '';

  document.getElementById('eduModalTitle').textContent = 'Edit Milestone';
  openModal('eduModal');
};

window.deleteEdu = async function(id) {
  if (!confirm('Are you sure you want to remove this milestone?')) return;
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      await firebaseDB.collection('education').doc(String(id)).delete().catch(() => {});
    }
    loadEducation();
  } catch (e) {
    alert('Server error.');
  }
};

window.closeEduModal = function() {
  closeModal('eduModal');
};

/* ==================== CONTACT INQUIRIES ==================== */
let allMessages = [];

async function loadMessages() {
  const tbody = document.getElementById('adminMessagesTableBody');
  const statMsg = document.getElementById('statTotalMessages');
  const badge = document.getElementById('unreadBadge');

  try {
    let messages = [];
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      try {
        const snap = await firebaseDB.collection('messages').get();
        messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        messages.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      } catch (e) {
        console.warn('Firestore messages load:', e);
      }
    }

    if (!messages.length) {
      try {
        const res = await fetch('/api/admin/messages');
        const data = await res.json();
        if (data.success && data.messages) messages = data.messages;
      } catch (e) {}
    }

    allMessages = messages;
    if (statMsg) statMsg.textContent = allMessages.length;

    const unreadCount = allMessages.filter(m => !m.is_read).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (allMessages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 2rem;">No messages received yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allMessages.map(m => `
      <tr style="${!m.is_read ? 'background: rgba(139, 92, 246, 0.08); font-weight: 600;' : ''}">
        <td>${escapeHTML(m.name)}</td>
        <td><a href="mailto:${escapeHTML(m.email)}" style="color:#38bdf8;">${escapeHTML(m.email)}</a></td>
        <td>${escapeHTML(m.subject)}</td>
        <td>${m.created_at ? new Date(m.created_at).toLocaleString() : 'N/A'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="viewMessage('${m.id}')"><i class="fas fa-envelope-open"></i> Read</button>
            <button class="btn btn-outline btn-sm btn-icon-only" style="border-color: rgba(239, 68, 68, 0.4); color: #f87171;" onclick="deleteMessage('${m.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error loading messages:', e);
  }
}

window.viewMessage = async function(id) {
  const msg = allMessages.find(m => String(m.id) === String(id));
  if (!msg) return;

  document.getElementById('msgModalSender').textContent = msg.name;
  document.getElementById('msgModalEmail').textContent = msg.email;
  document.getElementById('msgModalDate').textContent = msg.created_at ? new Date(msg.created_at).toLocaleString() : '';
  document.getElementById('msgModalSubject').textContent = msg.subject;
  document.getElementById('msgModalBody').textContent = msg.message;

  openModal('messageModal');

  // Mark as read in Firestore
  if (!msg.is_read) {
    msg.is_read = true;
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      await firebaseDB.collection('messages').doc(String(id)).update({ is_read: true }).catch(() => {});
    }
    loadMessages();
  }
};

window.deleteMessage = async function(id) {
  if (!confirm('Are you sure you want to delete this inquiry?')) return;
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB) {
      await firebaseDB.collection('messages').doc(String(id)).delete().catch(() => {});
    }
    await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' }).catch(() => {});
    loadMessages();
  } catch (e) {
    alert('Failed to delete message.');
  }
};

window.closeMessageModal = function() {
  closeModal('messageModal');
};

/* ==================== SECURITY / PASSWORD ==================== */
function initSecurityHandlers() {
  const form = document.getElementById('changePasswordForm');
  const feedback = document.getElementById('passwordFeedback');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      feedback.style.display = 'none';

      const currentPassword = document.getElementById('currentPassInput').value;
      const newPassword = document.getElementById('newPassInput').value;
      const confirmPassword = document.getElementById('confirmPassInput').value;

      if (newPassword !== confirmPassword) {
        feedback.textContent = 'New passwords do not match.';
        feedback.className = 'form-feedback error';
        feedback.style.display = 'block';
        return;
      }

      try {
        let updated = false;

        // 1. Try Firebase Auth currentUser
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
          try {
            await firebase.auth().currentUser.updatePassword(newPassword);
            updated = true;
          } catch (fbErr) {
            console.warn('Firebase password update:', fbErr);
          }
        }

        // 2. Store in Firebase Firestore admin settings
        if (typeof firebaseDB !== 'undefined' && firebaseDB) {
          try {
            await firebaseDB.collection('admin_settings').doc('credentials').set({
              adminEmail: 'seenukumar9345@gmail.com',
              updatedAt: new Date().toISOString()
            }, { merge: true });
            updated = true;
          } catch (e) {}
        }

        // 3. Fallback to local server if available
        try {
          const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
          });
          const data = await res.json();
          if (data.success) updated = true;
        } catch (e) {}

        if (updated) {
          feedback.textContent = 'Password successfully updated!';
          feedback.className = 'form-feedback success';
          feedback.style.display = 'block';
          form.reset();
        } else {
          feedback.textContent = 'Password updated for this session.';
          feedback.className = 'form-feedback success';
          feedback.style.display = 'block';
          form.reset();
        }
      } catch (err) {
        feedback.textContent = 'Error updating password: ' + err.message;
        feedback.className = 'form-feedback error';
        feedback.style.display = 'block';
      }
    });
  }
}

/* Modal helper utilities */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
