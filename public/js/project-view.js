/**
 * Project Details View Script (project-view.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  if (!projectId) {
    window.location.href = '/projects.html';
    return;
  }

  try {
    let res = await fetch(`/api/projects/${projectId}`);
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      const fb = await fetch('/projects.json');
      const fbData = await fb.json();
      const p = (fbData.projects || []).find(item => String(item.id) === String(projectId));
      data = { success: !!p, project: p };
    }

    if (!data.success || !data.project) {
      document.getElementById('projTitle').textContent = 'Project Not Found';
      document.getElementById('projFullDesc').textContent = 'The requested project could not be located in the repository.';
      return;
    }

    const p = data.project;

    // Header Meta
    document.title = `${p.title} | Seenivasaga Perumal K.`;
    document.getElementById('projTitle').textContent = p.title;
    document.getElementById('projCategory').textContent = p.category;

    const isCompleted = (p.status || 'Completed').toLowerCase() === 'completed';
    const statusEl = document.getElementById('projStatus');
    statusEl.textContent = p.status || 'Completed';
    statusEl.className = `project-status-badge ${isCompleted ? 'completed' : 'inprogress'}`;
    document.getElementById('projStatusDetail').textContent = p.status || 'Completed';

    // Date
    if (p.created_at) {
      const d = new Date(p.created_at);
      document.getElementById('projDate').textContent = d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    // Technologies
    const techContainer = document.getElementById('projTechTags');
    const techList = (p.technologies || '').split(',').map(t => t.trim()).filter(Boolean);
    techContainer.innerHTML = techList.map(t => `<span class="tech-tag" style="font-size:0.85rem; padding: 0.35rem 0.8rem;">${escapeHTML(t)}</span>`).join('');

    // Description
    document.getElementById('projFullDesc').textContent = p.description;

    // Links
    const liveDemoBtn = document.getElementById('projLiveDemoBtn');
    const githubBtn = document.getElementById('projGithubBtn');

    if (p.demo_url && p.demo_url.trim()) {
      liveDemoBtn.href = p.demo_url;
      liveDemoBtn.style.display = 'inline-flex';
    }
    if (p.github_url && p.github_url.trim()) {
      githubBtn.href = p.github_url;
      githubBtn.style.display = 'inline-flex';
    }

    // Media & Gallery
    const mainImg = document.getElementById('galleryMainImg');
    const thumbsContainer = document.getElementById('galleryThumbsContainer');

    const allImages = [];
    if (p.thumbnail) allImages.push(p.thumbnail);
    if (Array.isArray(p.screenshots)) {
      p.screenshots.forEach(s => {
        if (s && !allImages.includes(s)) allImages.push(s);
      });
    }

    if (allImages.length === 0) {
      allImages.push('/uploads/default-project.svg');
    }

    mainImg.src = allImages[0];

    if (allImages.length > 1) {
      thumbsContainer.innerHTML = allImages.map((imgUrl, idx) => `
        <div class="gallery-thumb-item ${idx === 0 ? 'active' : ''}" data-src="${escapeHTML(imgUrl)}">
          <img src="${escapeHTML(imgUrl)}" alt="Thumbnail ${idx + 1}" onerror="this.src='/uploads/default-project.svg'">
        </div>
      `).join('');

      thumbsContainer.querySelectorAll('.gallery-thumb-item').forEach(item => {
        item.addEventListener('click', () => {
          thumbsContainer.querySelectorAll('.gallery-thumb-item').forEach(t => t.classList.remove('active'));
          item.classList.add('active');
          mainImg.src = item.getAttribute('data-src');
        });
      });
    } else {
      thumbsContainer.style.display = 'none';
    }

    // Load developer avatar from profile API
    fetch('/api/profile')
      .then(r => r.json())
      .then(profData => {
        if (profData.success && profData.profile && profData.profile.avatar_url) {
          const devAvatar = document.getElementById('projDevAvatar');
          if (devAvatar) devAvatar.src = profData.profile.avatar_url;
        }
      })
      .catch(() => {});

  } catch (err) {
    console.error('Error fetching project details:', err);
  }
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
