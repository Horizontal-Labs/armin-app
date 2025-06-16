<template>
  <div class="chat-view">
    <ChatSidebar />
    <main class="main-content">
      <MessageList />
      <MessageInput />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import ChatSidebar from '@/components/chat/ChatSidebar.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import { useChat } from '@/composables/useChat'

const { loadData } = useChat()

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100vh;
  background: #1a1d23;
  color: #ffffff;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-height: 100vh;
}
</style>