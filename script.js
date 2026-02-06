let tasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];

let tags = JSON.parse(localStorage.getItem('nexus_tags')) || [
    "💻 Desenvolvimento",
    "🐛 Bug Fix",
    "🏋️ Treino",
    "📅 Reunião",
    "🚀 Deploy",
    "🎨 Design"
];

let boards = JSON.parse(localStorage.getItem('nexus_boards_list')) || [];
let currentBoardId = localStorage.getItem('nexus_active_board_id');

if (boards.length === 0) {
    const oldTasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];
    const oldColumns = JSON.parse(localStorage.getItem('nexus_columns')) || [];
    const oldTitle = localStorage.getItem('nexus_title') || 'Sprint Principal';
    const firstBoardId = 'board-' + Date.now();

    boards.push({
        id: firstBoardId,
        title: oldTitle
    });
    localStorage.setItem('nexus_boards_list', JSON.stringify(boards));

    localStorage.setItem(`nexus_tasks_${firstBoardId}`, JSON.stringify(oldTasks));
    localStorage.setItem(`nexus_columns_${firstBoardId}`, JSON.stringify(oldColumns));

    currentBoardId = firstBoardId;
    localStorage.setItem('nexus_active_board_id', currentBoardId);
}

let columns = JSON.parse(localStorage.getItem(`nexus_columns_${currentBoardId}`)) || [];

if (!columns || columns.length === 0) {
    columns = [
        { id: 'todo', title: 'Pendências' },
        { id: 'doing', title: 'Em Andamento' },
        { id: 'done', title: 'Concluído' }
    ];
}

tasks = JSON.parse(localStorage.getItem(`nexus_tasks_${currentBoardId}`)) || [];

let theme = localStorage.getItem('nexus_theme') || 'light';
let currentBg = localStorage.getItem('nexus_bg') || 'default';
let boardTitle = boards.find(b => b.id === currentBoardId)?.title || 'Meu Quadro';

let currentTagFilter = 'all';
let currentPriorityFilter = 'all';
let searchTerm = '';
let editingTaskId = null;
let tempSubtasks = [];
let tempComments = [];

let timerInterval;
let timerSeconds = 1500;
let isTimerRunning = false;
let tagsChartInstance = null;
let statusChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('boardTitle').innerText = boardTitle;
    applyBackground(currentBg);

    document.addEventListener('paste', handlePaste);
    document.getElementById('overlay').addEventListener('click', toggleMenu);

    updateTagsDropdown();
    renderBoardsList();
    render();

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

function showSysModal(title, message, type = 'alert', placeholder = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('sysOverlay');
        const titleEl = document.getElementById('sysTitle');
        const msgEl = document.getElementById('sysMessage');
        const inputEl = document.getElementById('sysInput');
        const btnConfirm = document.getElementById('sysBtnConfirm');
        const btnCancel = document.getElementById('sysBtnCancel');

        titleEl.innerText = title;
        msgEl.innerText = message;
        inputEl.value = '';

        if (type === 'prompt') {
            inputEl.style.display = 'block';
        } else {
            inputEl.style.display = 'none';
        }

        inputEl.placeholder = placeholder;

        if (type === 'alert') {
            btnCancel.style.display = 'none';
        } else {
            btnCancel.style.display = 'block';
        }

        btnConfirm.innerText = 'OK';

        btnConfirm.className = 'btn-primary';
        if (title.toLowerCase().includes('excluir') || title.toLowerCase().includes('limpar')) {
            btnConfirm.style.background = '#ef4444';
            btnConfirm.style.borderColor = '#ef4444';
        } else {
            btnConfirm.style.background = '';
            btnConfirm.style.borderColor = '';
        }

        overlay.classList.add('active');

        if (type === 'prompt') {
            setTimeout(() => {
                inputEl.focus();
            }, 100);
        }

        const close = (value) => {
            overlay.classList.remove('active');
            resolve(value);
        };

        btnConfirm.onclick = () => {
            if (type === 'prompt') {
                close(inputEl.value);
            } else {
                close(true);
            }
        };

        btnCancel.onclick = () => {
            if (type === 'prompt') {
                close(null);
            } else {
                close(false);
            }
        };

        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                btnConfirm.click();
            }
        };
    });
}

async function showSysAlert(message) {
    return await showSysModal('Aviso', message, 'alert');
}

async function showSysConfirm(message, title = 'Confirmação') {
    return await showSysModal(title, message, 'confirm');
}

async function showSysPrompt(title, placeholder = '') {
    return await showSysModal(title, '', 'prompt', placeholder);
}

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

function renderBoardsList() {
    const list = document.getElementById('boardsList');

    const htmlContent = boards.map(board => {
        const activeClass = board.id === currentBoardId ? 'active' : '';
        return `
            <div class="board-item ${activeClass}" onclick="switchBoard('${board.id}')">
                <span class="board-item-icon">📋</span>
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${board.title}
                </span>
            </div>
        `;
    }).join('');

    list.innerHTML = htmlContent;
}

async function createNewBoard() {
    const title = await showSysPrompt("Nome do novo quadro:");

    if (!title) {
        return;
    }

    const newId = 'board-' + Date.now();

    boards.push({
        id: newId,
        title: title
    });

    localStorage.setItem('nexus_boards_list', JSON.stringify(boards));

    const defaultCols = [
        { id: 'todo', title: 'A Fazer' },
        { id: 'doing', title: 'Fazendo' },
        { id: 'done', title: 'Feito' }
    ];

    localStorage.setItem(`nexus_tasks_${newId}`, JSON.stringify([]));
    localStorage.setItem(`nexus_columns_${newId}`, JSON.stringify(defaultCols));

    switchBoard(newId);
}

function switchBoard(boardId) {
    const currentBoard = boards.find(b => b.id === currentBoardId);

    if (currentBoard) {
        currentBoard.title = document.getElementById('boardTitle').innerText;
        localStorage.setItem('nexus_boards_list', JSON.stringify(boards));
    }

    currentBoardId = boardId;
    localStorage.setItem('nexus_active_board_id', currentBoardId);

    tasks = JSON.parse(localStorage.getItem(`nexus_tasks_${currentBoardId}`)) || [];
    columns = JSON.parse(localStorage.getItem(`nexus_columns_${currentBoardId}`)) || [];

    const newBoard = boards.find(b => b.id === currentBoardId);
    boardTitle = newBoard ? newBoard.title : 'Quadro';
    document.getElementById('boardTitle').innerText = boardTitle;

    render();
    renderBoardsList();
}

async function deleteCurrentBoard() {
    if (boards.length <= 1) {
        await showSysAlert("Você não pode excluir o único quadro restante.");
        return;
    }

    const confirmed = await showSysConfirm(
        "Tem certeza? Isso apagará todas as tarefas deste quadro permanentemente.",
        "Excluir Quadro"
    );

    if (confirmed) {
        localStorage.removeItem(`nexus_tasks_${currentBoardId}`);
        localStorage.removeItem(`nexus_columns_${currentBoardId}`);

        boards = boards.filter(b => b.id !== currentBoardId);
        localStorage.setItem('nexus_boards_list', JSON.stringify(boards));

        switchBoard(boards[0].id);
    }
}

function saveTitle() {
    boardTitle = document.getElementById('boardTitle').innerText;
    const boardIndex = boards.findIndex(b => b.id === currentBoardId);

    if (boardIndex > -1) {
        boards[boardIndex].title = boardTitle;
        localStorage.setItem('nexus_boards_list', JSON.stringify(boards));
    }

    renderBoardsList();
}

function save() {
    localStorage.setItem(`nexus_tasks_${currentBoardId}`, JSON.stringify(tasks));
    localStorage.setItem(`nexus_columns_${currentBoardId}`, JSON.stringify(columns));
    render();
}

function saveColumns() {
    localStorage.setItem(`nexus_columns_${currentBoardId}`, JSON.stringify(columns));
    render();
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            setCoverImage(e.target.result);
        }

        reader.readAsDataURL(file);
    }
}

function handlePaste(e) {
    const modal = document.getElementById('modalOverlay');

    if (!modal.classList.contains('active')) {
        return;
    }

    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();

                reader.onload = function (event) {
                    setCoverImage(event.target.result);
                };

                reader.readAsDataURL(blob);
                e.preventDefault();
                return;
            }
        }
    }
}

function setCoverImage(base64String) {
    const preview = document.getElementById('coverPreview');
    const placeholder = document.getElementById('coverPlaceholder');
    const hiddenInput = document.getElementById('modalCoverInput');
    const removeBtn = document.getElementById('removeCoverBtn');

    preview.src = base64String;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'block';
    hiddenInput.value = base64String;
}

function removeCover(e) {
    e.stopPropagation();

    const preview = document.getElementById('coverPreview');
    const placeholder = document.getElementById('coverPlaceholder');
    const hiddenInput = document.getElementById('modalCoverInput');
    const removeBtn = document.getElementById('removeCoverBtn');
    const fileInput = document.getElementById('fileCoverInput');

    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    removeBtn.style.display = 'none';

    hiddenInput.value = '';
    fileInput.value = '';
}

async function addColumn() {
    const title = await showSysPrompt("Nome da nova coluna:");

    if (title) {
        const id = 'col-' + Date.now();
        columns.push({
            id: id,
            title: title
        });
        saveColumns();
    }
}

async function deleteColumn(colId) {
    const tasksInCol = tasks.filter(t => t.status === colId);

    if (tasksInCol.length > 0) {
        await showSysAlert("Esta coluna contém tarefas. Mova-as antes de excluir.");
        return;
    }

    const confirmed = await showSysConfirm("Tem certeza que deseja excluir esta coluna?", "Excluir Coluna");

    if (confirmed) {
        columns = columns.filter(c => c.id !== colId);
        saveColumns();
    }
}

function updateColumnTitle(colId, newTitle) {
    const col = columns.find(c => c.id === colId);

    if (col) {
        col.title = newTitle;
        saveColumns();
    }
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

            let coverHtml = '';
            if (t.cover) {
                coverHtml = `<img src="${t.cover}" class="card-cover" alt="Capa">`;
            }

            let dateHtml = '';
            if (t.startDate || t.endDate) {
                const isOverdue = t.endDate && t.endDate < getTodayString() && !isDoneCol;
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
                ${coverHtml}
                <div class="tag-row">
                    <div class="tag">${t.tag}</div>
                    ${dateHtml}
                    ${descIcon}
                </div>
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
                if (colData) {
                    newColumnOrder.push(colData);
                }
            });

            columns = newColumnOrder;
            saveColumns();
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
        document.getElementById('modalDateStart').value = task.startDate || '';
        document.getElementById('modalDateEnd').value = task.endDate || '';

        if (task.cover) {
            setCoverImage(task.cover);
        }

        tempSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];
        tempComments = task.comments ? JSON.parse(JSON.stringify(task.comments)) : [];

        renderSubtasksList();
        renderCommentsList();

        saveBtn.onclick = () => saveTaskBtnClick();
        switchDescTab('preview');

    } else {
        editingTaskId = null;
        modalTitle.innerText = "Nova Tarefa";
        saveBtn.innerText = "Salvar";
        deleteBtn.style.display = 'none';

        tempSubtasks = [];
        tempComments = [];
        renderSubtasksList();
        renderCommentsList();

        document.getElementById('modalDateStart').value = getTodayString();
        const defaultStatus = initialStatus || (columns.length > 0 ? columns[0].id : 'todo');
        saveBtn.onclick = () => saveTaskBtnClick(defaultStatus);

        switchDescTab('write');
        setTimeout(() => {
            document.getElementById('modalTaskInput').focus();
        }, 100);
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

    document.getElementById('modalCoverInput').value = '';
    document.getElementById('commentsList').innerHTML = '';
    document.getElementById('commentInput').value = '';

    removeCover({ stopPropagation: () => { } });
}

async function saveTaskBtnClick(statusOverride = null) {
    const titleInput = document.getElementById('modalTaskInput');

    if (!titleInput.value.trim()) {
        await showSysAlert("O título da tarefa é obrigatório.");
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
        cover: document.getElementById('modalCoverInput').value,
        startDate: document.getElementById('modalDateStart').value,
        endDate: document.getElementById('modalDateEnd').value,
        subtasks: tempSubtasks,
        comments: tempComments,
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
        tasks[taskIndex].cover = document.getElementById('modalCoverInput').value;
        tasks[taskIndex].startDate = document.getElementById('modalDateStart').value;
        tasks[taskIndex].endDate = document.getElementById('modalDateEnd').value;
        tasks[taskIndex].subtasks = tempSubtasks;
        tasks[taskIndex].comments = tempComments;

        saveAndClose();
    }
}

async function deleteTaskFromModal() {
    if (!editingTaskId) {
        return;
    }

    const confirmed = await showSysConfirm("Tem certeza absoluta que deseja excluir esta tarefa?", "Excluir Tarefa");

    if (confirmed) {
        tasks = tasks.filter(t => t.id !== editingTaskId);
        save();
        closeModal();
    }
}

function saveAndClose() {
    save();
    closeModal();
}

function handleSubtaskEnter(e) {
    if (e.key === 'Enter') {
        addSubtask();
    }
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

function addComment() {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    const currentMember = 'Usuário';

    if (text) {
        const now = new Date();
        const timeString = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        tempComments.push({
            text: text,
            author: currentMember,
            date: timeString
        });

        input.value = '';
        renderCommentsList();
    }
}

function renderCommentsList() {
    const container = document.getElementById('commentsList');

    if (tempComments.length === 0) {
        container.innerHTML = '<div style="color:var(--text-sub); font-size:0.8rem; text-align:center;">Nenhum comentário.</div>';
        return;
    }

    container.innerHTML = tempComments.map((c) => `
        <div class="comment-item">
            <div class="comment-header">
                <span>${c.author}</span>
                <span style="font-weight:400; opacity:0.7;">${c.date}</span>
            </div>
            <div class="comment-text">${c.text}</div>
        </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
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

        if (micBtn) {
            micBtn.style.display = 'flex';
        }
        input.focus();
    } else {
        btnWrite.classList.remove('active');
        btnPreview.classList.add('active');
        input.style.display = 'none';
        preview.style.display = 'block';

        if (micBtn) {
            micBtn.style.display = 'none';
        }
        preview.innerHTML = simpleMarkdown(input.value);
    }
}

function simpleMarkdown(text) {
    if (!text || text.trim() === '') {
        return '<div style="color:var(--text-sub); text-align:center; padding:10px;"><em>Nenhuma descrição inserida.</em></div>';
    }

    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');

    let lines = html.split('\n');
    let inList = false;
    let newLines = [];

    lines.forEach(line => {
        let t = line.trim();
        if (t.startsWith('- ')) {
            if (!inList) {
                newLines.push('<ul>');
                inList = true;
            }
            newLines.push(`<li>${t.substring(2)}</li>`);
        } else {
            if (inList) {
                newLines.push('</ul>');
                inList = false;
            }
            if (t === '') {
                newLines.push('<br>');
            } else {
                newLines.push(`<div>${line}</div>`);
            }
        }
    });

    if (inList) newLines.push('</ul>');
    return newLines.join('').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
}

async function startVoice(targetId, btnElement) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        await showSysAlert("Seu navegador não suporta reconhecimento de voz.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.maxAlternatives = 1;
    recognition.start();

    btnElement.classList.add('recording');
    const originalText = btnElement.innerText;

    if (btnElement.classList.contains('btn-mic-small')) {
        btnElement.innerText = "👂...";
    }

    recognition.onresult = (evt) => {
        const t = evt.results[0][0].transcript;
        const input = document.getElementById(targetId);
        input.value = input.value.trim() ? input.value + " " + t : t;
        input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
    };

    recognition.onspeechend = () => {
        recognition.stop();
        btnElement.classList.remove('recording');
        if (btnElement.classList.contains('btn-mic-small')) {
            btnElement.innerText = originalText;
        }
    };

    recognition.onerror = () => {
        btnElement.classList.remove('recording');
        if (btnElement.classList.contains('btn-mic-small')) {
            btnElement.innerText = originalText;
        }
    };
}

function setBg(t) {
    currentBg = t;
    localStorage.setItem('nexus_bg', t);
    applyBackground(t);
}

function applyBackground(t) {
    const r = document.documentElement;
    const base = theme === 'dark' ? '#010409' : '#f8fafc';

    r.style.setProperty('--bg-body', base);
    r.style.setProperty('--bg-image', 'none');

    if (t === 'gradient-dark') {
        r.style.setProperty('--bg-image', 'linear-gradient(135deg, #1e1e24, #0b0c10)');
    } else if (t === 'gradient-purple') {
        r.style.setProperty('--bg-image', 'linear-gradient(135deg, #2b5876, #4e4376)');
    } else if (t === 'space') {
        r.style.setProperty('--bg-image', "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1280&auto=format&fit=crop')");
    }
}

function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_theme', theme);
    applyBackground(currentBg);

    if (document.getElementById('statsOverlay').classList.contains('active')) {
        renderCharts();
    }
}

function requestNotificationPermission() {
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}

function triggerNotification(t, b) {
    document.getElementById('alertSound').play().catch(e => console.log(e));
    if (Notification.permission === "granted") {
        new Notification(t, { body: b, icon: 'assets/icon.png' });
    }
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
            showSysAlert("Pomodoro: Tempo esgotado!");
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

async function updateTagsDropdown() {
    const m = document.getElementById('modalTagInput');
    const f = document.getElementById('filterTag');
    m.innerHTML = tags.map(t => `<option value="${t}">${t}</option>`).join('');
    f.innerHTML = `<option value="all">🏷️ Tags</option>` + tags.map(t => `<option value="${t}">${t}</option>`).join('');
    f.value = currentTagFilter;
}

async function addNewTag() {
    const t = await showSysPrompt("Tag:");

    if (t && !tags.includes(t)) {
        tags.push(t);
        localStorage.setItem('nexus_tags', JSON.stringify(tags));
        updateTagsDropdown();
    }
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

async function clearAllDone() {
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));

    if (doneCol && await showSysConfirm("Limpar tarefas concluídas?", "Limpar Tudo")) {
        tasks = tasks.filter(t => t.status !== doneCol.id);
        save();
        toggleMenu();
    } else if (!doneCol) {
        await showSysAlert("Nenhuma coluna de conclusão encontrada.");
    }
}

function exportData() {
    const d = JSON.stringify({
        tasks,
        tags,
        columns,
        boardTitle
    });
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
    r.onload = async function (e) {
        try {
            const d = JSON.parse(e.target.result);
            if (d.tasks) tasks = d.tasks;
            if (d.tags) {
                tags = d.tags;
                localStorage.setItem('nexus_tags', JSON.stringify(tags));
            }
            if (d.columns) {
                columns = d.columns;
                localStorage.setItem('nexus_columns', JSON.stringify(columns));
            }
            if (d.boardTitle) {
                boardTitle = d.boardTitle;
                localStorage.setItem('nexus_title', boardTitle);
            }
            document.getElementById('boardTitle').innerText = boardTitle;
            save();
            updateTagsDropdown();
            await showSysAlert("Backup restaurado!");
        } catch (err) {
            await showSysAlert("Erro ao importar.");
        }
    };
    r.readAsText(f);
}

function openStatsModal() {
    document.getElementById('statsOverlay').classList.add('active');
    renderCharts();
}

function closeStatsModal() {
    document.getElementById('statsOverlay').classList.remove('active');
}

document.getElementById('statsOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('statsOverlay')) {
        closeStatsModal();
    }
});

function renderCharts() {
    const tagCounts = {};
    tags.forEach(t => tagCounts[t] = 0);

    tasks.forEach(t => {
        if (tagCounts[t.tag] !== undefined) {
            tagCounts[t.tag]++;
        } else {
            tagCounts[t.tag] = 1;
        }
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
            datasets: [{
                data: Object.values(tagCounts),
                backgroundColor: chartColors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { size: 10 }
                    }
                }
            }
        }
    });

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();

    statusChartInstance = new Chart(ctxStatus, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Qtd',
                data: dataStatus,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor }
                },
                x: {
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    const total = tasks.length;
    const doneCol = columns.find(c => c.id === 'done' || c.title.toLowerCase().includes('conclu'));
    const doneCount = doneCol ? tasks.filter(t => t.status === doneCol.id).length : 0;
    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

    document.getElementById('statsSummary').innerHTML = `<strong>Total:</strong> ${total} tarefas. <strong>Concluído:</strong> ${pct}%`;
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
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ff6900', '#fff']
        });

        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ff6900', '#fff']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}