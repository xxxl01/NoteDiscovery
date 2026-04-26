window.NoteDiscoveryAI = {
    createMethods() {
        return {
            async sendAiMessage() {
                const message = this.aiPrompt.trim();
                if (!message || this.aiLoading || !this.aiEnabled) return;

                this.aiError = '';
                this.aiMessages.push({ role: 'user', content: message });
                this.aiPrompt = '';
                this.aiLoading = true;
                this.scrollAiToBottom();

                try {
                    const response = await fetch('/api/ai/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message,
                            messages: this.aiMessages.slice(-8, -1),
                            note_path: this.currentNote || '',
                            note_content: this.currentNote ? this.noteContent : '',
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.detail || 'AI chat request failed');
                    }

                    this.aiMessages.push({
                        role: 'assistant',
                        content: data.reply || ''
                    });
                } catch (error) {
                    console.error('AI chat failed:', error);
                    this.aiError = error.message || 'AI chat request failed';
                    this.aiMessages.push({
                        role: 'assistant',
                        content: this.t('ai.error_reply')
                    });
                } finally {
                    this.aiLoading = false;
                    this.scrollAiToBottom();
                }
            },

            clearAiChat() {
                this.aiMessages = [];
                this.aiError = '';
            },

            scrollAiToBottom() {
                this.$nextTick(() => {
                    const container = document.getElementById('ai-messages');
                    if (container) {
                        container.scrollTop = container.scrollHeight;
                    }
                });
            },
        };
    }
};
