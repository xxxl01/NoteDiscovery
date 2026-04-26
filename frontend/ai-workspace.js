const { createApp, computed, onMounted, ref } = Vue;

createApp({
    setup() {
        const notes = ref([]);
        const allFolders = ref([]);
        const loadingNotes = ref(true);
        const noteSearch = ref('');
        const selectedPaths = ref([]);
        const expandedPaths = ref([]);
        const messages = ref([]);
        const input = ref('');
        const sending = ref(false);
        const error = ref('');
        const aiModelLabel = ref('AI');
        const workspaceMode = ref('chat');
        const lastCapturePath = ref('');

        const quickPrompts = [
            { label: '总结笔记', prompt: '整理一下这个markdown，这个它来自 和 ai 的对话，你要做的是，总结概括，去除对话感觉；关键点提炼，不要太啰嗦；标题只能使用 ### 及以下等级的标题' },
            { label: '合并笔记', prompt: '在已经整理好的笔记基础上，把我的输入合并到笔记中，保持原有结构和格式不变。标题只能使用 ### 及以下等级的标题' },
        ];

        const folderTree = computed(() => buildFolderTree(notes.value, allFolders.value));

        const filteredNotes = computed(() => {
            const query = noteSearch.value.trim().toLowerCase();
            const allNotes = notes.value.filter(note => (note.type || 'note') === 'note' && note.path?.endsWith('.md'));

            if (!query) {
                return allNotes.slice(0, 200);
            }

            return allNotes
                .filter(note => {
                    const name = String(note.name || '').toLowerCase();
                    const path = String(note.path || '').toLowerCase();
                    return name.includes(query) || path.includes(query);
                })
                .slice(0, 200);
        });

        const rootNotes = computed(() => folderTree.value.__root__?.notes || []);
        const topLevelFolders = computed(() =>
            Object.entries(folderTree.value)
                .filter(([key]) => key !== '__root__')
                .map(([, folder]) => folder)
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        );
        const visibleTreeItems = computed(() => flattenVisibleTree(folderTree.value, expandedPaths.value));
        const selectedCount = computed(() => (selectedPaths.value || []).length);
        const filteredNotesCount = computed(() => (filteredNotes.value || []).length);
        const messageCount = computed(() => (messages.value || []).length);
        const showEmptyTree = computed(() =>
            (rootNotes.value || []).length === 0 && (topLevelFolders.value || []).length === 0
        );

        function buildFolderTree(noteItems, folderPaths) {
            const tree = {};
            const markdownNotes = noteItems.filter(note => (note.type || 'note') === 'note' && note.path?.endsWith('.md'));

            folderPaths.forEach(folderPath => {
                const parts = String(folderPath || '').split('/').filter(Boolean);
                let current = tree;

                parts.forEach((part, index) => {
                    const fullPath = parts.slice(0, index + 1).join('/');
                    if (!current[part]) {
                        current[part] = {
                            name: part,
                            path: fullPath,
                            children: {},
                            notes: [],
                            noteCount: 0,
                        };
                    }
                    current = current[part].children;
                });
            });

            markdownNotes.forEach(note => {
                if (!note.folder) {
                    if (!tree.__root__) {
                        tree.__root__ = { name: '', path: '', children: {}, notes: [], noteCount: 0 };
                    }
                    tree.__root__.notes.push(note);
                    return;
                }

                const parts = String(note.folder).split('/').filter(Boolean);
                let current = tree;
                for (let i = 0; i < parts.length; i += 1) {
                    if (!current[parts[i]]) {
                        current[parts[i]] = {
                            name: parts[i],
                            path: parts.slice(0, i + 1).join('/'),
                            children: {},
                            notes: [],
                            noteCount: 0,
                        };
                    }

                    if (i === parts.length - 1) {
                        current[parts[i]].notes.push(note);
                    } else {
                        current = current[parts[i]].children;
                    }
                }
            });

            function sortAndCount(node) {
                node.notes = [...(node.notes || [])].sort((a, b) =>
                    String(a.name || a.path).toLowerCase().localeCompare(String(b.name || b.path).toLowerCase())
                );

                let total = node.notes.length;
                Object.values(node.children || {}).forEach(child => {
                    total += sortAndCount(child);
                });
                node.noteCount = total;
                return total;
            }

            if (!tree.__root__) {
                tree.__root__ = { name: '', path: '', children: {}, notes: [], noteCount: 0 };
            }

            tree.__root__.notes = [...tree.__root__.notes].sort((a, b) =>
                String(a.name || a.path).toLowerCase().localeCompare(String(b.name || b.path).toLowerCase())
            );

            Object.values(tree)
                .filter(folder => folder && folder.path !== '')
                .forEach(sortAndCount);

            return tree;
        }

        function flattenVisibleTree(tree, expanded) {
            const items = [];
            const expandedSet = new Set(expanded || []);

            const pushNotes = (noteList, level) => {
                (noteList || []).forEach(note => {
                    items.push({
                        key: `note:${note.path}`,
                        kind: 'note',
                        level,
                        path: note.path,
                        name: note.name,
                    });
                });
            };

            const walkFolder = (folder, level) => {
                const isExpanded = expandedSet.has(folder.path);
                items.push({
                    key: `folder:${folder.path}`,
                    kind: 'folder',
                    level,
                    path: folder.path,
                    name: folder.name,
                    expanded: isExpanded,
                    noteCount: folder.noteCount || 0,
                });

                if (!isExpanded) {
                    return;
                }

                pushNotes(folder.notes, level + 1);

                Object.values(folder.children || {})
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                    .forEach(child => walkFolder(child, level + 1));
            };

            pushNotes(tree.__root__?.notes || [], 0);

            Object.entries(tree)
                .filter(([key]) => key !== '__root__')
                .map(([, folder]) => folder)
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                .forEach(folder => walkFolder(folder, 0));

            return items;
        }

        function noteLabel(path) {
            return path.split('/').pop().replace(/\.md$/i, '');
        }

        function toggleNote(path) {
            if (selectedPaths.value.includes(path)) {
                selectedPaths.value = selectedPaths.value.filter(item => item !== path);
                return;
            }
            selectedPaths.value = [...selectedPaths.value, path];
        }

        function clearSelectedNotes() {
            selectedPaths.value = [];
        }

        function toggleFolder(path) {
            if (expandedPaths.value.includes(path)) {
                expandedPaths.value = expandedPaths.value.filter(item => item !== path);
                return;
            }

            expandedPaths.value = [...expandedPaths.value, path];
        }

        function selectTopFilteredNotes() {
            const nextPaths = filteredNotes.value.slice(0, 5).map(note => note.path);
            selectedPaths.value = Array.from(new Set([...selectedPaths.value, ...nextPaths]));
        }

        function applyQuickPrompt(prompt) {
            input.value = prompt + (input.value ? `\n\n${input.value}` : '');
        }

        function clearMessages() {
            messages.value = [];
            error.value = '';
            if (workspaceMode.value === 'capture') {
                lastCapturePath.value = '';
            }
        }

        async function loadConfig() {
            try {
                const response = await fetch('/api/config');
                const data = await response.json();
                aiModelLabel.value = data.ai?.model || 'AI';
            } catch (_err) {
                aiModelLabel.value = 'AI';
            }
        }

        async function loadNotes() {
            loadingNotes.value = true;
            error.value = '';
            try {
                const data = await window.NoteDiscoveryNotesApi.fetchNotesIndex();
                notes.value = data.notes || [];
                allFolders.value = data.folders || [];
                expandedPaths.value = (data.folders || [])
                    .filter(path => !String(path).includes('/'))
                    .slice(0, 12);
            } catch (err) {
                error.value = err.message || '加载笔记失败';
                notes.value = [];
                allFolders.value = [];
                expandedPaths.value = [];
            } finally {
                loadingNotes.value = false;
            }
        }

        async function refreshNotesIndex() {
            await loadNotes();
        }

        async function captureToInbox() {
            const content = input.value.trim();
            if (!content || sending.value) return;

            error.value = '';
            sending.value = true;

            try {
                const response = await fetch('/api/inbox/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ content }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || '暂存失败');
                }

                input.value = '';
                lastCapturePath.value = data.path || '';
            } catch (err) {
                error.value = err.message || '暂存失败';
            } finally {
                sending.value = false;
            }
        }

        async function sendMessage() {
            if (workspaceMode.value === 'capture') {
                await captureToInbox();
                return;
            }

            const message = input.value.trim();
            if (!message || sending.value) return;

            error.value = '';
            messages.value.push({ role: 'user', content: message });
            input.value = '';
            sending.value = true;

            try {
                const response = await fetch('/api/ai/workspace-chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        messages: messages.value.slice(-8, -1),
                        note_paths: selectedPaths.value,
                    }),
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || 'AI 请求失败');
                }

                messages.value.push({
                    role: 'assistant',
                    content: data.reply || '',
                });
            } catch (err) {
                error.value = err.message || 'AI 请求失败';
                messages.value.push({
                    role: 'assistant',
                    content: '当前请求失败了，请稍后再试。',
                });
            } finally {
                sending.value = false;
            }
        }

        onMounted(async () => {
            await Promise.all([loadConfig(), loadNotes()]);
        });

        return {
            aiModelLabel,
            clearMessages,
            clearSelectedNotes,
            error,
            filteredNotes,
            input,
            loadingNotes,
            messages,
            noteLabel,
            noteSearch,
            rootNotes,
            quickPrompts,
            expandedPaths,
            filteredNotesCount,
            messageCount,
            selectedPaths,
            selectedCount,
            selectTopFilteredNotes,
            sendMessage,
            sending,
            showEmptyTree,
            refreshNotesIndex,
            toggleFolder,
            toggleNote,
            topLevelFolders,
            visibleTreeItems,
            workspaceMode,
            lastCapturePath,
            applyQuickPrompt,
        };
    },
}).mount('#ai-workspace');
