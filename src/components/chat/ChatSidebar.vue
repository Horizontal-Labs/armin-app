<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <img src="@/assets/armins-logo.png" alt="Logo" class="logo" />
      <h2>Chat History</h2>
      <button @click="startNewChat" class="new-chat-button">
        + New Chat
      </button>
    </div>
    
    <div class="chat-list">
      <div
        v-for="chat in chatHistory"
        :key="chat.id"
        :class="['chat-item', { active: chat.id === currentChatId }]"
        @click="selectChat(chat.id)"
      >
        <div class="chat-info">
          <div class="chat-title">{{ chat.title }}</div>
          <div class="chat-date">{{ formatDate(chat.createdAt) }}</div>
        </div>
        <button
          class="delete-chat-button"
          @click.stop="deleteChat(chat.id)"
          aria-label="Delete chat"
        >
          🗑️
        </button>
      </div>
      
      <div v-if="chatHistory.length === 0" class="empty-state">
        No previous chats
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useChat } from '@/composables/useChat'

const {
  currentChatId,
  chatHistory,
  startNewChat,
  selectChat,
  deleteChat,
  formatDate
} = useChat()
</script>

<style scoped>
.sidebar {
  width: 300px;
  background: #2d3748;
  border-right: 1px solid #4a5568;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #4a5568;
  display: flex;
  flex-direction: column;
}

.sidebar-header .logo {
  width: 80px;
  height: auto;
  margin-bottom: 16px;
}

.sidebar-header h2 {
  margin: 0 0 16px 0;
  font-size: 1.2rem;
  color: #ffffff;
}

.new-chat-button {
  width: 100%;
  padding: 10px;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.new-chat-button:hover {
  background: #3182ce;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.chat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.2s;
}

.chat-item:hover {
  background: rgba(66, 153, 225, 0.1);
}

.chat-item.active {
  background: rgba(66, 153, 225, 0.2);
  border: 1px solid #4299e1;
}

.chat-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.chat-title {
  font-weight: 500;
  margin-bottom: 4px;
  color: #e2e8f0;
}

.chat-date {
  font-size: 12px;
  color: #a0aec0;
}

.delete-chat-button {
  background: rgba(0, 68, 255, 0.479);
  border: 1px solid #718096;      /* lighter slate gray */
  border-radius: 6px;
  font-size: 1rem;
  padding: 4px;
  cursor: pointer;
  color: #718096;
  transition: color 0.2s;
}

.delete-chat-button:hover {
  border-color: #E53E3E;           
  color: #E53E3E;
  background: rgba(229, 62, 62, 0.5);
}

.empty-state {
  text-align: center;
  color: #a0aec0;
  padding: 40px 20px;
  font-style: italic;
}

@media (max-width: 768px) {
  .sidebar {
    width: 250px;
  }
}
</style>
