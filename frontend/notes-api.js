window.NoteDiscoveryNotesApi = {
    async fetchNotesIndex() {
        const response = await fetch('/api/notes', {
            credentials: 'same-origin',
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to load notes');
        }

        return data;
    }
};
