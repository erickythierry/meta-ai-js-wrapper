export const chatPageHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-tertiary: #1a1a25;
            --accent-cyan: #00d4ff;
            --accent-magenta: #ff006e;
            --accent-purple: #8b5cf6;
            --text-primary: #e8e8ed;
            --text-secondary: #9898a6;
            --text-muted: #5c5c6a;
            --border-color: #2a2a3a;
            --user-gradient: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
            --ai-gradient: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
            --glow-cyan: 0 0 20px rgba(0, 212, 255, 0.3);
            --glow-purple: 0 0 20px rgba(139, 92, 246, 0.3);
        }

        body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            background-image: 
                radial-gradient(ellipse at 20% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 80%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
                linear-gradient(180deg, var(--bg-primary) 0%, #0d0d14 100%);
        }

        .container {
            max-width: 900px;
            width: 100%;
            margin: 0 auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 0;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 20px;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-icon {
            width: 42px;
            height: 42px;
            background: var(--ai-gradient);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: var(--glow-cyan);
        }

        .logo-text {
            font-size: 1.4rem;
            font-weight: 600;
            background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .new-chat-btn {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 10px 18px;
            border-radius: 10px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .new-chat-btn:hover {
            background: var(--bg-secondary);
            border-color: var(--accent-cyan);
            box-shadow: var(--glow-cyan);
        }

        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 10px 0;
            display: flex;
            flex-direction: column;
            gap: 20px;
            scrollbar-width: thin;
            scrollbar-color: var(--border-color) transparent;
        }

        .chat-container::-webkit-scrollbar {
            width: 6px;
        }

        .chat-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-container::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 3px;
        }

        .message {
            display: flex;
            gap: 14px;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            flex-direction: row-reverse;
        }

        .avatar {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }

        .message.user .avatar {
            background: var(--user-gradient);
            box-shadow: var(--glow-purple);
        }

        .message.assistant .avatar {
            background: var(--ai-gradient);
            box-shadow: var(--glow-cyan);
        }

        .message-content {
            max-width: 75%;
            padding: 14px 18px;
            border-radius: 16px;
            line-height: 1.6;
            font-size: 0.95rem;
        }

        .message.user .message-content {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-top-right-radius: 4px;
        }

        .message.assistant .message-content {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-top-left-radius: 4px;
        }

        .message-content pre {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 14px;
            overflow-x: auto;
            margin: 12px 0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
        }

        .message-content code {
            font-family: 'JetBrains Mono', monospace;
            background: var(--bg-primary);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.85rem;
            color: var(--accent-cyan);
        }

        .message-content pre code {
            background: none;
            padding: 0;
            color: var(--text-primary);
        }

        .message-content p {
            margin-bottom: 10px;
        }

        .message-content p:last-child {
            margin-bottom: 0;
        }

        .message-content ul, .message-content ol {
            margin: 10px 0;
            padding-left: 24px;
        }

        .message-content li {
            margin-bottom: 6px;
        }

        .message-content strong {
            color: var(--accent-cyan);
            font-weight: 500;
        }

        .message-content a {
            color: var(--accent-purple);
            text-decoration: none;
        }

        .message-content a:hover {
            text-decoration: underline;
        }

        .input-area {
            padding: 20px 0;
            border-top: 1px solid var(--border-color);
        }

        .input-wrapper {
            display: flex;
            gap: 12px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 8px;
            transition: all 0.2s ease;
        }

        .input-wrapper:focus-within {
            border-color: var(--accent-cyan);
            box-shadow: var(--glow-cyan);
        }

        #message-input {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 1rem;
            padding: 10px 14px;
            resize: none;
            outline: none;
            min-height: 24px;
            max-height: 150px;
        }

        #message-input::placeholder {
            color: var(--text-muted);
        }

        #send-btn {
            background: var(--ai-gradient);
            border: none;
            color: var(--bg-primary);
            width: 46px;
            height: 46px;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        #send-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: var(--glow-cyan);
        }

        #send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        #send-btn svg {
            width: 20px;
            height: 20px;
        }

        .typing-indicator {
            display: flex;
            gap: 5px;
            padding: 8px 0;
        }

        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: var(--accent-cyan);
            border-radius: 50%;
            animation: bounce 1.4s ease-in-out infinite;
        }

        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-8px); }
        }

        .empty-state {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-align: center;
            gap: 16px;
        }

        .empty-state-icon {
            font-size: 4rem;
            opacity: 0.5;
        }

        .empty-state h2 {
            font-size: 1.5rem;
            font-weight: 500;
            color: var(--text-primary);
        }

        .empty-state p {
            max-width: 400px;
            line-height: 1.6;
        }

        .error-toast {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 110, 0.1);
            border: 1px solid var(--accent-magenta);
            color: var(--accent-magenta);
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 0.9rem;
            animation: slideUp 0.3s ease;
            z-index: 100;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }

        @media (max-width: 768px) {
            .container {
                padding: 12px;
            }

            .message-content {
                max-width: 85%;
            }

            .logo-text {
                font-size: 1.1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <div class="logo-icon">🤖</div>
                <span class="logo-text">AI Chat</span>
            </div>
            <button class="new-chat-btn" onclick="newConversation()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                Nova Conversa
            </button>
        </header>

        <div class="chat-container" id="chat-container">
            <div class="empty-state" id="empty-state">
                <div class="empty-state-icon">💬</div>
                <h2>Inicie uma conversa</h2>
                <p>Digite sua mensagem abaixo para começar a conversar com a Meta AI</p>
            </div>
        </div>

        <div class="input-area">
            <div class="input-wrapper">
                <textarea 
                    id="message-input" 
                    placeholder="Digite sua mensagem..." 
                    rows="1"
                    onkeydown="handleKeyDown(event)"
                ></textarea>
                <button id="send-btn" onclick="sendMessage()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>

    <script>
        const chatContainer = document.getElementById('chat-container');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const emptyState = document.getElementById('empty-state');
        let isLoading = false;

        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });

        function handleKeyDown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatMessage(text) {
            if (!text) return '';
            let formatted = escapeHtml(text);
            const bt = String.fromCharCode(96);
            formatted = formatted.replace(new RegExp(bt+bt+bt+'([\\\\s\\\\S]*?)'+bt+bt+bt, 'g'), '<pre><code>$1</code></pre>');
            formatted = formatted.replace(new RegExp(bt+'([^'+bt+']+)'+bt, 'g'), '<code>$1</code>');
            formatted = formatted.replace(/[*][*]([^*]+)[*][*]/g, '<strong>$1</strong>');
            formatted = formatted.replace(/\\n/g, '<br>');
            return formatted;
        }

        function addMessage(content, role) {
            if (emptyState) emptyState.remove();

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + role;

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = role === 'user' ? '👤' : '🤖';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = formatMessage(content);

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            return messageDiv;
        }

        function addTypingIndicator() {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageDiv.id = 'typing-indicator';

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = '🤖';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

            messageDiv.appendChild(avatar);
            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function removeTypingIndicator() {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) indicator.remove();
        }

        function showError(message) {
            const existingToast = document.querySelector('.error-toast');
            if (existingToast) existingToast.remove();

            const toast = document.createElement('div');
            toast.className = 'error-toast';
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || isLoading) return;

            isLoading = true;
            sendBtn.disabled = true;

            addMessage(message, 'user');
            messageInput.value = '';
            messageInput.style.height = 'auto';
            addTypingIndicator();

            try {
                const response = await fetch('/api/prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });

                const data = await response.json();
                removeTypingIndicator();

                if (data.success && data.data && data.data.message) {
                    addMessage(data.data.message, 'assistant');
                } else {
                    showError(data.error || 'Erro ao obter resposta');
                }
            } catch (error) {
                removeTypingIndicator();
                showError('Erro de conexão com o servidor');
                console.error('Error:', error);
            } finally {
                isLoading = false;
                sendBtn.disabled = false;
                messageInput.focus();
            }
        }

        async function newConversation() {
            try {
                await fetch('/api/new-conversation', { method: 'POST' });
                chatContainer.innerHTML = '';
                
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-state';
                emptyDiv.id = 'empty-state';
                emptyDiv.innerHTML = \`
                    <div class="empty-state-icon">💬</div>
                    <h2>Inicie uma conversa</h2>
                    <p>Digite sua mensagem abaixo para começar a conversar com a Meta AI</p>
                \`;
                chatContainer.appendChild(emptyDiv);
            } catch (error) {
                showError('Erro ao iniciar nova conversa');
            }
        }

        messageInput.focus();
    </script>
</body>
</html>`;
