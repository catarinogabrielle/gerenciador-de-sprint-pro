let tasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];

let tags = JSON.parse(localStorage.getItem('nexus_tags')) || [
    "💻 Desenvolvimento",
    "🐛 Bug Fix",
    "🏋️ Treino",
    "📅 Reunião",
    "🚀 Deploy",
    "🎨 Design"
];

const members = ["Gabrielle", "Willian", "Visitante", "Admin"];

let columns = JSON.parse(localStorage.getItem('nexus_columns'));
if (!columns || columns.length === 0) {
    columns = [
        { id: 'todo', title: 'Pendências' },
        { id: 'doing', title: 'Em Andamento' },
        { id: 'done', title: 'Concluído' }
    ];
    localStorage.setItem('nexus_columns', JSON.stringify(columns));
}

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

    updateTagsDropdown();
    updateMembersDropdown();
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
        alert("Esta coluna contém tarefas. Mova-as antes de excluir.");
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
                const dateClass = isOverdue ? 'date-display overdue' : 'date-display';
                const icon = isOverdue ? '⚠️ ' : '📅 ';
                dateHtml = `<div class="${dateClass}">${icon} ${formatDate(t.startDate)} ${t.endDate ? '- ' + formatDate(t.endDate) : ''}</div>`;
            }

            const descIcon = t.description && t.description.trim() !== '' ? '<span class="has-desc-icon">📄</span>' : '';

            const prioColor = t.priority === 'Alta' ? '#ef4444' : t.priority === 'Média' ? '#f59e0b' : '#6366f1';

            const avatarHtml = t.member ? getAvatar(t.member) : '';

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
                    ${avatarHtml}
                </div>
            `;
            container.appendChild(card);
        });
    });

    updateMetrics(filteredTasks);

    setupCardDragAndDrop();
    setupColumnDragAndDrop();
}

function setupCardDragAndDrop() {
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
                }

                const allCards = document.querySelectorAll('.card');
                const newOrderIds = Array.from(allCards).map(card => card.id);
                const reorderedTasks = [];
                const visibleTasksMap = new Map(tasks.map(t => [t.id, t]));

                newOrderIds.forEach(id => {
                    if (visibleTasksMap.has(id)) {
                        reorderedTasks.push(visibleTasksMap.get(id));
                        visibleTasksMap.delete(id);
                    }
                });

                const hiddenTasks = Array.from(visibleTasksMap.values());
                tasks = [...reorderedTasks, ...hiddenTasks];

                save();
            }
        });
    });
}

function setupColumnDragAndDrop() {
    const board = document.getElementById('boardMain');
    new Sortable(board, {
        animation: 150,
        handle: '.column-header',
        ghostClass: 'sortable-ghost-column',
        delay: 100,
        delayOnTouchOnly: true,
        onEnd: function (evt) {
            const newColumnOrder = [];
            const domColumns = document.querySelectorAll('.column');
            domColumns.forEach(colEl => {
                const colData = columns.find(c => c.id === colEl.id);
                if (colData) newColumnOrder.push(colData);
            });
            columns = newColumnOrder;
            localStorage.setItem('nexus_columns', JSON.stringify(columns));
        }
    });
}

function openModal(taskId = null, initialStatus = null) {
    const modal = document.getElementById('modalOverlay');
    const saveBtn = document.getElementById('modalSaveBtn');
    const deleteBtn = document.getElementById('modalDeleteBtn');
    const modalTitle = document.getElementById('modalTitle');

    clearModalFields();

    if (taskId) {
        editingTaskId = taskId;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        modalTitle.innerText = "Detalhes da Tarefa";
        saveBtn.innerText = "Atualizar";
        deleteBtn.style.display = 'block';

        document.getElementById('modalTaskInput').value = task.text;
        document.getElementById('modalDescriptionInput').value = task.description || '';
        document.getElementById('modalTagInput').value = task.tag;
        document.getElementById('modalPriorityInput').value = task.priority;
        document.getElementById('modalMemberInput').value = task.member || '';
        document.getElementById('modalDateStart').value = task.startDate || '';
        document.getElementById('modalDateEnd').value = task.endDate || '';

        tempSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
        renderSubtasksList();

        saveBtn.onclick = () => saveTaskBtnClick();

        switchDescTab('preview');

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

        // Abre na aba de escrita
        switchDescTab('write');
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
    document.getElementById('modalMemberInput').selectedIndex = 0;
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
        const status = statusOverride || (columns.length > 0 ? columns[0].id : 'todo');
        createNewTask(status);
    }
}

function createNewTask(status) {
    const newTask = {
        id: 'id-' + Date.now(),
        text: document.getElementById('modalTaskInput').value,
        description: document.getElementById('modalDescriptionInput').value,
        tag: document.getElementById('modalTagInput').value,
        priority: document.getElementById('modalPriorityInput').value,
        member: document.getElementById('modalMemberInput').value,
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
        tasks[taskIndex].member = document.getElementById('modalMemberInput').value;
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
    container.innerHTML = tempSubtasks.map((s, i) => `
        <div class="subtask-item">
            <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubtask(${i})">
            <span style="${s.done ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${s.text}</span>
            <button onclick="removeSubtask(${i})">×</button>
        </div>
    `).join('');
}

function toggleSubtask(i) {
    tempSubtasks[i].done = !tempSubtasks[i].done;
    renderSubtasksList();
}

function removeSubtask(i) {
    tempSubtasks.splice(i, 1);
    renderSubtasksList();
}

function switchDescTab(mode) {
    const btnWrite = document.getElementById('btnWrite');
    const btnPreview = document.getElementById('btnPreview');
    const input = document.getElementById('modalDescriptionInput');
    const preview = document.getElementById('descPreview');
    const micBtn = document.getElementById('descMicBtn');

    if (!btnWrite || !btnPreview) return;

    if (mode === 'write') {
        btnWrite.classList.add('active');
        btnPreview.classList.remove('active');
        input.style.display = 'block';
        preview.style.display = 'none';
        if (micBtn) micBtn.style.display = 'flex';
        input.focus();
    } else {
        btnWrite.classList.remove('active');
        btnPreview.classList.add('active');
        input.style.display = 'none';
        preview.style.display = 'block';
        if (micBtn) micBtn.style.display = 'none';
        preview.innerHTML = simpleMarkdown(input.value);
    }
}

function simpleMarkdown(text) {
    if (!text || text.trim() === '') return '<div style="color:var(--text-sub); text-align:center; padding:10px;"><em>Nenhuma descrição inserida.</em></div>';

    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');

    let lines = html.split('\n');
    let inList = false;
    let newLines = [];
    lines.forEach(line => {
        let t = line.trim();
        if (t.startsWith('- ')) {
            if (!inList) { newLines.push('<ul>'); inList = true; }
            newLines.push(`<li>${t.substring(2)}</li>`);
        } else {
            if (inList) { newLines.push('</ul>'); inList = false; }
            if (t === '') newLines.push('<br>');
            else newLines.push(`<div>${line}</div>`);
        }
    });
    if (inList) newLines.push('</ul>');

    return newLines.join('').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function startVoice(targetId, btnElement) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Seu navegador não suporta reconhecimento de voz.");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;
    recognition.start();

    btnElement.classList.add('recording');
    const originalText = btnElement.innerText;
    if (btnElement.classList.contains('btn-mic-small')) btnElement.innerText = "👂...";

    recognition.onresult = (evt) => {
        const t = evt.results[0][0].transcript;
        const input = document.getElementById(targetId);
        input.value = input.value.trim() ? input.value + " " + t : t;
        input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
    };

    recognition.onspeechend = () => {
        recognition.stop();
        btnElement.classList.remove('recording');
        if (btnElement.classList.contains('btn-mic-small')) btnElement.innerText = originalText;
    };

    recognition.onerror = () => {
        btnElement.classList.remove('recording');
        if (btnElement.classList.contains('btn-mic-small')) btnElement.innerText = originalText;
    };
}

function setBg(type) {
    currentBg = type;
    localStorage.setItem('nexus_bg', type);
    applyBackground(type);
}

function applyBackground(type) {
    const root = document.documentElement;
    const base = theme === 'dark' ? '#010409' : '#f8fafc';
    root.style.setProperty('--bg-body', base);
    root.style.setProperty('--bg-image', 'none');

    if (type === 'gradient-dark') root.style.setProperty('--bg-image', 'linear-gradient(135deg, #1e1e24, #0b0c10)');
    else if (type === 'gradient-purple') root.style.setProperty('--bg-image', 'linear-gradient(135deg, #2b5876, #4e4376)');
    else if (type === 'space') root.style.setProperty('--bg-image', "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&auto=format&fit=crop')");
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
    const m = document.getElementById('modalTagInput');
    const f = document.getElementById('filterTag');
    m.innerHTML = tags.map(t => `<option value="${t}">${t}</option>`).join('');
    f.innerHTML = `<option value="all">🏷️ Todas as Tags</option>` + tags.map(t => `<option value="${t}">${t}</option>`).join('');
    f.value = currentTagFilter;
}

function addNewTag() {
    const t = prompt("Nome da nova tag:");
    if (t && !tags.includes(t)) {
        tags.push(t);
        localStorage.setItem('nexus_tags', JSON.stringify(tags));
        updateTagsDropdown();
    }
}

function exportData() {
    const d = JSON.stringify({ tasks, tags, columns, boardTitle });
    const u = 'data:application/json;charset=utf-8,' + encodeURIComponent(d);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'backup.json';
    a.click();
}

function importData(i) {
    const f = i.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function (e) {
        try {
            const d = JSON.parse(e.target.result);
            if (d.tasks) tasks = d.tasks;
            if (d.tags) { tags = d.tags; localStorage.setItem('nexus_tags', JSON.stringify(tags)); }
            if (d.columns) { columns = d.columns; localStorage.setItem('nexus_columns', JSON.stringify(columns)); }
            if (d.boardTitle) { boardTitle = d.boardTitle; localStorage.setItem('nexus_title', boardTitle); }
            document.getElementById('boardTitle').innerText = boardTitle;
            save();
            updateTagsDropdown();
            alert("Backup restaurado!");
        } catch (err) {
            alert("Erro ao importar.");
        }
    };
    r.readAsText(f);
}

function updateMetrics(tl) {
    columns.forEach(c => {
        const count = tl.filter(t => t.status === c.id).length;
        const el = document.getElementById(`count-${c.id}`);
        if (el) el.innerText = count;
    });

    const tot = tl.length;
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    const done = doneCol ? tl.filter(t => t.status === doneCol.id).length : 0;
    const pct = tot === 0 ? 0 : Math.round((done / tot) * 100);

    document.getElementById('prog-fill').style.width = pct + '%';
    document.getElementById('prog-val').innerText = pct + '%';
}

function clearAllDone() {
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    if (doneCol && confirm("Limpar tarefas concluídas?")) {
        tasks = tasks.filter(t => t.status !== doneCol.id);
        save();
        toggleMenu();
    } else {
        alert("Nenhuma coluna de conclusão encontrada.");
    }
}

function requestNotificationPermission() {
    if (Notification.permission !== "granted") Notification.requestPermission();
}

function triggerNotification(t, b) {
    document.getElementById('alertSound').play().catch(e => console.log(e));
    if (Notification.permission === "granted") new Notification(t, { body: b, icon: 'assets/icon.png' });
}

function startTimer() {
    requestNotificationPermission();
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        const m = Math.floor(timerSeconds / 60);
        const s = timerSeconds % 60;
        document.getElementById('pomodoroTimer').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            triggerNotification("Pomodoro!", "Tempo esgotado.");
            alert("Pomodoro!");
            timerSeconds = 1500;
            document.getElementById('pomodoroTimer').innerText = "25:00";
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerSeconds = 1500;
    document.getElementById('pomodoroTimer').innerText = "25:00";
}

function getTodayString() {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

function formatDate(s) {
    if (!s) return '';
    const d = new Date(s);
    return new Date(d.getTime() + (d.getTimezoneOffset() * 60000)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fireConfetti() {
    const end = Date.now() + 1000;
    (function frame() {
        confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ff6900', '#fff'] });
        confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff6900', '#fff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

function getAvatar(name) {
    if (!name) return '';
    const i = name.substring(0, 2).toUpperCase();
    let h = 0;
    for (let j = 0; j < name.length; j++) h = name.charCodeAt(j) + ((h << 5) - h);
    const c = "#" + "00000".substring(0, 6 - (h & 0x00FFFFFF).toString(16).toUpperCase().length) + (h & 0x00FFFFFF).toString(16).toUpperCase();
    return `<div class="avatar" style="background-color:${c}" title="${name}">${i}</div>`;
}

function updateMembersDropdown() {
    const s = document.getElementById('modalMemberInput');
    let h = `<option value="">👤 Ninguém</option>`;
    members.forEach(m => h += `<option value="${m}">${m}</option>`);
    s.innerHTML = h;
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
            datasets: [{ data: Object.values(tagCounts), backgroundColor: chartColors, borderWidth: 0 }]
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
            datasets: [{ label: 'Qtd', data: dataStatus, backgroundColor: '#3b82f6', borderRadius: 5 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor } },
                x: { ticks: { color: textColor } }
            },
            plugins: { legend: { display: false } }
        }
    });

    const total = tasks.length;
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    const doneCount = doneCol ? tasks.filter(t => t.status === doneCol.id).length : 0;
    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    document.getElementById('statsSummary').innerHTML = `<strong>Total:</strong> ${total} tarefas. <strong>Concluído:</strong> ${pct}%`;
}