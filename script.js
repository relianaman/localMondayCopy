
const taskForm = document.getElementById("taskForm");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const dueDateInput = document.getElementById("dueDate");
const priorityInput = document.getElementById("priority");

const taskList = document.getElementById("taskList");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");

const totalTasks = document.getElementById("totalTasks");
const pendingTasks = document.getElementById("pendingTasks");
const completedTasks = document.getElementById("completedTasks");
const taskCount = document.getElementById("taskCount");

const formHeading = document.getElementById("formHeading");
const submitButton = document.getElementById("submitButton");
const cancelButton = document.getElementById("cancelButton");

// Load saved tasks from the browser
let tasks = [];

try {
    const savedTasks = localStorage.getItem("studentTasks");
    tasks = savedTasks ? JSON.parse(savedTasks) : [];

    if (
        !Array.isArray(tasks) ||
        !tasks.every(task =>
            task &&
            typeof task.id === "string" &&
            typeof task.title === "string" &&
            typeof task.description === "string" &&
            typeof task.dueDate === "string" &&
            ["Low", "Medium", "High"].includes(task.priority) &&
            typeof task.completed === "boolean"
        )
    ) {
        tasks = [];
    }
} catch (error) {
    tasks = [];
}

let editingTaskId = null;

// Get today's date in local time
function getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Set the minimum selectable due date
dueDateInput.min = getToday();

// Save tasks in localStorage
function saveTasks() {
    try {
        localStorage.setItem("studentTasks", JSON.stringify(tasks));
    } catch (error) {
        alert("Unable to save tasks in this browser.");
    }
}

// Update dashboard statistics
function updateStatistics() {
    totalTasks.textContent = tasks.length;

    pendingTasks.textContent = tasks.filter(
        task => !task.completed
    ).length;

    completedTasks.textContent = tasks.filter(
        task => task.completed
    ).length;
}

// Create a text element safely
function createTextElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    element.textContent = text;

    return element;
}

// Format the date for display
function formatDate(dateString) {
    const [year, month, day] = dateString.split("-");

    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    ).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// Add a button to a task card
function createButton(text, className, action) {
    const button = createTextElement(
        "button",
        `btn btn-small ${className}`,
        text
    );

    button.type = "button";
    button.addEventListener("click", action);

    return button;
}

// Display one task card
function createTaskCard(task) {
    const card = document.createElement("article");

    card.className = "task-card priority-" + task.priority;

    if (task.completed) {
        card.classList.add("completed-task");
    }

    const top = document.createElement("div");
    top.className = "task-top";

    const title = createTextElement(
        "h3",
        "task-title",
        task.title
    );

    const priorityBadge = createTextElement(
        "span",
        `priority-badge ${task.priority}`,
        task.priority + " Priority"
    );

    top.append(title, priorityBadge);
    card.appendChild(top);

    if (task.description) {
        const description = createTextElement(
            "p",
            "task-description",
            task.description
        );

        card.appendChild(description);
    }

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const dueDate = createTextElement(
        "span",
        "",
        "Due: " + formatDate(task.dueDate)
    );

    if (!task.completed && task.dueDate < getToday()) {
        dueDate.classList.add("overdue");
        dueDate.textContent += " (Overdue)";
    }

    const statusBadge = createTextElement(
        "span",
        task.completed
            ? "status-badge completed"
            : "status-badge",
        task.completed ? "Completed" : "Pending"
    );

    meta.append(dueDate, statusBadge);
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const completeButton = createButton(
        task.completed ? "Mark Pending" : "Mark Complete",
        "btn-success",
        () => toggleTask(task.id)
    );

    const editButton = createButton(
        "Edit",
        "btn-primary",
        () => editTask(task.id)
    );

    const deleteButton = createButton(
        "Delete",
        "btn-danger",
        () => deleteTask(task.id)
    );

    actions.append(
        completeButton,
        editButton,
        deleteButton
    );

    card.appendChild(actions);

    return card;
}

// Display tasks according to selected filters
function renderTasks() {
    taskList.replaceChildren();

    let filteredTasks = [...tasks];

    const status = statusFilter.value;
    const priority = priorityFilter.value;

    if (status === "pending") {
        filteredTasks = filteredTasks.filter(
            task => !task.completed
        );
    } else if (status === "completed") {
        filteredTasks = filteredTasks.filter(
            task => task.completed
        );
    }

    if (priority !== "all") {
        filteredTasks = filteredTasks.filter(
            task => task.priority === priority
        );
    }

    // Show upcoming tasks first
    filteredTasks.sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate)
    );

    taskCount.textContent =
        `${filteredTasks.length} ${
            filteredTasks.length === 1 ? "task" : "tasks"
        }`;

    if (filteredTasks.length === 0) {
        const emptyMessage = createTextElement(
            "div",
            "empty-state",
            tasks.length === 0
                ? "No tasks yet. Add your first task above!"
                : "No tasks match the selected filters."
        );

        taskList.appendChild(emptyMessage);
        return;
    }

    filteredTasks.forEach(task => {
        taskList.appendChild(createTaskCard(task));
    });
}

// Refresh the complete interface
function refreshApp() {
    updateStatistics();
    renderTasks();
}

// Reset the form after adding or editing
function resetForm() {
    taskForm.reset();
    editingTaskId = null;

    formHeading.textContent = "Add a New Task";
    submitButton.textContent = "+ Add Task";
    cancelButton.hidden = true;

    dueDateInput.min = getToday();
}

// Add or update a task
taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const dueDate = dueDateInput.value;
    const priority = priorityInput.value;

    if (!title) {
        alert("Please enter a task title.");
        titleInput.focus();
        return;
    }

    if (!dueDate) {
        alert("Please select a due date.");
        dueDateInput.focus();
        return;
    }

    if (dueDate < getToday()) {
        alert("Please select today or a future date.");
        dueDateInput.focus();
        return;
    }

    if (!["Low", "Medium", "High"].includes(priority)) {
        alert("Please select a valid priority.");
        return;
    }

    if (editingTaskId !== null) {
        const task = tasks.find(
            item => item.id === editingTaskId
        );

        if (task) {
            task.title = title;
            task.description = description;
            task.dueDate = dueDate;
            task.priority = priority;
        }
    } else {
        const newTask = {
            id: crypto.randomUUID(),
            title: title,
            description: description,
            dueDate: dueDate,
            priority: priority,
            completed: false
        };

        tasks.push(newTask);
    }

    saveTasks();
    resetForm();
    refreshApp();
});

// Edit an existing task
function editTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    editingTaskId = id;

    titleInput.value = task.title;
    descriptionInput.value = task.description;
    dueDateInput.value = task.dueDate;
    priorityInput.value = task.priority;

    // Allow an existing overdue task to be edited
    dueDateInput.min = getToday();

    formHeading.textContent = "Edit Task";
    submitButton.textContent = "Save Changes";
    cancelButton.hidden = false;

    taskForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    titleInput.focus();
}

// Delete a task
function deleteTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    const confirmed = confirm(
        `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    tasks = tasks.filter(item => item.id !== id);

    if (editingTaskId === id) {
        resetForm();
    }

    saveTasks();
    refreshApp();
}

// Mark a task complete or pending
function toggleTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    task.completed = !task.completed;

    saveTasks();
    refreshApp();
}

// Cancel editing
cancelButton.addEventListener("click", resetForm);

// Apply filters whenever the selection changes
statusFilter.addEventListener("change", renderTasks);
priorityFilter.addEventListener("change", renderTasks);

// Display saved tasks when the application opens
refreshApp();
