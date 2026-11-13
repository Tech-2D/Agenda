// Preserve activity shares, Kanban invites, menu shortcuts and class filters.
const destination = new URL('./', document.currentScript.src)
destination.search = window.location.search
destination.hash = window.location.hash
window.location.replace(destination.href)
