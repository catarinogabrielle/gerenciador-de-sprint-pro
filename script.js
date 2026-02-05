let tasks = JSON.parse(localStorage.getItem('nexus_tasks_v3')) || [];
let theme = localStorage.getItem('nexus_theme') || 'light';
let boardTitle = localStorage.getItem('nexus_title') || 'Sprint Semanal';

document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('boardTitle').innerText = boardTitle;
    render();
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

function addTask() {
    const input = document.getElementById('taskInput');
    const tag = document.getElementById('tagInput');
    const priority = document.getElementById('priorityInput');

    if (!input.value.trim()) return;

    const newTask = {
        id: 'id-' + Date.now(),
        text: input.value,
        tag: tag.value,
        priority: priority.value,
        status: 'todo'
    };

    tasks.push(newTask);
    input.value = '';
    save();
}

function save() {
    localStorage.setItem('nexus_tasks_v3', JSON.stringify(tasks));
    render();
}

function render() {
    document.querySelectorAll('.tasks-container').forEach(c => c.innerHTML = '');

    tasks.forEach(t => {
        const card = document.createElement('div');
        card.className = `card ${t.status === 'done' ? 'finalizado' : ''}`;
        card.id = t.id;
        card.draggable = true;

        card.ondragstart = (e) => e.dataTransfer.setData("id", t.id);

        const prioColor = t.priority === 'Alta' ? '#ef4444' : t.priority === 'Média' ? '#f59e0b' : '#6366f1';

        card.innerHTML = `
            <div class="tag-row"><div class="tag">${t.tag}</div></div>
            <span class="card-text" contenteditable="true" onblur="updateText('${t.id}', this)">${t.text}</span>
            <div class="card-footer">
                <div class="prio-indicator">
                    <div class="dot" style="background:${prioColor}"></div>
                    <span>${t.priority}</span>
                </div>
                <span style="cursor:pointer; opacity: 0.6; color: red;" onclick="deleteTask('${t.id}')">Excluir</span>
            </div>
        `;

        const container = document.getElementById(t.status).querySelector('.tasks-container');
        container.appendChild(card);
    });

    updateMetrics();
}

function updateText(id, el) {
    const t = tasks.find(x => x.id === id);
    if (t) t.text = el.innerText;
    localStorage.setItem('nexus_tasks_v3', JSON.stringify(tasks));
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
}

function clearAllDone() {
    if (confirm("Deseja remover todas as tarefas concluídas?")) {
        tasks = tasks.filter(t => t.status !== 'done');
        save();
        toggleMenu();
    }
}

function updateMetrics() {
    const counts = { todo: 0, doing: 0, done: 0 };

    tasks.forEach(t => {
        if (counts.hasOwnProperty(t.status)) counts[t.status]++;
    });

    for (let status in counts) {
        const el = document.getElementById(`count-${status}`);
        if (el) el.innerText = counts[status];
    }

    const total = tasks.length;
    const done = counts.done;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const fill = document.getElementById('prog-fill');
    const val = document.getElementById('prog-val');

    if (fill) fill.style.width = percent + '%';
    if (val) val.innerText = percent + '%';
}

function allowDrop(e) {
    e.preventDefault();
    const col = getCol(e.target);
    if (col) col.classList.add('drag-over');
}

function dragLeave(e) {
    const col = getCol(e.target);
    if (col) col.classList.remove('drag-over');
}

function drop(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const col = getCol(e.target);

    if (col) {
        col.classList.remove('drag-over');
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.status = col.id;
            save();
        }
    }
}

function getCol(el) {
    while (el && !el.classList.contains('column')) el = el.parentElement;
    return el;
}
