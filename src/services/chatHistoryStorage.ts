import type { ChatItem } from '@/composables/useChat'

export interface ChatHistoryStorage {
  getChatHistory(): Promise<ChatItem[]>
  saveChatHistory(history: ChatItem[]): Promise<void>
  deleteChat(chatId: string, nextHistory?: ChatItem[]): Promise<void>
}

const CHAT_HISTORY_STORAGE_KEY = 'armins-chat-history'

const hasBrowserStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readFromLocalStorage = (): ChatItem[] => {
  if (!hasBrowserStorage()) return []

  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to read chat history from local storage:', error)
    return []
  }
}

class LocalStorageChatHistoryStorage implements ChatHistoryStorage {
  async getChatHistory(): Promise<ChatItem[]> {
    return readFromLocalStorage()
  }

  async saveChatHistory(history: ChatItem[]): Promise<void> {
    if (!hasBrowserStorage()) return

    try {
      window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Failed to save chat history to local storage:', error)
    }
  }

  async deleteChat(chatId: string, nextHistory?: ChatItem[]): Promise<void> {
    const updatedHistory = nextHistory ?? readFromLocalStorage().filter(chat => chat.id !== chatId)
    await this.saveChatHistory(updatedHistory)
  }
}

export const createChatHistoryStorage = (): ChatHistoryStorage => new LocalStorageChatHistoryStorage()
