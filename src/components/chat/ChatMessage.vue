<template>
  <div :class="['message', message.type]">
    <div class="message-content">
      <div v-if="message.type === 'user'" class="user-message">
        <div v-if="message.fileInfo" class="file-info">
          📄 {{ message.fileInfo.name }}
        </div>
        <div v-if="message.text">{{ message.text }}</div>
      </div>
      
      <div v-else class="assistant-message">
        <div v-if="message.isLoading" class="loading">
          Analyzing...
        </div>
        <div v-else>
          <pre>{{ JSON.stringify(message.analysis, null, 2) }}</pre>
        </div>
      </div>
    </div>
    <div class="message-time">
      {{ formatTime(message.timestamp) }}
    </div>
  </div>
</template>

<script setup>
import { useChat } from '@/composables/useChat'

defineProps({
  message: {
    type: Object,
    required: true
  }
})

const { formatTime } = useChat()
</script>

<style scoped>
.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message.user {
  align-items: flex-end;
}

.message.assistant {
  align-items: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
}

.user-message {
  background: #4299e1;
  border : 1px solid #3182ce;
  border-radius: 12px;
  padding: 12px;
  color: white;
}

.assistant-message {
  background: #4a5568;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 12px;
  color: #e2e8f0;
}

.file-info {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.loading {
  font-style: italic;
  opacity: 0.7;
}

.assistant-message pre {
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.message-time {
  font-size: 10px;
  color: #a0aec0;
  margin: 0 16px;
}

@media (max-width: 768px) {
  .message-content {
    max-width: 85%;
  }
}
</style>