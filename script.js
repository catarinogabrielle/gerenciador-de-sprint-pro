let tasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];
let tags = JSON.parse(localStorage.getItem('nexus_tags')) || [
    "💻 Desenvolvimento", "🐛 Bug Fix", "🏋️ Treino", "📅 Reunião", "🚀 Deploy", "🎨 Design"
];
let columns = JSON.parse(localStorage.getItem('nexus_columns')) || [
    { id: 'todo', title: 'Pendências' },
    { id: 'doing', title: 'Em Andamento' },
    { id: 'done', title: 'Concluído' }
];

let theme = localStorage.getItem('nexus_theme') || 'light';
let currentBg = localStorage.getItem('nexus_bg') || 'default';
let boardTitle = localStorage.getItem('nexus_title') || 'Sprint Semanal';

let currentTagFilter = 'all';
let currentPriorityFilter = 'all';
let searchTerm = '';
let editingTaskId = null;
let tempSubtasks = [];

let timerInterval;
let timerSeconds = 1500;
let isTimerRunning = false;
let tagsChartInstance = null;
let statusChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('boardTitle').innerText = boardTitle;
    applyBackground(currentBg);

    document.getElementById('overlay').addEventListener('click', toggleMenu);

    setupDragAndDrop();
    updateTagsDropdown();
    render();

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    } else {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    }
}

document.getElementById('overlay').addEventListener('click', () => {
    toggleMenu();
});

function addColumn() {
    const title = prompt("Nome da nova coluna:");
    if (title) {
        const id = 'col-' + Date.now();
        columns.push({ id: id, title: title });
        saveColumns();
    }
}

function deleteColumn(colId) {
    const tasksInCol = tasks.filter(t => t.status === colId);
    if (tasksInCol.length > 0) {
        alert("Não é possível excluir uma coluna com tarefas. Mova ou exclua as tarefas primeiro.");
        return;
    }

    if (confirm("Tem certeza que deseja excluir esta coluna?")) {
        columns = columns.filter(c => c.id !== colId);
        saveColumns();
    }
}

function updateColumnTitle(colId, newTitle) {
    const col = columns.find(c => c.id === colId);
    if (col) {
        col.title = newTitle;
        localStorage.setItem('nexus_columns', JSON.stringify(columns));
    }
}

function saveColumns() {
    localStorage.setItem('nexus_columns', JSON.stringify(columns));
    render();
}

function render() {
    const board = document.getElementById('boardMain');
    board.innerHTML = '';

    const filteredTasks = tasks.filter(t => {
        const matchTag = currentTagFilter === 'all' || t.tag === currentTagFilter;
        const matchPriority = currentPriorityFilter === 'all' || t.priority === currentPriorityFilter;

        const term = searchTerm ? searchTerm.toLowerCase() : '';
        const titleMatch = t.text.toLowerCase().includes(term);
        const descMatch = t.description && t.description.toLowerCase().includes(term);

        return matchTag && matchPriority && (term === '' || titleMatch || descMatch);
    });

    const todayString = getTodayString();

    columns.forEach(col => {
        const columnEl = document.createElement('div');
        columnEl.className = 'column';
        columnEl.id = col.id;

        const deleteBtn = `<button class="column-delete-btn" onclick="deleteColumn('${col.id}')" title="Excluir Coluna">✖</button>`;
        const addBtn = `<button class="btn-add-rounded" onclick="openModal(null, '${col.id}')" title="Adicionar Tarefa" style="margin-left: 10px;">+</button>`;
        const count = filteredTasks.filter(t => t.status === col.id).length;

        columnEl.innerHTML = `
            <div class="column-header">
                <div class="header-title-group">
                    <span contenteditable="true" class="column-title-edit" onblur="updateColumnTitle('${col.id}', this.innerText)">${col.title}</span>
                    ${addBtn}
                </div>
                <div style="display:flex; align-items:center;">
                    <span id="count-${col.id}" class="count-badge">${count}</span>
                    ${deleteBtn}
                </div>
            </div>
            <div class="tasks-container" data-status="${col.id}"></div>
        `;

        board.appendChild(columnEl);

        const container = columnEl.querySelector('.tasks-container');
        const tasksForCol = filteredTasks.filter(t => t.status === col.id);

        tasksForCol.forEach(t => {
            const isDoneCol = col.id === 'done' || col.title.toLowerCase().includes('conclu');

            const card = document.createElement('div');
            card.className = `card ${t.status === 'done' || isDoneCol ? 'finalizado' : ''}`;
            card.id = t.id;
            card.onclick = () => openModal(t.id);

            let dateHtml = '';
            if (t.startDate || t.endDate) {
                const isOverdue = t.endDate && t.endDate < todayString && !isDoneCol;

                if (isOverdue) {
                    triggerNotification("Atenção!", `Tarefa "${t.text}" está atrasada.`);
                }

                const dateClass = isOverdue ? 'date-display overdue' : 'date-display';
                const icon = isOverdue ? '⚠️ ' : '📅 ';
                dateHtml = `<div class="${dateClass}">${icon} ${formatDate(t.startDate)} ${t.endDate ? '- ' + formatDate(t.endDate) : ''}</div>`;
            }

            const descIcon = t.description && t.description.trim() !== '' ? '<span class="has-desc-icon">📄</span>' : '';

            const prioColor = t.priority === 'Alta' ? '#ef4444' : t.priority === 'Média' ? '#f59e0b' : '#6366f1';

            let progressHtml = '';
            if (t.subtasks && t.subtasks.length > 0) {
                const total = t.subtasks.length;
                const doneCount = t.subtasks.filter(s => s.done).length;
                const pct = Math.round((doneCount / total) * 100);
                progressHtml = `
                    <div style="font-size: 10px; color: var(--text-sub); margin-top: 5px; display: flex; justify-content: space-between;">
                        <span>Checklist</span> <span>${doneCount}/${total}</span>
                    </div>
                    <div class="progress-container" style="display:block">
                        <div class="progress-bar-card" style="width: ${pct}%"></div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="tag-row"><div class="tag">${t.tag}</div>${dateHtml}${descIcon}</div>
                <span class="card-text">${t.text}</span>
                ${progressHtml}
                <div class="card-footer">
                    <div class="prio-indicator">
                        <div class="dot" style="background:${prioColor}"></div>
                        <span>${t.priority}</span>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    });

    updateMetrics(filteredTasks);
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const containers = document.querySelectorAll('.tasks-container');
    containers.forEach(container => {
        new Sortable(container, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            delay: 100,
            delayOnTouchOnly: true,
            onEnd: function (evt) {
                const itemEl = evt.item;
                const newStatus = evt.to.getAttribute('data-status');
                const task = tasks.find(t => t.id === itemEl.id);

                if (task) {
                    const targetCol = columns.find(c => c.id === newStatus);
                    const isDoneTarget = targetCol && (targetCol.id === 'done' || targetCol.title.toLowerCase().includes('conclu'));
                    const wasDone = task.status === 'done' || (columns.find(c => c.id === task.status)?.title.toLowerCase().includes('conclu'));

                    if (!wasDone && isDoneTarget) {
                        task.endDate = getTodayString();
                        fireConfetti();
                    }
                    if (wasDone && !isDoneTarget) {
                        task.endDate = '';
                    }

                    task.status = newStatus;
                    save();
                }
            }
        });
    });
}

function openModal(taskId = null, initialStatus = null) {
    const modal = document.getElementById('modalOverlay');
    const saveBtn = document.getElementById('modalSaveBtn');
    const deleteBtn = document.getElementById('modalDeleteBtn');
    const modalTitle = document.getElementById('modalTitle');

    clearModalFields();
    switchDescTab('write');

    if (taskId) {
        editingTaskId = taskId;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        modalTitle.innerText = "Editar Tarefa";
        saveBtn.innerText = "Atualizar";
        deleteBtn.style.display = 'block';

        document.getElementById('modalTaskInput').value = task.text;
        document.getElementById('modalDescriptionInput').value = task.description || '';
        document.getElementById('modalTagInput').value = task.tag;
        document.getElementById('modalPriorityInput').value = task.priority;
        document.getElementById('modalDateStart').value = task.startDate || '';
        document.getElementById('modalDateEnd').value = task.endDate || '';

        tempSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
        renderSubtasksList();

        saveBtn.onclick = () => saveTaskBtnClick();

    } else {
        editingTaskId = null;
        modalTitle.innerText = "Nova Tarefa";
        saveBtn.innerText = "Salvar";
        deleteBtn.style.display = 'none';

        tempSubtasks = [];
        renderSubtasksList();
        document.getElementById('modalDateStart').value = getTodayString();

        const defaultStatus = initialStatus || (columns.length > 0 ? columns[0].id : 'todo');
        saveBtn.onclick = () => saveTaskBtnClick(defaultStatus);

        setTimeout(() => document.getElementById('modalTaskInput').focus(), 100);
    }
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editingTaskId = null;
}

function clearModalFields() {
    document.getElementById('modalTaskInput').value = '';
    document.getElementById('modalDescriptionInput').value = '';
    document.getElementById('modalDateStart').value = '';
    document.getElementById('modalDateEnd').value = '';
    document.getElementById('subtaskInput').value = '';
    document.getElementById('subtaskList').innerHTML = '';
    document.getElementById('modalTagInput').selectedIndex = 0;
    document.getElementById('modalPriorityInput').selectedIndex = 0;
}

function saveTaskBtnClick(statusOverride = null) {
    const titleInput = document.getElementById('modalTaskInput');
    if (!titleInput.value.trim()) {
        alert("O título da tarefa é obrigatório.");
        titleInput.focus();
        return;
    }

    if (editingTaskId) {
        updateExistingTask(editingTaskId);
    } else {
        const finalStatus = statusOverride || (columns.length > 0 ? columns[0].id : 'todo');
        createNewTask(finalStatus);
    }
}

function createNewTask(status) {
    const newTask = {
        id: 'id-' + Date.now(),
        text: document.getElementById('modalTaskInput').value,
        description: document.getElementById('modalDescriptionInput').value,
        tag: document.getElementById('modalTagInput').value,
        priority: document.getElementById('modalPriorityInput').value,
        startDate: document.getElementById('modalDateStart').value,
        endDate: document.getElementById('modalDateEnd').value,
        subtasks: tempSubtasks,
        status: status
    };
    tasks.push(newTask);
    saveAndClose();
}

function updateExistingTask(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        tasks[taskIndex].text = document.getElementById('modalTaskInput').value;
        tasks[taskIndex].description = document.getElementById('modalDescriptionInput').value;
        tasks[taskIndex].tag = document.getElementById('modalTagInput').value;
        tasks[taskIndex].priority = document.getElementById('modalPriorityInput').value;
        tasks[taskIndex].startDate = document.getElementById('modalDateStart').value;
        tasks[taskIndex].endDate = document.getElementById('modalDateEnd').value;
        tasks[taskIndex].subtasks = tempSubtasks;
        saveAndClose();
    }
}

function deleteTaskFromModal() {
    if (!editingTaskId) return;
    if (confirm("Tem certeza absoluta que deseja excluir esta tarefa?")) {
        tasks = tasks.filter(t => t.id !== editingTaskId);
        save();
        closeModal();
    }
}

function saveAndClose() {
    save();
    closeModal();
}

function save() {
    localStorage.setItem('nexus_tasks_v3', JSON.stringify(tasks));
    render();
}

function handleSubtaskEnter(e) {
    if (e.key === 'Enter') addSubtask();
}

function addSubtask() {
    const input = document.getElementById('subtaskInput');
    const text = input.value.trim();
    if (text) {
        tempSubtasks.push({ text: text, done: false });
        input.value = '';
        renderSubtasksList();
    }
}

function renderSubtasksList() {
    const container = document.getElementById('subtaskList');
    container.innerHTML = tempSubtasks.map((st, index) => `
        <div class="subtask-item">
            <input type="checkbox" ${st.done ? 'checked' : ''} onchange="toggleSubtask(${index})">
            <span style="${st.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${st.text}</span>
            <button onclick="removeSubtask(${index})">×</button>
        </div>
    `).join('');
}

function toggleSubtask(index) {
    tempSubtasks[index].done = !tempSubtasks[index].done;
    renderSubtasksList();
}

function removeSubtask(index) {
    tempSubtasks.splice(index, 1);
    renderSubtasksList();
}

function switchDescTab(mode) {
    const btnWrite = document.getElementById('btnWrite');
    const btnPreview = document.getElementById('btnPreview');
    const input = document.getElementById('modalDescriptionInput');
    const preview = document.getElementById('descPreview');

    if (mode === 'write') {
        btnWrite.classList.add('active');
        btnPreview.classList.remove('active');
        input.style.display = 'block';
        preview.style.display = 'none';
    } else {
        btnWrite.classList.remove('active');
        btnPreview.classList.add('active');
        input.style.display = 'none';
        preview.style.display = 'block';
        preview.innerHTML = simpleMarkdown(input.value);
    }
}

function simpleMarkdown(text) {
    if (!text) return '<em style="color:var(--text-sub)">Nenhuma descrição.</em>';

    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');

    let lines = html.split('\n');
    let inList = false;
    let newLines = [];
    lines.forEach(line => {
        if (line.trim().startsWith('- ')) {
            if (!inList) { newLines.push('<ul>'); inList = true; }
            newLines.push(`<li>${line.trim().substring(2)}</li>`);
        } else {
            if (inList) { newLines.push('</ul>'); inList = false; }
            newLines.push(line + '<br>');
        }
    });
    if (inList) newLines.push('</ul>');

    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    html = newLines.join('').replace(urlRegex, '<a href="$1" target="_blank">$1</a>');

    return html;
}

function setBg(type) {
    currentBg = type;
    localStorage.setItem('nexus_bg', type);
    applyBackground(type);
}

function applyBackground(type) {
    const root = document.documentElement;
    const baseColor = theme === 'dark' ? '#010409' : '#f8fafc';
    root.style.setProperty('--bg-body', baseColor);

    if (type === 'default') {
        root.style.setProperty('--bg-image', 'none');
    }
    else if (type === 'gradient-dark') {
        root.style.setProperty('--bg-image', 'linear-gradient(135deg, #1e1e24, #0b0c10)');
    }
    else if (type === 'gradient-purple') {
        root.style.setProperty('--bg-image', 'linear-gradient(135deg, #2b5876, #4e4376)');
    }
    else if (type === 'space') {
        root.style.setProperty('--bg-image', "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&auto=format&fit=crop')");
    }
}

function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_theme', theme);
    applyBackground(currentBg);
    if (document.getElementById('statsOverlay').classList.contains('active')) renderCharts();
}

function saveTitle() {
    boardTitle = document.getElementById('boardTitle').innerText;
    localStorage.setItem('nexus_title', boardTitle);
}

function applyFilters() {
    currentTagFilter = document.getElementById('filterTag').value;
    currentPriorityFilter = document.getElementById('filterPriority').value;
    searchTerm = document.getElementById('searchInput').value.toLowerCase();
    render();
}

function updateTagsDropdown() {
    const modalSelect = document.getElementById('modalTagInput');
    const filterSelect = document.getElementById('filterTag');

    modalSelect.innerHTML = tags.map(t => `<option value="${t}">${t}</option>`).join('');
    filterSelect.innerHTML = `<option value="all">🏷️ Todas as Tags</option>` +
        tags.map(t => `<option value="${t}">${t}</option>`).join('');
    filterSelect.value = currentTagFilter;
}

function addNewTag() {
    const newTag = prompt("Nome da nova tag:");
    if (newTag && !tags.includes(newTag)) {
        tags.push(newTag);
        localStorage.setItem('nexus_tags', JSON.stringify(tags));
        updateTagsDropdown();
    }
}

function openStatsModal() {
    document.getElementById('statsOverlay').classList.add('active');
    renderCharts();
}
function closeStatsModal() {
    document.getElementById('statsOverlay').classList.remove('active');
}
document.getElementById('statsOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('statsOverlay')) closeStatsModal();
});

function renderCharts() {
    const tagCounts = {};
    tags.forEach(t => tagCounts[t] = 0);
    tasks.forEach(t => {
        if (tagCounts[t.tag] !== undefined) tagCounts[t.tag]++;
        else tagCounts[t.tag] = 1;
    });

    const statusCounts = {};
    const labels = [];
    const dataStatus = [];

    columns.forEach(col => {
        const count = tasks.filter(t => t.status === col.id).length;
        labels.push(col.title);
        dataStatus.push(count);
    });

    const textColor = theme === 'dark' ? '#e6edf3' : '#18181b';
    const chartColors = ['#ff6900', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#64748b'];

    const ctxTags = document.getElementById('tagsChart').getContext('2d');
    if (tagsChartInstance) tagsChartInstance.destroy();
    tagsChartInstance = new Chart(ctxTags, {
        type: 'doughnut',
        data: {
            labels: Object.keys(tagCounts),
            datasets: [{
                data: Object.values(tagCounts),
                backgroundColor: chartColors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } } }
        }
    });

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctxStatus, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tarefas',
                data: dataStatus,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 } },
                x: { ticks: { color: textColor } }
            },
            plugins: { legend: { display: false } }
        }
    });

    const total = tasks.length;
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    const doneCount = doneCol ? tasks.filter(t => t.status === doneCol.id).length : 0;
    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

    document.getElementById('statsSummary').innerHTML = `
        <strong>Total:</strong> ${total} tarefas. <br>
        <strong>Concluído:</strong> ${pct}% (baseado na coluna "${doneCol ? doneCol.title : '?'}")
    `;
}

function requestNotificationPermission() {
    if (Notification.permission !== "granted") Notification.requestPermission();
}

function triggerNotification(title, body) {
    document.getElementById('alertSound').play().catch(e => console.log("Audio blocked"));
    if (Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'assets/icon.png' });
    }
}

function startTimer() {
    requestNotificationPermission();
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            triggerNotification("🍅 Pomodoro Finalizado!", "Hora de descansar.");
            alert("🍅 Pomodoro Finalizado!");
            resetTimer();
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerSeconds = 1500;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('pomodoroTimer').innerText =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function exportData() {
    const dataStr = JSON.stringify({ tasks, tags, columns, boardTitle });
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'sprint_pro_backup.json');
    linkElement.click();
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.tasks) tasks = data.tasks;
            if (data.tags) { tags = data.tags; localStorage.setItem('nexus_tags', JSON.stringify(tags)); }
            if (data.columns) { columns = data.columns; localStorage.setItem('nexus_columns', JSON.stringify(columns)); }
            if (data.boardTitle) { boardTitle = data.boardTitle; localStorage.setItem('nexus_title', boardTitle); }

            document.getElementById('boardTitle').innerText = boardTitle;
            save();
            updateTagsDropdown();
            alert("Backup restaurado com sucesso!");
        } catch (err) {
            alert("Erro ao importar arquivo de backup.");
        }
    };
    reader.readAsText(file);
}

function getTodayString() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const offsetDate = new Date(date.getTime() + userTimezoneOffset);
    return offsetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fireConfetti() {
    const end = Date.now() + 1000;
    const colors = ['#ff6900', '#ffffff'];
    (function frame() {
        confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
        confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

function clearAllDone() {
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    if (doneCol && confirm("Deseja remover todas as tarefas da coluna '" + doneCol.title + "'?")) {
        tasks = tasks.filter(t => t.status !== doneCol.id);
        save();
        toggleMenu();
    } else if (!doneCol) {
        alert("Não encontrei uma coluna de conclusão padrão.");
    }
}

function updateMetrics(taskList) {
    columns.forEach(col => {
        const count = taskList.filter(t => t.status === col.id).length;
        const badge = document.getElementById(`count-${col.id}`);
        if (badge) badge.innerText = count;
    });

    const total = taskList.length;
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    const doneCount = doneCol ? taskList.filter(t => t.status === doneCol.id).length : 0;

    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

    document.getElementById('prog-fill').style.width = pct + '%';
    document.getElementById('prog-val').innerText = pct + '%';
}

const installBtn = document.getElementById('installPwaBtn');
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
});
installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') installBtn.style.display = 'none';
    }
});
window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
});