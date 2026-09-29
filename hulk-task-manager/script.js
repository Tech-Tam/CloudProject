const API_BASE_URL = 'https://xl9ct8a3n5.execute-api.us-east-1.amazonaws.com/Production/hulk';

let allTasks = [];
let autoRefreshInterval = null;
let hulkState = 'idle';

// Hulk animation controller
class HulkAnimator {
    constructor() {
        this.hulkCharacter = document.getElementById('hulkCharacter');
        this.hulkEmoji = document.getElementById('hulkEmoji');
        this.hulkMouth = document.getElementById('hulkMouth');
        this.hulkArms = document.getElementById('hulkArms');
        this.hulkSpeech = document.getElementById('hulkSpeech');
        this.operationIndicator = document.getElementById('operationIndicator');
        this.indicatorLight = document.getElementById('indicatorLight');
        this.operationText = document.getElementById('operationText');
        
        // Emoji states for different operations
        this.emojiStates = {
            idle: '🟢',
            creating: '💪',
            reading: '👀',
            updating: '✏️',
            deleting: '💥'
        };
        
        this.mouthStates = {
            idle: '😐',
            creating: '😤',
            reading: '😊',
            updating: '😐',
            deleting: '😡'
        };
    }

    showOperation(operation, message) {
        // Remove previous states
        this.hulkCharacter.parentElement.className = 'hulk-container';
        
        // Add new state
        this.hulkCharacter.parentElement.classList.add(`hulk-${operation}`);
        
        // Update emoji and expressions
        if (this.emojiStates[operation]) {
            this.hulkEmoji.textContent = this.emojiStates[operation];
        }
        
        if (this.mouthStates[operation]) {
            this.hulkMouth.textContent = this.mouthStates[operation];
        }
        
        // Update speech bubble
        this.hulkSpeech.textContent = message;
        
        // Update operation indicator
        this.operationText.textContent = this.getOperationText(operation);
        this.indicatorLight.style.background = this.getOperationColor(operation);
        
        // Add screen shake effect for dramatic operations
        if (operation === 'deleting' || operation === 'creating') {
            document.body.style.animation = 'screenShake 0.5s ease-in-out';
            setTimeout(() => {
                document.body.style.animation = '';
            }, 500);
        }
        
        // Reset after animation
        setTimeout(() => {
            this.resetToIdle();
        }, 2000);
    }

    getOperationText(operation) {
        const texts = {
            'creating': 'HULK CREATING TASK! 💪',
            'reading': 'HULK READING TASKS! 👀',
            'updating': 'HULK UPDATING TASK! ✏️',
            'deleting': 'HULK SMASHING TASK! 💥'
        };
        return texts[operation] || 'HULK READY!';
    }

    getOperationColor(operation) {
        const colors = {
            'creating': '#4CAF50',
            'reading': '#2196F3',
            'updating': '#FF9800',
            'deleting': '#f44336'
        };
        return colors[operation] || '#4CAF50';
    }

    resetToIdle() {
        this.hulkCharacter.parentElement.className = 'hulk-container';
        
        // Reset to idle state
        this.hulkEmoji.textContent = this.emojiStates.idle;
        this.hulkMouth.textContent = this.mouthStates.idle;
        
        this.hulkSpeech.textContent = 'HULK READY TO SMASH TASKS! 💪';
        this.operationText.textContent = 'Ready for Action';
        this.indicatorLight.style.background = '#4CAF50';
    }

    celebrate(message) {
        this.hulkSpeech.textContent = message;
        this.hulkCharacter.style.animation = 'hulkHappy 1s ease-in-out';
        setTimeout(() => {
            this.hulkCharacter.style.animation = 'hulkIdle 3s ease-in-out infinite';
        }, 1000);
    }

    showError(message) {
        this.hulkSpeech.textContent = message;
        this.hulkCharacter.parentElement.classList.add('hulk-deleting');
        setTimeout(() => {
            this.resetToIdle();
        }, 2000);
    }
}

let hulkAnimator;

// Escape text before putting it into innerHTML, so a task name like
// <img src=x onerror=alert(1)> is shown as text instead of running (XSS protection).
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

// Initialize app
window.addEventListener('DOMContentLoaded', function() {
    hulkAnimator = new HulkAnimator();
    const apiCode = document.querySelector('.api-info code');
    if (apiCode) apiCode.textContent = API_BASE_URL;
    checkApiStatus();
    getAllItems();
    setupEventListeners();
    
    // Initial Hulk greeting
    setTimeout(() => {
        hulkAnimator.celebrate('HULK READY FOR CRUD OPERATIONS! 🚀');
    }, 1000);
});

function setupEventListeners() {
    // Auto-save on input changes
    document.getElementById('createName').addEventListener('input', debounce(validateForm, 300));
    
    // Enter key shortcuts
    document.getElementById('createName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') createItem();
    });
    
    document.getElementById('updateId').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') updateItem();
    });
    
    document.getElementById('deleteId').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') deleteItem();
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function validateForm() {
    const name = document.getElementById('createName').value;
    const button = document.querySelector('.btn-primary');
    
    if (name.length > 0) {
        button.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        button.disabled = false;
    } else {
        button.style.background = '#ccc';
        button.disabled = true;
    }
}

async function checkApiStatus() {
    const statusDot = document.getElementById('apiStatus');
    const statusText = document.getElementById('apiStatusText');
    
    try {
        const response = await fetch(API_BASE_URL, { method: 'GET' });
        if (response.ok) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'API Connected';
        } else {
            throw new Error('API Error');
        }
    } catch (error) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'API Disconnected';
    }
}

function displayResponse(data, isError = false) {
    const responseContent = document.getElementById('responseContent');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${JSON.stringify(data, null, 2)}\n\n`;
    
    responseContent.textContent = logEntry + responseContent.textContent;
    responseContent.className = isError ? 'error' : 'success';
    
    // Limit log size
    const lines = responseContent.textContent.split('\n');
    if (lines.length > 100) {
        responseContent.textContent = lines.slice(0, 100).join('\n');
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = isError ? 'toast error show' : 'toast show';
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function createItem() {
    const name = document.getElementById('createName').value;
    const completed = document.getElementById('createCompleted').checked;
    const priority = document.getElementById('createPriority').value;

    if (!name.trim()) {
        showToast('Task name is required!', true);
        hulkAnimator.showError('HULK NEED TASK NAME! 😡');
        return;
    }

    // Show Hulk creating animation
    hulkAnimator.showOperation('creating', 'HULK CREATING NEW TASK! 💪');

    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), completed, priority })
        });

        const data = await response.json();
        displayResponse(data, !response.ok);

        if (response.ok) {
            document.getElementById('createName').value = '';
            document.getElementById('createCompleted').checked = false;
            document.getElementById('createPriority').value = 'low';
            
            showToast('Task created successfully! 🎉');
            hulkAnimator.celebrate('HULK SMASHED NEW TASK INTO EXISTENCE! 🎉');
            getAllItems();
        } else {
            showToast('Failed to create task', true);
            hulkAnimator.showError('HULK FAILED TO CREATE! 😡');
        }
    } catch (error) {
        displayResponse({ error: 'Network error: ' + error.message }, true);
        showToast('Network error occurred', true);
    }
}

async function getAllItems() {
    // Show Hulk reading animation
    hulkAnimator.showOperation('reading', 'HULK READING ALL TASKS! 👀');
    
    try {
        const response = await fetch(API_BASE_URL, { method: 'GET' });
        const data = await response.json();
        
        displayResponse(data, !response.ok);
        
        allTasks = Array.isArray(data) ? data : (data.items || []);
        renderTasks(allTasks);
        updateStats();
        updateProgress();
        
        checkApiStatus();
        hulkAnimator.celebrate(`HULK FOUND ${allTasks.length} TASKS! 📊`);
    } catch (error) {
        displayResponse({ error: 'Network error: ' + error.message }, true);
        showToast('Failed to fetch tasks', true);
        hulkAnimator.showError('HULK CANNOT READ TASKS! 😡');
    }
}

function renderTasks(tasks) {
    const resultArea = document.getElementById('allItemsResult');
    resultArea.innerHTML = '';
    
    if (tasks.length === 0) {
        resultArea.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No tasks found</p></div>';
        return;
    }

    tasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `item-card ${task.completed ? 'completed' : ''}`;
        
        const safePriority = ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'low';
        const priorityClass = `priority-${safePriority}`;
        const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
        
        taskCard.innerHTML = `
            <div class="priority-badge ${priorityClass}">${priorityIcon} ${safePriority.toUpperCase()}</div>
            <div class="item-id">ID: ${escapeHtml(task.id)}</div>
            <div class="task-name"><strong>${escapeHtml(task.name)}</strong></div>
            <div class="task-status">
                <i class="fas ${task.completed ? 'fa-check-circle' : 'fa-clock'}"></i>
                ${task.completed ? '✅ Completed' : '⏳ Pending'}
            </div>
            <div class="task-actions">
                <button data-action="toggle" class="btn-small">
                    <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                    ${task.completed ? 'Undo' : 'Complete'}
                </button>
                <button data-action="delete" class="btn-small" style="background: #f44336;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        taskCard.querySelector('[data-action="toggle"]')
            .addEventListener('click', () => quickToggle(task.id, !task.completed));
        taskCard.querySelector('[data-action="delete"]')
            .addEventListener('click', () => quickDelete(task.id));

        resultArea.appendChild(taskCard);
    });
}

async function quickToggle(id, completed) {
    hulkAnimator.showOperation('updating', `HULK ${completed ? 'COMPLETING' : 'REOPENING'} TASK! ✏️`);
    
    try {
        const task = allTasks.find(t => t.id === id);
        const response = await fetch(API_BASE_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name: task.name, completed })
        });

        if (response.ok) {
            showToast(`Task ${completed ? 'completed' : 'reopened'}! 🎯`);
            hulkAnimator.celebrate(`HULK ${completed ? 'COMPLETED' : 'REOPENED'} TASK! 🎯`);
            getAllItems();
        }
    } catch (error) {
        showToast('Failed to update task', true);
        hulkAnimator.showError('HULK FAILED TO TOGGLE! 😡');
    }
}

async function quickDelete(id) {
    if (!confirm('Delete this task?')) return;
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });

        if (response.ok) {
            showToast('Task deleted! 🗑️');
            getAllItems();
        }
    } catch (error) {
        showToast('Failed to delete task', true);
    }
}

function updateStats() {
    const total = allTasks.length;
    const completed = allTasks.filter(task => task.completed).length;
    const pending = total - completed;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
}

function updateProgress() {
    const total = allTasks.length;
    const completed = allTasks.filter(task => task.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressText').textContent = percentage + '% Complete';
}

function filterTasks() {
    const searchTerm = document.getElementById('searchTasks').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    
    let filteredTasks = allTasks.filter(task => {
        const matchesSearch = task.name.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'completed' && task.completed) ||
                            (statusFilter === 'pending' && !task.completed);
        
        return matchesSearch && matchesStatus;
    });
    
    renderTasks(filteredTasks);
}

async function updateItem() {
    const id = document.getElementById('updateId').value;
    const name = document.getElementById('updateName').value;
    const completed = document.getElementById('updateCompleted').checked;
    const priority = document.getElementById('updatePriority').value;

    if (!id.trim()) {
        showToast('Task ID is required!', true);
        hulkAnimator.showError('HULK NEED TASK ID! 😡');
        return;
    }

    if (!name.trim()) {
        showToast('Task name is required!', true);
        hulkAnimator.showError('HULK NEED TASK NAME! 😡');
        return;
    }

    // Show Hulk updating animation
    hulkAnimator.showOperation('updating', 'HULK UPDATING TASK! ✏️');

    try {
        const response = await fetch(API_BASE_URL, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id.trim(), name: name.trim(), completed, priority })
        });

        const data = await response.json();
        displayResponse(data, !response.ok);

        if (response.ok) {
            document.getElementById('updateId').value = '';
            document.getElementById('updateName').value = '';
            document.getElementById('updateCompleted').checked = false;
            document.getElementById('updatePriority').value = 'low';
            
            showToast('Task updated successfully! ✏️');
            hulkAnimator.celebrate('HULK UPDATED TASK SUCCESSFULLY! ✏️');
            getAllItems();
        } else {
            showToast('Failed to update task', true);
            hulkAnimator.showError('HULK FAILED TO UPDATE! 😡');
        }
    } catch (error) {
        displayResponse({ error: 'Network error: ' + error.message }, true);
        showToast('Network error occurred', true);
    }
}

async function deleteItem() {
    const id = document.getElementById('deleteId').value;

    if (!id.trim()) {
        showToast('Task ID is required!', true);
        return;
    }

    if (!confirm(`Are you sure you want to delete task: ${id}?`)) return;

    try {
        const response = await fetch(API_BASE_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id.trim() })
        });

        const data = await response.json();
        displayResponse(data, !response.ok);

        if (response.ok) {
            document.getElementById('deleteId').value = '';
            showToast('Task deleted successfully! 🗑️');
            hulkAnimator.celebrate('HULK SMASHED TASK! 💥');
            getAllItems();
        } else {
            showToast('Failed to delete task', true);
            hulkAnimator.showError('HULK FAILED TO SMASH! 😡');
        }
    } catch (error) {
        displayResponse({ error: 'Network error: ' + error.message }, true);
        showToast('Network error occurred', true);
    }
}

async function clearAllCompleted() {
    const completedTasks = allTasks.filter(task => task.completed);
    
    if (completedTasks.length === 0) {
        showToast('No completed tasks to clear', true);
        hulkAnimator.showError('HULK FIND NO COMPLETED TASKS! 😡');
        return;
    }
    
    if (!confirm(`Delete ${completedTasks.length} completed tasks?`)) return;
    
    hulkAnimator.showOperation('deleting', `HULK SMASHING ${completedTasks.length} COMPLETED TASKS! 💥`);
    
    for (const task of completedTasks) {
        try {
            await fetch(API_BASE_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: task.id })
            });
        } catch (error) {
            console.error('Failed to delete task:', task.id);
        }
    }
    
    showToast(`Cleared ${completedTasks.length} completed tasks! 🧹`);
    hulkAnimator.celebrate(`HULK CLEARED ${completedTasks.length} TASKS! 🧹`);
    getAllItems();
}

function exportTasks() {
    const dataStr = JSON.stringify(allTasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `hulk-tasks-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Tasks exported successfully! 📁');
}

function clearLog() {
    document.getElementById('responseContent').textContent = 'Log cleared...';
}

function toggleAutoRefresh() {
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        btn.innerHTML = '<i class="fas fa-play"></i> Auto Refresh';
        btn.style.background = '#6c757d';
        showToast('Auto refresh disabled');
    } else {
        autoRefreshInterval = setInterval(getAllItems, 10000); // 10 seconds
        btn.innerHTML = '<i class="fas fa-pause"></i> Stop Refresh';
        btn.style.background = '#28a745';
        showToast('Auto refresh enabled (10s)');
    }
}