let tasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];
let tags = JSON.parse(localStorage.getItem('nexus_tags')) || [
    "💻 Desenvolvimento", "🐛 Bug Fix", "🏋️ Treino", "📅 Reunião", "🚀 Deploy", "🎨 Design"
];
let theme = localStorage.getItem('nexus_theme') || 'light';
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
    setupDragAndDrop();
    updateTagsDropdown();
    render();
});

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

    const statusCounts = { todo: 0, doing: 0, done: 0 };
    tasks.forEach(t => {
        if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
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
            labels: ['Pendentes', 'Em Andamento', 'Concluídas'],
            datasets: [{
                label: 'Qtd',
                data: [statusCounts.todo, statusCounts.doing, statusCounts.done],
                backgroundColor: ['#64748b', '#f59e0b', '#22c55e'],
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
    const done = statusCounts.done;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    let maxTag = "Nenhuma";
    let maxVal = 0;
    for (const [k, v] of Object.entries(tagCounts)) { if (v > maxVal) { maxVal = v; maxTag = k; } }

    document.getElementById('statsSummary').innerHTML = `
        <strong>Resumo:</strong> Você completou <strong>${done}</strong> de <strong>${total}</strong> tarefas (${pct}%).<br>
        Foco principal desta sprint: <strong>${maxTag}</strong>.
    `;
}

function startTimer() {
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
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
    document.getElementById('pomodoroTimer').innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateTagsDropdown() {
    const modalSelect = document.getElementById('modalTagInput');
    const filterSelect = document.getElementById('filterTag');
    modalSelect.innerHTML = tags.map(t => `<option value="${t}">${t}</option>`).join('');
    filterSelect.innerHTML = `<option value="all">🏷️ Todas as Tags</option>` + tags.map(t => `<option value="${t}">${t}</option>`).join('');
    filterSelect.value = currentTagFilter;
}
function addNewTag() {
    const newTag = prompt("Digite o nome da tag:");
    if (newTag && !tags.includes(newTag)) {
        tags.push(newTag);
        localStorage.setItem('nexus_tags', JSON.stringify(tags));
        updateTagsDropdown();
    }
}

function exportData() {
    const dataStr = JSON.stringify({ tasks, tags, boardTitle });
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
            if (data.boardTitle) { boardTitle = data.boardTitle; localStorage.setItem('nexus_title', boardTitle); }
            document.getElementById('boardTitle').innerText = boardTitle;
            save();
            updateTagsDropdown();
            alert("Backup restaurado!");
        } catch (err) { alert("Erro ao importar."); }
    };
    reader.readAsText(file);
}

function handleSubtaskEnter(e) { if (e.key === 'Enter') addSubtask(); }
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
function toggleSubtask(index) { tempSubtasks[index].done = !tempSubtasks[index].done; renderSubtasksList(); }
function removeSubtask(index) { tempSubtasks.splice(index, 1); renderSubtasksList(); }

function getTodayString() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

function openModal(taskId = null) {
    const modal = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('modalSaveBtn');
    const deleteBtn = document.getElementById('modalDeleteBtn');

    clearModalFields();

    if (taskId) {
        editingTaskId = taskId;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        modalTitle.innerText = "Editar Tarefa";
        saveBtn.innerText = "Atualizar Tarefa";
        deleteBtn.style.display = 'block';

        document.getElementById('modalTaskInput').value = task.text;
        document.getElementById('modalDescriptionInput').value = task.description || '';
        document.getElementById('modalTagInput').value = task.tag;
        document.getElementById('modalPriorityInput').value = task.priority;
        document.getElementById('modalDateStart').value = task.startDate || '';
        document.getElementById('modalDateEnd').value = task.endDate || '';
        tempSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
        renderSubtasksList();
    } else {
        editingTaskId = null;
        modalTitle.innerText = "Nova Tarefa";
        saveBtn.innerText = "Salvar Tarefa";
        deleteBtn.style.display = 'none';
        tempSubtasks = [];
        renderSubtasksList();
        document.getElementById('modalDateStart').value = getTodayString();
        setTimeout(() => document.getElementById('modalTaskInput').focus(), 100);
    }
    modal.classList.add('active');
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
function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); editingTaskId = null; }
document.getElementById('modalOverlay').addEventListener('click', (e) => { if (e.target === document.getElementById('modalOverlay')) closeModal(); });
function toggleMenu() { document.getElementById('sidebar').classList.toggle('active'); document.getElementById('overlay').classList.toggle('active'); }
function toggleTheme() { theme = theme === 'light' ? 'dark' : 'light'; document.body.setAttribute('data-theme', theme); localStorage.setItem('nexus_theme', theme); if (document.getElementById('statsOverlay').classList.contains('active')) renderCharts(); }
function saveTitle() { boardTitle = document.getElementById('boardTitle').innerText; localStorage.setItem('nexus_title', boardTitle); }
function applyFilters() { currentTagFilter = document.getElementById('filterTag').value; currentPriorityFilter = document.getElementById('filterPriority').value; searchTerm = document.getElementById('searchInput').value.toLowerCase(); render(); }

function saveTaskBtnClick() {
    const titleInput = document.getElementById('modalTaskInput');
    if (!titleInput.value.trim()) { alert("O título é obrigatório."); titleInput.focus(); return; }
    if (editingTaskId) updateExistingTask(editingTaskId); else createNewTask();
}

function createNewTask() {
    const newTask = {
        id: 'id-' + Date.now(),
        text: document.getElementById('modalTaskInput').value,
        description: document.getElementById('modalDescriptionInput').value,
        tag: document.getElementById('modalTagInput').value,
        priority: document.getElementById('modalPriorityInput').value,
        startDate: document.getElementById('modalDateStart').value,
        endDate: document.getElementById('modalDateEnd').value,
        subtasks: tempSubtasks,
        status: 'todo'
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
function deleteTaskFromModal() { if (!editingTaskId) return; if (confirm("Deseja excluir esta tarefa?")) { tasks = tasks.filter(t => t.id !== editingTaskId); save(); closeModal(); } }
function saveAndClose() { save(); closeModal(); }
function save() { localStorage.setItem('nexus_tasks_v3', JSON.stringify(tasks)); render(); }
function formatDate(dateString) { if (!dateString) return ''; const date = new Date(dateString); const userTimezoneOffset = date.getTimezoneOffset() * 60000; const offsetDate = new Date(date.getTime() + userTimezoneOffset); return offsetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }

function render() {
    document.querySelectorAll('.tasks-container').forEach(c => c.innerHTML = '');
    const filteredTasks = tasks.filter(t => {
        const matchTag = currentTagFilter === 'all' || t.tag === currentTagFilter;
        const matchPriority = currentPriorityFilter === 'all' || t.priority === currentPriorityFilter;
        const term = searchTerm ? searchTerm.toLowerCase() : '';
        const titleMatch = t.text.toLowerCase().includes(term);
        const descMatch = t.description && t.description.toLowerCase().includes(term);
        return matchTag && matchPriority && (term === '' || titleMatch || descMatch);
    });

    const todayString = getTodayString();

    filteredTasks.forEach(t => {
        const card = document.createElement('div');
        card.className = `card ${t.status === 'done' ? 'finalizado' : ''}`;
        card.id = t.id;
        card.onclick = () => openModal(t.id);

        let dateHtml = '';
        if (t.startDate || t.endDate) {
            const isOverdue = t.endDate && t.endDate < todayString && t.status !== 'done';
            const dateClass = isOverdue ? 'date-display overdue' : 'date-display';
            const icon = isOverdue ? '⚠️ ' : '📅 ';
            dateHtml = `<div class="${dateClass}" title="${isOverdue ? 'Atrasada!' : 'Prazo'}">${icon} ${formatDate(t.startDate)} ${t.endDate ? '- ' + formatDate(t.endDate) : ''}</div>`;
        }

        const prioColor = t.priority === 'Alta' ? '#ef4444' : t.priority === 'Média' ? '#f59e0b' : '#6366f1';
        let progressHtml = '';
        if (t.subtasks && t.subtasks.length > 0) {
            const total = t.subtasks.length;
            const done = t.subtasks.filter(s => s.done).length;
            const pct = Math.round((done / total) * 100);
            progressHtml = `<div style="font-size: 10px; color: var(--text-sub); margin-top: 5px; display: flex; justify-content: space-between;"><span>Checklist</span> <span>${done}/${total}</span></div><div class="progress-container" style="display: block;"><div class="progress-bar-card" style="width: ${pct}%"></div></div>`;
        }
        const descIcon = t.description && t.description.trim() !== '' ? '<span class="has-desc-icon">📄</span>' : '';

        card.innerHTML = `
            <div class="tag-row"><div class="tag">${t.tag}</div>${dateHtml}${descIcon}</div>
            <span class="card-text">${t.text}</span>
            ${progressHtml}
            <div class="card-footer">
                <div class="prio-indicator"><div class="dot" style="background:${prioColor}"></div><span>${t.priority}</span></div>
            </div>
        `;
        const colElement = document.getElementById(t.status);
        if (colElement) colElement.querySelector('.tasks-container').appendChild(card);
    });
    updateMetrics(filteredTasks);
}

function setupDragAndDrop() {
    ['todo', 'doing', 'done'].forEach(colId => {
        new Sortable(document.querySelector(`#${colId} .tasks-container`), {
            group: 'shared', animation: 150, ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const itemEl = evt.item;
                const newStatus = evt.to.getAttribute('data-status');
                const task = tasks.find(t => t.id === itemEl.id);
                if (task) {
                    if (task.status !== 'done' && newStatus === 'done') { task.endDate = getTodayString(); fireConfetti(); }
                    if (task.status === 'done' && newStatus !== 'done') task.endDate = '';
                    task.status = newStatus;
                    save();
                }
            }
        });
    });
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
function clearAllDone() { if (confirm("Remover concluídas?")) { tasks = tasks.filter(t => t.status !== 'done'); save(); toggleMenu(); } }
function updateMetrics(taskList = tasks) {
    const counts = { todo: 0, doing: 0, done: 0 };
    taskList.forEach(t => { if (counts.hasOwnProperty(t.status)) counts[t.status]++; });
    for (let status in counts) { const el = document.getElementById(`count-${status}`); if (el) el.innerText = counts[status]; }
    const total = taskList.length;
    const done = counts.done;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const fill = document.getElementById('prog-fill');
    const val = document.getElementById('prog-val');
    if (fill) fill.style.width = percent = pct + '%';
    if (val) val.innerText = pct + '%';
}

const installBtn = document.getElementById('installPwaBtn');
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.style.display = 'block'; });
installBtn.addEventListener('click', async () => { if (deferredPrompt) { deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; if (outcome === 'accepted') installBtn.style.display = 'none'; } });
window.addEventListener('appinstalled', () => { installBtn.style.display = 'none'; });