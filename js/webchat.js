// Initialize Supabase
const SUPABASE_URL = 'https://jlpwjhnqgkpfleuqrtwr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_muXiUqMw_asHxBM-EQQQHA_uhWmPgZM';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const usernameInput = document.getElementById('usernameInput');
const sendBtn = document.getElementById('sendBtn');
const errorContainer = document.getElementById('errorContainer');

let isLoading = false;

// Auto-resize textarea
messageInput.addEventListener('input', function() {
	this.style.height = 'auto';
	this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Handle Enter to send
messageInput.addEventListener('keydown', function(e) {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
	const messageText = messageInput.value.trim();
	const username = usernameInput.value.trim() || 'Anonymous';

	if (!messageText) return;
	if (isLoading) return;

	isLoading = true;
	sendBtn.disabled = true;

	try {
		// Insert message into Supabase
		const { data, error } = await supabaseClient
			.from('messages')
			.insert([
				{
					username: username,
					message: messageText,
					created_at: new Date().toISOString(),
				},
			]);

		if (error) throw error;

		// Clear input
		messageInput.value = '';
		messageInput.style.height = 'auto';
		usernameInput.value = username; // Keep username for next message

		// Add message to UI
		addMessageToUI(username, messageText, true);

	} catch (error) {
		showError(`Failed to send message: ${error.message}`);
	} finally {
		isLoading = false;
		sendBtn.disabled = false;
		messageInput.focus();
	}
}

function addMessageToUI(username, text, isUser) {
	// Remove empty state
	const emptyState = messagesContainer.querySelector('.empty-state');
	if (emptyState) emptyState.remove();

	const messageElement = document.createElement('div');
	messageElement.className = `message ${isUser ? 'user' : 'other'}`;

	const timestamp = new Date().toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});

	messageElement.innerHTML = `
		<div class="message-wrapper">
			<div class="message-content">${escapeHtml(text)}</div>
			<div class="message-timestamp">${username} • ${timestamp}</div>
		</div>
	`;

	messagesContainer.appendChild(messageElement);
	messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadMessages() {
	try {
		const { data, error } = await supabaseClient
			.from('messages')
			.select('*')
			.order('created_at', { ascending: true })
			.limit(50);

		if (error) throw error;

		messagesContainer.innerHTML = '';

		if (data && data.length === 0) {
			messagesContainer.innerHTML = `
				<div class="empty-state">
					<div class="empty-state-icon">💬</div>
					<div class="empty-state-text">
						Enter your name and start chatting. Messages are saved to Supabase.
					</div>
				</div>
			`;
		} else {
			data?.forEach((msg) => {
				addMessageToUI(msg.username, msg.message, false);
			});
		}
	} catch (error) {
		showError(`Failed to load messages: ${error.message}`);
	}
}

function subscribeToMessages() {
	const subscription = supabaseClient
		.channel('messages')
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'messages' },
			(payload) => {
				const msg = payload.new;
				addMessageToUI(msg.username, msg.message, false);
			}
		)
		.subscribe();

	return subscription;
}

function escapeHtml(text) {
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

function showError(message) {
	errorContainer.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
	setTimeout(() => {
		errorContainer.innerHTML = '';
	}, 5000);
}

// Initialize app
async function init() {
	await loadMessages();
	subscribeToMessages();
	messageInput.focus();
}

init();