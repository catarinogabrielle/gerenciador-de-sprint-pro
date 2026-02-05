let tasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];
let theme = localStorage.getItem('nexus_theme') || 'light';
let boardTitle = localStorage.getItem('nexus_title') || 'Sprint Semanal';

let currentTagFilter = 'all';
let currentPriorityFilter = 'all';

let editingTaskId = null;

document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('boardTitle').innerText = boardTitle;
    setupDragAndDrop();
    render();
});

function openModal(taskId = null) {
    const modal = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('modalSaveBtn');

    clearModalFields();

    if (taskId) {
        editingTaskId = taskId;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        modalTitle.innerText = "Editar Tarefa";
        saveBtn.innerText = "Atualizar Tarefa";

        document.getElementById('modalTaskInput').value = task.text;
        document.getElementById('modalDescriptionInput').value = task.description || '';
        document.getElementById('modalTagInput').value = task.tag;
        document.getElementById('modalPriorityInput').value = task.priority;
        document.getElementById('modalDateStart').value = task.startDate || '';
        document.getElementById('modalDateEnd').value = task.endDate || '';

    } else {
        editingTaskId = null;
        modalTitle.innerText = "Nova Tarefa";
        saveBtn.innerText = "Salvar Tarefa";

        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localDate = new Date(today.getTime() - (offset * 60 * 1000));
        document.getElementById('modalDateStart').value = localDate.toISOString().split('T')[0];

        setTimeout(() => document.getElementById('modalTaskInput').focus(), 100);
    }

    modal.classList.add('active');
}

function clearModalFields() {
    document.getElementById('modalTaskInput').value = '';
    document.getElementById('modalDescriptionInput').value = '';
    document.getElementById('modalDateStart').value = '';
    document.getElementById('modalDateEnd').value = '';
    document.getElementById('modalTagInput').selectedIndex = 0;
    document.getElementById('modalPriorityInput').selectedIndex = 0;
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editingTaskId = null;
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
        closeModal();
    }
});

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_theme', theme);
}

function saveTitle() {
    boardTitle = document.getElementById('boardTitle').innerText;
    localStorage.setItem('nexus_title', boardTitle);
}

function applyFilters() {
    currentTagFilter = document.getElementById('filterTag').value;
    currentPriorityFilter = document.getElementById('filterPriority').value;
    render();
}

function saveTaskBtnClick() {
    const titleInput = document.getElementById('modalTaskInput');

    if (!titleInput.value.trim()) {
        alert("O título da tarefa é obrigatório.");
        titleInput.focus();
        return;
    }

    if (editingTaskId) {
        updateExistingTask(editingTaskId);
    } else {
        createNewTask();
    }
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

        saveAndClose();
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

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const offsetDate = new Date(date.getTime() + userTimezoneOffset);
    return offsetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function render() {
    document.querySelectorAll('.tasks-container').forEach(c => c.innerHTML = '');

    const filteredTasks = tasks.filter(t => {
        const matchTag = currentTagFilter === 'all' || t.tag === currentTagFilter;
        const matchPriority = currentPriorityFilter === 'all' || t.priority === currentPriorityFilter;
        return matchTag && matchPriority;
    });

    filteredTasks.forEach(t => {
        const card = document.createElement('div');
        card.className = `card ${t.status === 'done' ? 'finalizado' : ''}`;
        card.id = t.id;
        card.draggable = true;
        card.onclick = () => openModal(t.id);

        let dateHtml = '';
        if (t.startDate || t.endDate) {
            dateHtml = `
                <div class="date-display">
                    📅 ${formatDate(t.startDate)} ${t.endDate ? '- ' + formatDate(t.endDate) : ''}
                </div>
            `;
        }

        const descIcon = t.description && t.description.trim() !== '' ? '<span class="has-desc-icon" title="Ver descrição detalhada">📄</span>' : '';

        const prioColor = t.priority === 'Alta' ? '#ef4444' : t.priority === 'Média' ? '#f59e0b' : '#6366f1';

        card.innerHTML = `
            <div class="tag-row">
                <div class="tag">${t.tag}</div>
                ${dateHtml}
                ${descIcon}
            </div>
            <span class="card-text">${t.text}</span>
            <div class="card-footer">
                <div class="prio-indicator">
                    <div class="dot" style="background:${prioColor}"></div>
                    <span>${t.priority}</span>
                </div>
                <span class="delete-btn" onclick="deleteTask(event, '${t.id}')">Excluir</span>
            </div>
        `;

        const colElement = document.getElementById(t.status);
        if (colElement) {
            colElement.querySelector('.tasks-container').appendChild(card);
        }

        card.addEventListener('dragstart', () => {
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            saveNewOrder();
        });
    });

    updateMetrics(filteredTasks);
}

function setupDragAndDrop() {
    const columns = document.querySelectorAll('.column');

    columns.forEach(column => {
        const container = column.querySelector('.tasks-container');

        container.addEventListener('dragover', e => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging');
            if (!draggable) return;

            const afterElement = getDragAfterElement(container, e.clientY);

            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveNewOrder() {
    const newTasksOrder = [];
    ['todo', 'doing', 'done'].forEach(statusId => {
        const colElement = document.getElementById(statusId);
        const cards = colElement.querySelectorAll('.card');

        cards.forEach(card => {
            const taskObj = tasks.find(t => t.id === card.id);
            if (taskObj) {
                taskObj.status = statusId;
                newTasksOrder.push(taskObj);
            }
        });
    });

    const visibleIds = newTasksOrder.map(t => t.id);
    const hiddenTasks = tasks.filter(t => !visibleIds.includes(t.id));

    tasks = [...newTasksOrder, ...hiddenTasks];
    save();
}

function deleteTask(event, id) {
    event.stopPropagation();
    if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
        tasks = tasks.filter(t => t.id !== id);
        save();
    }
}

function clearAllDone() {
    if (confirm("Deseja remover todas as tarefas concluídas?")) {
        tasks = tasks.filter(t => t.status !== 'done');
        save();
        toggleMenu();
    }
}

function updateMetrics(taskList = tasks) {
    const counts = { todo: 0, doing: 0, done: 0 };
    taskList.forEach(t => { if (counts.hasOwnProperty(t.status)) counts[t.status]++; });

    for (let status in counts) {
        const el = document.getElementById(`count-${status}`);
        if (el) el.innerText = counts[status];
    }

    const total = taskList.length;
    const done = counts.done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const fill = document.getElementById('prog-fill');
    const val = document.getElementById('prog-val');
    if (fill) fill.style.width = percent + '%';
    if (val) val.innerText = percent + '%';
}