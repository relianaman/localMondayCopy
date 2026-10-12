(function () {
  "use strict";

  var STORAGE_KEY = "student-tasks-v1";
  var PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
  var PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

  var state = {
    tasks: [],
    status: "all",
    priority: "all",
    sort: "due",
    query: "",
    editingId: null
  };

  var toastTimer = null;

  /* ---------- Helpers ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function parseDate(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function dayDiff(fromStr, toStr) {
    return Math.round((parseDate(toStr) - parseDate(fromStr)) / 86400000);
  }
  function offsetDate(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function formatDate(s) {
    var d = parseDate(s);
    var opts = { day: "numeric", month: "short" };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString(undefined, opts);
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "text") node.textContent = props[k];
        else if (k === "class") node.className = props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- Storage ---------- */
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw === null) { state.tasks = sampleTasks(); save(); return; }
    try {
      var parsed = JSON.parse(raw);
      state.tasks = Array.isArray(parsed) ? parsed.filter(isValidTask) : [];
    } catch (e) { state.tasks = []; }
  }
  function isValidTask(t) {
    return t && typeof t.id === "string" && typeof t.title === "string" && PRIORITY_RANK.hasOwnProperty(t.priority);
  }
  function sampleTasks() {
    var now = Date.now();
    return [
      { id: uid(), title: "Submit chemistry lab report", description: "Include the titration graph and error analysis.", dueDate: offsetDate(1), priority: "high", completed: false, createdAt: now - 3000, completedAt: null },
      { id: uid(), title: "Read chapters 4 and 5 of History", description: "Make short notes on the causes of the war.", dueDate: offsetDate(4), priority: "medium", completed: false, createdAt: now - 2000, completedAt: null },
      { id: uid(), title: "Return library books", description: "", dueDate: offsetDate(-1), priority: "low", completed: false, createdAt: now - 1000, completedAt: null }
    ];
  }

  /* ---------- Derived data ---------- */
  function dueInfo(task) {
    if (!task.dueDate) return null;
    var diff = dayDiff(todayStr(), task.dueDate);
    if (!task.completed && diff < 0) return { text: "Overdue, " + formatDate(task.dueDate), cls: "overdue" };
    if (!task.completed && diff === 0) return { text: "Due today", cls: "today" };
    if (!task.completed && diff === 1) return { text: "Due tomorrow", cls: "" };
    return { text: "Due " + formatDate(task.dueDate), cls: "" };
  }

  function visibleTasks() {
    var q = state.query.trim().toLowerCase();
    var list = state.tasks.filter(function (t) {
      if (state.status === "active" && t.completed) return false;
      if (state.status === "completed" && !t.completed) return false;
      if (state.priority !== "all" && t.priority !== state.priority) return false;
      if (q && (t.title + " " + (t.description || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    list.sort(function (a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (state.sort === "priority") {
        var p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (p) return p;
        return dueCompare(a, b);
      }
      if (state.sort === "newest") return b.createdAt - a.createdAt;
      var d = dueCompare(a, b);
      if (d) return d;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
    return list;
  }
  function dueCompare(a, b) {
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  }

  /* ---------- Rendering ---------- */
  function render() {
    renderSummary();
    renderTabs();
    renderList();
  }

  function renderSummary() {
    var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.completed; }).length;
    var overdue = state.tasks.filter(function (t) {
      return !t.completed && t.dueDate && dayDiff(todayStr(), t.dueDate) < 0;
    }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    $("progressText").textContent = done + " of " + total + " done";
    $("overdueText").textContent = overdue ? overdue + " overdue" : "";
    $("progressFill").style.width = pct + "%";
    $("progressBar").setAttribute("aria-valuenow", pct);
  }

  function renderTabs() {
    var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.completed; }).length;
    $("count-all").textContent = total;
    $("count-active").textContent = total - done;
    $("count-completed").textContent = done;
    document.querySelectorAll(".tab").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-status") === state.status ? "true" : "false");
    });
  }

  function renderList() {
    var listEl = $("taskList");
    var empty = $("emptyState");
    var tasks = visibleTasks();
    listEl.innerHTML = "";
    empty.innerHTML = "";

    if (!tasks.length) {
      empty.hidden = false;
      if (!state.tasks.length) {
        empty.appendChild(el("div", { class: "empty" }, [
          el("h3", { text: "No tasks yet" }),
          el("p", { text: "Add your first assignment, exam, or reading using the form." })
        ]));
      } else {
        var clear = el("button", { class: "btn btn-ghost", type: "button", text: "Clear filters" });
        clear.addEventListener("click", clearFilters);
        empty.appendChild(el("div", { class: "empty" }, [
          el("h3", { text: "No tasks match these filters" }),
          el("p", { text: "Try a different status, priority, or search term." }),
          clear
        ]));
      }
      return;
    }
    empty.hidden = true;

    tasks.forEach(function (t) { listEl.appendChild(taskNode(t)); });
  }

  function taskNode(t) {
    var li = el("li", { class: "task" + (t.completed ? " done" : "") + (state.editingId === t.id ? " is-editing" : ""), "data-priority": t.priority, "data-id": t.id });

    var cb = el("input", { type: "checkbox", class: "check", "aria-label": (t.completed ? "Mark incomplete: " : "Mark complete: ") + t.title });
    cb.checked = t.completed;
    cb.addEventListener("change", function () { toggleTask(t.id); });

    var body = el("div", null, [el("h3", { text: t.title })]);
    if (t.description) body.appendChild(el("p", { class: "desc", text: t.description }));

    var meta = el("div", { class: "meta" });
    meta.appendChild(el("span", { class: "chip " + t.priority, text: PRIORITY_LABEL[t.priority] + " priority" }));
    var info = dueInfo(t);
    if (info) meta.appendChild(el("span", { class: "chip " + info.cls, text: info.text }));
    else meta.appendChild(el("span", { class: "chip", text: "No due date" }));
    if (t.completed) meta.appendChild(el("span", { class: "chip", text: "Completed" }));
    body.appendChild(meta);

    var edit = el("button", { class: "link-btn", type: "button", text: "Edit", "aria-label": "Edit " + t.title });
    edit.addEventListener("click", function () { startEdit(t.id); });
    var del = el("button", { class: "link-btn danger", type: "button", text: "Delete", "aria-label": "Delete " + t.title });
    del.addEventListener("click", function () { deleteTask(t.id); });
    var actions = el("div", { class: "actions" }, [edit, del]);

    li.appendChild(cb);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  /* ---------- Actions ---------- */
  function toggleTask(id) {
    state.tasks.forEach(function (t) {
      if (t.id === id) {
        t.completed = !t.completed;
        t.completedAt = t.completed ? Date.now() : null;
      }
    });
    save();
    render();
  }

  function deleteTask(id) {
    var idx = state.tasks.findIndex(function (t) { return t.id === id; });
    if (idx === -1) return;
    var removed = state.tasks.splice(idx, 1)[0];
    if (state.editingId === id) resetForm();
    save();
    render();
    showToast("Task deleted.", "Undo", function () {
      state.tasks.splice(Math.min(idx, state.tasks.length), 0, removed);
      save();
      render();
    });
  }

  function startEdit(id) {
    var t = state.tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    state.editingId = id;
    $("title").value = t.title;
    $("description").value = t.description || "";
    $("dueDate").value = t.dueDate || "";
    document.querySelector('input[name="priority"][value="' + t.priority + '"]').checked = true;
    updateCounter();
    clearError();
    $("formTitle").textContent = "Edit task";
    $("submitBtn").textContent = "Save changes";
    $("cancelBtn").hidden = false;
    $("editingNote").hidden = false;
    renderList();
    $("title").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    $("title").focus({ preventScroll: true });
  }

  function resetForm() {
    state.editingId = null;
    $("taskForm").reset();
    document.getElementById("pr-medium").checked = true;
    updateCounter();
    clearError();
    $("formTitle").textContent = "Add a task";
    $("submitBtn").textContent = "Add task";
    $("cancelBtn").hidden = true;
    $("editingNote").hidden = true;
  }

  function clearFilters() {
    state.status = "all";
    state.priority = "all";
    state.query = "";
    $("priorityFilter").value = "all";
    $("search").value = "";
    render();
  }

  /* ---------- Form ---------- */
  function showError(msg) {
    var e = $("titleError");
    e.textContent = msg;
    e.hidden = false;
    $("title").setAttribute("aria-invalid", "true");
  }
  function clearError() {
    var e = $("titleError");
    e.textContent = "";
    e.hidden = true;
    $("title").removeAttribute("aria-invalid");
  }
  function updateCounter() {
    $("descCounter").textContent = $("description").value.length + " / 300";
  }

  $("taskForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var title = $("title").value.trim();
    if (!title) {
      showError("Add a title so you can find this task later.");
      $("title").focus();
      return;
    }
    var data = {
      title: title,
      description: $("description").value.trim(),
      dueDate: $("dueDate").value,
      priority: document.querySelector('input[name="priority"]:checked').value
    };

    if (state.editingId) {
      state.tasks.forEach(function (t) {
        if (t.id === state.editingId) {
          t.title = data.title; t.description = data.description;
          t.dueDate = data.dueDate; t.priority = data.priority;
        }
      });
      resetForm();
      showToast("Changes saved.");
    } else {
      state.tasks.push({
        id: uid(), title: data.title, description: data.description, dueDate: data.dueDate,
        priority: data.priority, completed: false, createdAt: Date.now(), completedAt: null
      });
      resetForm();
      showToast("Task added.");
      $("title").focus();
    }
    save();
    render();
  });

  $("title").addEventListener("input", function () { if ($("title").value.trim()) clearError(); });
  $("description").addEventListener("input", updateCounter);
  $("cancelBtn").addEventListener("click", function () { resetForm(); renderList(); });

  /* ---------- Filters ---------- */
  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () { state.status = b.getAttribute("data-status"); render(); });
  });
  $("priorityFilter").addEventListener("change", function (e) { state.priority = e.target.value; renderList(); });
  $("sortBy").addEventListener("change", function (e) { state.sort = e.target.value; renderList(); });
  $("search").addEventListener("input", function (e) { state.query = e.target.value; renderList(); });

  /* ---------- Toast ---------- */
  function showToast(message, actionLabel, onAction) {
    var region = $("toastRegion");
    region.innerHTML = "";
    clearTimeout(toastTimer);
    var toast = el("div", { class: "toast" }, [el("span", { text: message })]);
    if (actionLabel) {
      var b = el("button", { type: "button", text: actionLabel });
      b.addEventListener("click", function () {
        clearTimeout(toastTimer);
        region.innerHTML = "";
        onAction();
      });
      toast.appendChild(b);
    }
    region.appendChild(toast);
    toastTimer = setTimeout(function () { region.innerHTML = ""; }, actionLabel ? 7000 : 2500);
  }

  /* ---------- Init ---------- */
  load();
  updateCounter();
  render();

  // Refresh overdue labels if the tab stays open past midnight.
  setInterval(function () { if (!state.editingId) render(); }, 60 * 1000);
})();
