/**
 * Projects Explorer Script (projects.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  let activeCategory = 'All';
  let searchTerm = '';
  const searchInput = document.getElementById('projectSearchInput');
  const filterBar = document.getElementById('categoryFilterBar');
  const grid = document.getElementById('projectsExplorerGrid');

  async function fetchAndRenderProjects() {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p style="margin-top: 1rem;">Searching projects...</p>
      </div>
    `;

    try {
      let url = `/api/projects?`;
      if (activeCategory && activeCategory !== 'All') {
        url += `category=${encodeURIComponent(activeCategory)}&`;
      }
      if (searchTerm && searchTerm.trim()) {
        url += `search=${encodeURIComponent(searchTerm.trim())}&`;
      }

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
        const fb = await fetch('/projects.json').catch(() => null);
        if (fb && fb.ok) {
          const fbData = await fb.json();
          list = fbData.projects || [];
        }
      }

      if (!list.length && typeof INITIAL_DATA !== 'undefined') {
        list = INITIAL_DATA.projects;
      }

      if (activeCategory && activeCategory !== 'All') {
        list = list.filter(p => p.category === activeCategory);
      }
      if (searchTerm && searchTerm.trim()) {
        const s = searchTerm.trim().toLowerCase();
        list = list.filter(p =>
          p.title.toLowerCase().includes(s) ||
          p.description.toLowerCase().includes(s) ||
          (p.technologies || '').toLowerCase().includes(s)
        );
      }
      const data = { success: true, projects: list };

      if (!data.success || !data.projects || data.projects.length === 0) {
        grid.innerHTML = `
          <div class="projects-empty-state">
            <i class="fas fa-search"></i>
            <h3>No Projects Found</h3>
            <p>Try searching with another keyword or selecting a different category filter.</p>
            <button class="btn btn-secondary btn-sm" id="resetSearchBtn">
              <i class="fas fa-rotate-left"></i> Reset Filters
            </button>
          </div>
        `;

        const resetBtn = document.getElementById('resetSearchBtn');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            activeCategory = 'All';
            searchTerm = '';
            if (searchInput) searchInput.value = '';
            if (filterBar) {
              filterBar.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-category') === 'All');
              });
            }
            fetchAndRenderProjects();
          });
        }
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
      console.error(err);
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 2rem;">Error loading projects.</div>`;
    }
  }

  // Category Filter clicks
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-btn')) {
        filterBar.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        activeCategory = e.target.getAttribute('data-category');
        fetchAndRenderProjects();
      }
    });
  }

  // Search input typing debounce
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTerm = e.target.value;
      searchTimeout = setTimeout(() => {
        fetchAndRenderProjects();
      }, 350);
    });
  }

  fetchAndRenderProjects();
});

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
