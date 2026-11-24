(() => {
  'use strict';

  const STORAGE_KEY = 'mishimot.tasks.v1';
  const PRIORITY_LABELS = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };
  const CATEGORY_LABELS = { studies: 'לימודים', work: 'עבודה', personal: 'אישי', home: 'בית' };
  const elements = {
    list: document.querySelector('#task-list'),
    dialog: document.querySelector('#task-dialog'),
    form: document.querySelector('#task-form'),
    id: document.querySelector('#task-id'),
    title: document.querySelector('#task-title'),
    description: document.querySelector('#task-description'),
    dueDate: document.querySelector('#task-due-date'),
    category: document.querySelector('#task-category'),
    priority: document.querySelector('#task-priority'),
    priorityFilter: document.querySelector('#priority-filter'),
    categoryFilter: document.querySelector('#category-filter'),
    sortSelect: document.querySelector('#sort-select'),
    overdueSummary: document.querySelector('#overdue-summary'),
    overdueCount: document.querySelector('#overdue-count'),
    overdueMessage: document.querySelector('#overdue-message'),
    titleError: document.querySelector('#title-error'),
    search: document.querySelector('#search-input'),
    toast: document.querySelector('#toast-region'),
  };

  let tasks = loadTasks();
  let currentFilter = 'all';
  let sortMode = 'due-asc';
  let toastTimer;
  let dateRefreshTimer;

  function loadTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(task => task && typeof task.id === 'string' && typeof task.title === 'string')
        .map(task => ({ id: task.id, title: task.title.slice(0, 100), description: typeof task.description === 'string' ? task.description.slice(0, 300) : '', dueDate: typeof task.dueDate === 'string' ? task.dueDate : '', completed: Boolean(task.completed), createdAt: Number(task.createdAt) || Date.now(), priority: Object.hasOwn(PRIORITY_LABELS, task.priority) ? task.priority : 'medium', category: Object.hasOwn(CATEGORY_LABELS, task.category) ? task.category : 'personal' }));
    } catch (error) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      showToast('לא ניתן לשמור במכשיר. כדאי לבדוק את הגדרות האחסון בדפדפן.', true);
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(date);
  }

  function taskDueState(task, today = localDateKey(new Date())) {
    if (task.completed || !task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) return '';
    const [year, month, day] = task.dueDate.split('-').map(Number);
    if (localDateKey(new Date(year, month - 1, day)) !== task.dueDate) return '';
    if (task.dueDate < today) return 'overdue';
    if (task.dueDate === today) return 'today';
    return '';
  }

  function dueDateMarkup(task, today) {
    if (!task.dueDate) return '';
    const state = taskDueState(task, today);
    const dateClass = state === 'overdue' ? ' overdue' : (state === 'today' ? ' due-today' : '');
    const warning = state === 'overdue' ? '<span class="due-warning overdue-warning">באיחור</span>' : (state === 'today' ? '<span class="due-warning today-warning">מסתיימת היום</span>' : '');
    return `<span class="task-date${dateClass}" title="תאריך יעד ${escapeHTML(task.dueDate)}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.3" y="3.5" width="11.4" height="10" rx="1.6"/><path d="M5.2 2v3M10.8 2v3M2.5 6.5h11"/></svg>${escapeHTML(formatDate(task.dueDate))}</span>${warning}`;
  }

  function getVisibleTasks() {
    const query = elements.search.value.trim().toLocaleLowerCase('he');
    return tasks.filter(task => {
      const matchesFilter = currentFilter === 'all' || (currentFilter === 'active' && !task.completed) || (currentFilter === 'completed' && task.completed);
      const title = task.title.toLocaleLowerCase('he');
      const matchesPriority = elements.priorityFilter.value === 'all' || task.priority === elements.priorityFilter.value;
      const matchesCategory = elements.categoryFilter.value === 'all' || task.category === elements.categoryFilter.value;
      return matchesFilter && matchesPriority && matchesCategory && (!query || title.includes(query));
    }).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (sortMode === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        const priorityDifference = order[a.priority] - order[b.priority];
        if (priorityDifference) return priorityDifference;
      }
      if (a.dueDate !== b.dueDate && (!a.dueDate || !b.dueDate)) return a.dueDate ? -1 : 1;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        const direction = sortMode === 'due-desc' ? -1 : 1;
        return direction * a.dueDate.localeCompare(b.dueDate);
      }
      return a.createdAt - b.createdAt;
    });
  }

  function emptyMarkup() {
    const query = elements.search.value.trim();
    const hasExtraFilters = elements.priorityFilter.value !== 'all' || elements.categoryFilter.value !== 'all';
    if (query || hasExtraFilters) {
      const message = query ? 'לא מצאנו משימות עם הכותרת הזו. נסו מילה אחרת.' : 'לא נמצאו משימות במסננים שנבחרו. אפשר לשנות את העדיפות או הקטגוריה.';
      return `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">⌕</div><h3>לא נמצאו תוצאות</h3><p>${message}</p></div>`;
    }
    if (currentFilter === 'completed') return '<div class="empty-state"><div class="empty-illustration" aria-hidden="true">✓</div><h3>עוד לא הושלמו משימות</h3><p>כשתסיימו משימה, היא תחכה לכם כאן. כל צעד קטן נחשב.</p></div>';
    if (currentFilter === 'active') return '<div class="empty-state"><div class="empty-illustration" aria-hidden="true">✦</div><h3>הכול הושלם!</h3><p>אין כרגע משימות פעילות. אפשר להוסיף משימה חדשה ולהמשיך להתקדם.</p><button class="button button-primary" type="button" data-action="add">＋ משימה חדשה</button></div>';
    return '<div class="empty-state"><div class="empty-illustration" aria-hidden="true">✳</div><h3>עוד אין כאן משימות</h3><p>הגיע הזמן להוציא את התוכניות מהראש ולהפוך אותן לצעדים קטנים שאפשר לבצע.</p><button class="button button-primary" type="button" data-action="add">＋ הוספת המשימה הראשונה</button></div>';
  }

  function taskMarkup(task, today) {
    const checked = task.completed ? ' checked' : '';
    const rowState = task.completed ? ' is-completed' : '';
    const badge = task.completed ? '<span class="task-badge done">הושלמה</span>' : (task.dueDate ? '' : '<span class="task-badge">בתהליך</span>');
    const description = task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : '';
    const priority = Object.hasOwn(PRIORITY_LABELS, task.priority) ? task.priority : 'medium';
    const category = Object.hasOwn(CATEGORY_LABELS, task.category) ? task.category : 'personal';
    const chips = `<span class="category-chip">${CATEGORY_LABELS[category]}</span><span class="priority-chip priority-${priority}">עדיפות ${PRIORITY_LABELS[priority]}</span>`;
    return `<article class="task-row${rowState}" data-task-id="${escapeHTML(task.id)}"><input class="task-check" type="checkbox" aria-label="${task.completed ? 'סימון כפעילה' : 'סימון כהושלמה'}: ${escapeHTML(task.title)}"${checked}><div class="task-copy"><h3 class="task-title">${escapeHTML(task.title)}</h3>${description}<div class="task-meta">${chips}${dueDateMarkup(task, today)}${badge}</div></div><div class="row-actions"><button class="row-action" type="button" data-action="edit" aria-label="עריכת המשימה: ${escapeHTML(task.title)}" title="עריכה"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10.8 2.4 2.8 2.8M3 13l2.8-.6 7.5-7.5a1.5 1.5 0 0 0-2.1-2.1l-7.5 7.5L3 13Z"/></svg><span>עריכה</span></button><button class="row-action delete" type="button" data-action="delete" aria-label="מחיקת המשימה: ${escapeHTML(task.title)}" title="מחיקה"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 9h6.6l.7-9M6.5 7v4M9.5 7v4"/></svg><span>מחיקה</span></button></div></article>`;
  }

  function render() {
    const today = localDateKey(new Date());
    document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const active = tasks.filter(task => !task.completed).length;
    const completed = tasks.length - active;
    const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    const overdue = tasks.filter(task => taskDueState(task, today) === 'overdue').length;
    document.querySelector('#stat-total').textContent = String(tasks.length);
    document.querySelector('#stat-active').textContent = String(active);
    document.querySelector('#stat-completed').textContent = String(completed);
    document.querySelector('#count-all').textContent = String(tasks.length);
    document.querySelector('#count-active').textContent = String(active);
    document.querySelector('#count-completed').textContent = String(completed);
    document.querySelector('#nav-total').textContent = String(tasks.length);
    document.querySelector('#completion-text').textContent = completed ? 'עוד הישג קטן בדרך' : 'כל הישג מתחיל בצעד';
    document.querySelector('#progress-percent').textContent = `${progress}%`;
    document.querySelector('#progress-text').textContent = tasks.length ? `הושלמו ${completed} מתוך ${tasks.length} משימות` : 'עדיין אין משימות שהושלמו';
    document.querySelector('#progress-track').setAttribute('aria-valuenow', String(progress));
    document.querySelector('#progress-fill').style.width = `${progress}%`;
    elements.overdueCount.textContent = String(overdue);
    elements.overdueMessage.textContent = overdue ? 'כדאי לעבור עליהן ולבחור מועד חדש' : 'כל המשימות עומדות בתכנון';
    elements.overdueSummary.classList.toggle('has-overdue', overdue > 0);
    elements.overdueSummary.classList.toggle('all-clear', overdue === 0);

    const visible = getVisibleTasks();
    elements.list.innerHTML = visible.length ? visible.map(task => taskMarkup(task, today)).join('') : emptyMarkup();
    document.querySelector('#list-summary').textContent = `מציגות ${visible.length} מתוך ${tasks.length} משימות`;
  }

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(tab => {
      const selected = tab.dataset.filter === filter;
      tab.classList.toggle('selected', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    document.querySelectorAll('[data-nav-filter]').forEach(link => link.classList.toggle('active', link.dataset.navFilter === filter));
    document.querySelector('.nav-link[href="#ראשי"]').classList.toggle('active', filter === 'all' && location.hash !== '#רשימת-המשימות');
    render();
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' error' : ''}`;
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${isError ? '!' : '✓'}</span><span>${escapeHTML(message)}</span>`;
    elements.toast.replaceChildren(toast);
    toastTimer = window.setTimeout(() => toast.remove(), 3200);
  }

  function openDialog(task = null) {
    elements.form.reset();
    elements.titleError.textContent = '';
    elements.id.value = task ? task.id : '';
    document.querySelector('#dialog-title').textContent = task ? 'עריכת משימה' : 'משימה חדשה';
    document.querySelector('#save-task-button').textContent = task ? 'שמירת שינויים' : 'שמירת משימה';
    if (task) {
      elements.title.value = task.title;
      elements.description.value = task.description;
      elements.dueDate.value = task.dueDate;
      elements.category.value = Object.hasOwn(CATEGORY_LABELS, task.category) ? task.category : 'personal';
      elements.priority.value = Object.hasOwn(PRIORITY_LABELS, task.priority) ? task.priority : 'medium';
    }
    elements.dialog.showModal();
    window.setTimeout(() => elements.title.focus(), 0);
  }

  function closeDialog() {
    elements.dialog.close();
    elements.titleError.textContent = '';
  }

  function scheduleDateRefresh() {
    window.clearTimeout(dateRefreshTimer);
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    dateRefreshTimer = window.setTimeout(() => {
      render();
      scheduleDateRefresh();
    }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
  }

  document.querySelector('#add-task-button').addEventListener('click', () => openDialog());
  document.querySelector('#close-dialog').addEventListener('click', closeDialog);
  document.querySelector('#cancel-dialog').addEventListener('click', closeDialog);
  elements.dialog.addEventListener('click', event => { if (event.target === elements.dialog) closeDialog(); });
  elements.title.addEventListener('input', () => { if (elements.title.value.trim()) elements.titleError.textContent = ''; });

  elements.form.addEventListener('submit', event => {
    event.preventDefault();
    const title = elements.title.value.trim();
    if (!title) {
      elements.titleError.textContent = 'כדאי לתת למשימה שם לפני השמירה.';
      elements.title.focus();
      return;
    }
    if (title.length > 100) {
      elements.titleError.textContent = 'שם המשימה יכול להכיל עד 100 תווים.';
      return;
    }
    const dueDate = elements.dueDate.value;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      elements.titleError.textContent = 'תאריך היעד אינו תקין. כדאי לבחור תאריך מתוך לוח השנה.';
      return;
    }
    if (!Object.hasOwn(CATEGORY_LABELS, elements.category.value) || !Object.hasOwn(PRIORITY_LABELS, elements.priority.value)) {
      elements.titleError.textContent = 'יש לבחור קטגוריה ועדיפות תקינות.';
      return;
    }
    const id = elements.id.value;
    const existing = tasks.find(task => task.id === id);
    const task = { id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`), title, description: elements.description.value.trim(), dueDate, priority: elements.priority.value, category: elements.category.value, completed: existing ? existing.completed : false, createdAt: existing ? existing.createdAt : Date.now() };
    if (existing) {
      tasks = tasks.map(item => item.id === id ? task : item);
      showToast('המשימה עודכנה בהצלחה.');
    } else {
      tasks.unshift(task);
      showToast('המשימה נוספה בהצלחה.');
    }
    saveTasks();
    render();
    closeDialog();
  });

  elements.list.addEventListener('change', event => {
    if (!event.target.matches('.task-check')) return;
    const row = event.target.closest('[data-task-id]');
    const task = tasks.find(item => item.id === row.dataset.taskId);
    if (!task) return;
    task.completed = event.target.checked;
    saveTasks();
    render();
    showToast(task.completed ? 'המשימה סומנה כהושלמה. כל הכבוד!' : 'המשימה חזרה למשימות הפעילות.');
  });

  elements.list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'add') { openDialog(); return; }
    const row = button.closest('[data-task-id]');
    if (!row) return;
    const task = tasks.find(item => item.id === row.dataset.taskId);
    if (!task) return;
    if (button.dataset.action === 'edit') openDialog(task);
    if (button.dataset.action === 'delete') {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks();
      render();
      showToast('המשימה נמחקה.');
    }
  });

  document.querySelectorAll('.filter-tab').forEach(tab => tab.addEventListener('click', () => setFilter(tab.dataset.filter)));
  document.querySelectorAll('[data-nav-filter]').forEach(link => link.addEventListener('click', () => setFilter(link.dataset.navFilter)));
  elements.search.addEventListener('input', render);
  elements.priorityFilter.addEventListener('change', render);
  elements.categoryFilter.addEventListener('change', render);
  elements.sortSelect.addEventListener('change', event => {
    sortMode = event.currentTarget.value;
    render();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === 'Escape' && elements.dialog.open) closeDialog();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      render();
      scheduleDateRefresh();
    }
  });

  render();
  scheduleDateRefresh();
})();
