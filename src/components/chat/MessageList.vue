<template>
  <div class="messages" ref="messagesContainer">
    <ChatMessage
      v-for="message in currentMessages"
      :key="message.id"
      :message="message"
    />
    
    <div v-if="currentMessages.length === 0" class="empty-chat">
      Start a conversation by typing a message or uploading a file. Share discussion content only; extra prompts or instructions will be treated as part of the debate.
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import ChatMessage from './ChatMessage.vue'
import { useChat } from '@/composables/useChat'

const messagesContainer = ref(null)
const { currentMessages } = useChat()

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Scroll to bottom when messages change
watch(currentMessages, scrollToBottom, { deep: true })
</script>

<style scoped>
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scroll-behavior: smooth;
}

.empty-chat {
  text-align: center;
  color: #a0aec0;
  padding: 60px 20px;
  font-style: italic;
}
</style>