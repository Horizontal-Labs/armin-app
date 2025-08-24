import { ref, computed, onMounted, type Ref, type ComputedRef } from 'vue'
import { z } from 'zod'

// Model type definitions
interface ModelInfo {
  id: string
  name: string
  description: string
  provider: 'local' | 'openai'
}

interface AvailableModels {
  adu_classification: ModelInfo[]
  stance_classification: ModelInfo[]
}

// Zod Schemas - now accepts any string since models are dynamic
const TextAnalysisRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  session_id: z.string(),
  adu_classifier_model: z.string().default('gpt-4.1'),
  stance_classifier_model: z.string().default('gpt-4.1'),
})

const FileAnalysisRequestSchema = z.object({
  file: z.instanceof(File),
  session_id: z.string(),
  adu_classifier_model: z.string().default('gpt-4.1'),
  stance_classifier_model: z.string().default('gpt-4.1'),
})

// Type definitions
interface ChatItem {
  id: string
  title: string
  createdAt: string
}

interface FileInfo {
  name: string
  size: number
}

interface BaseMessage {
  id: string
  timestamp: string
  type: 'user' | 'assistant'
}

interface UserMessage extends BaseMessage {
  type: 'user'
  text: string
  fileInfo: FileInfo | null
}

interface AssistantMessage extends BaseMessage {
  type: 'assistant'
  isLoading: boolean
  analysis: unknown | null
}

type Message = UserMessage | AssistantMessage

interface MessageData {
  text?: string
  file?: File
}

interface NewMessageData {
  type: 'user' | 'assistant'
  text?: string
  fileInfo?: FileInfo | null
  isLoading?: boolean
  analysis?: unknown | null
  id?: string
}

interface MessageUpdate {
  isLoading?: boolean
  analysis?: unknown
}

// Global state
const currentChatId: Ref<string | null> = ref(null)
const chatHistory: Ref<ChatItem[]> = ref([])
const messages: Ref<Map<string, Message[]>> = ref(new Map())
const isAnalyzing: Ref<boolean> = ref(false)
const error: Ref<string> = ref('')
const selectedAduModel: Ref<string> = ref('gpt-4.1')
const selectedStanceModel: Ref<string> = ref('gpt-4.1')
const availableModels: Ref<AvailableModels | null> = ref(null)
const isLoadingModels: Ref<boolean> = ref(false)

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface UseChatReturn {
  // State
  currentChatId: Ref<string | null>
  chatHistory: Ref<ChatItem[]>
  currentMessages: ComputedRef<Message[]>
  isAnalyzing: Ref<boolean>
  error: Ref<string>
  selectedAduModel: Ref<string>
  selectedStanceModel: Ref<string>
  availableModels: Ref<AvailableModels | null>
  isLoadingModels: Ref<boolean>

  // Methods
  startNewChat: () => string
  deleteChat: (chatId: string) => void
  selectChat: (chatId: string) => void
  sendMessage: (messageData: MessageData) => Promise<void>
  setAduModel: (model: string) => void
  setStanceModel: (model: string) => void
  loadData: () => void
  fetchAvailableModels: () => Promise<void>
  formatDate: (date: string | number | Date) => string
  formatTime: (date: string | number | Date) => string
}

export function useChat(): UseChatReturn {
  // Computed
  const currentMessages: ComputedRef<Message[]> = computed(() => {
    return currentChatId.value ? messages.value.get(currentChatId.value) || [] : []
  })

  // Utility functions
  const generateId = (): string => Math.random().toString(36).substr(2, 9)

  const formatDate = (date: string | number | Date): string => {
    return new Date(date).toLocaleDateString()
  }

  const formatTime = (date: string | number | Date): string => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Chat management
  const startNewChat = (): string => {
    const chatId = generateId()
    const newChat: ChatItem = {
      id: chatId,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
    }

    chatHistory.value.unshift(newChat)
    messages.value.set(chatId, [])
    currentChatId.value = chatId

    saveChatHistory()
    return chatId
  }

  const deleteChat = (chatId: string): void => {
    chatHistory.value = chatHistory.value.filter(c => c.id !== chatId)
    messages.value.delete(chatId)

    // If the deleted chat was the current one, reset currentChatId
    if (currentChatId.value === chatId) {
      currentChatId.value = null
    }

    saveChatHistory()
    saveMessages()
  }

  const selectChat = (chatId: string): void => {
    currentChatId.value = chatId
  }

  const updateChatTitle = (chatId: string, title: string): void => {
    const chat = chatHistory.value.find(c => c.id === chatId)
    if (chat) {
      chat.title = title.length > 50 ? title.substring(0, 50) + '...' : title
      saveChatHistory()
    }
  }

  // Message handling
  const addMessage = (chatId: string, message: NewMessageData): void => {
    if (!messages.value.has(chatId)) {
      messages.value.set(chatId, [])
    }

    const fullMessage: Message = {
      id: message.id || generateId(),
      timestamp: new Date().toISOString(),
      type: message.type,
      ...(message.type === 'user'
        ? {
          text: message.text || '',
          fileInfo: message.fileInfo || null
        }
        : {
          isLoading: message.isLoading || false,
          analysis: message.analysis || null
        })
    } as Message

    messages.value.get(chatId)!.push(fullMessage)
    saveMessages()
  }

  const updateMessage = (chatId: string, messageId: string, updates: MessageUpdate): void => {
    const chatMessages = messages.value.get(chatId)
    if (chatMessages) {
      const messageIndex = chatMessages.findIndex(m => m.id === messageId)
      if (messageIndex !== -1) {
        Object.assign(chatMessages[messageIndex], updates)
        saveMessages()
      }
    }
  }

  // API calls
  const sendMessage = async (messageData: MessageData): Promise<void> => {
    const { text, file } = messageData

    if (!text?.trim() && !file) return

    // Ensure we have a current chat
    if (!currentChatId.value) {
      startNewChat()
    }

    const chatId = currentChatId.value!

    // we'll need this ID later in the catch block
    let assistantMessageId: string | null = null

    try {
      error.value = ''
      isAnalyzing.value = true

      // Add user message
      const userMessage: NewMessageData = {
        type: 'user',
        text: text?.trim() || '',
        fileInfo: file ? { name: file.name, size: file.size } : null
      }

      addMessage(chatId, userMessage)

      // Update chat title if it's the first message
      const chatMessages = messages.value.get(chatId)
      if (chatMessages && chatMessages.length === 1) {
        const title = text?.trim() || file?.name || 'File Analysis'
        updateChatTitle(chatId, title)
      }

      // Add loading assistant message
      assistantMessageId = generateId()
      addMessage(chatId, {
        id: assistantMessageId,
        type: 'assistant',
        isLoading: true,
        analysis: null
      })

      let response: Response

      if (file) {
        // File analysis - Not supported by current backend
        throw new Error('File analysis is not supported by the current backend')
      } else {
        // Text analysis
        const requestData = TextAnalysisRequestSchema.parse({
          message: text!.trim(),
          session_id: chatId,
          adu_classifier_model: selectedAduModel.value,
          stance_classifier_model: selectedStanceModel.value,
        })

        console.log('Sending request to:', `${API_BASE_URL}/chat/send`)
        console.log('Request data:', requestData)

        response = await fetch(`${API_BASE_URL}/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        })

        console.log('Response status:', response.status)
        console.log('Response ok:', response.ok)
      }

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`)
      }

      const result: unknown = await response.json()
      console.log('Response data:', result)

      // Update assistant message with results
      updateMessage(chatId, assistantMessageId, {
        isLoading: false,
        analysis: result
      })

    } catch (err) {

      const friendly = 'An error has occurred, try to send a message again'

      if (err instanceof z.ZodError) {
        error.value = `Validation error: ${err.errors[0].message}`
      } else {
        error.value = err instanceof Error ? err.message : 'Failed to analyze'
      }
      console.error('Analysis error:', err)

      if (assistantMessageId !== null) {
        updateMessage(chatId, assistantMessageId, {
          isLoading: false,
          analysis: friendly
        })
      }
    } finally {
      isAnalyzing.value = false
    }
  }

  // Persistence
  const saveChatHistory = (): void => {
    try {
      localStorage.setItem('armins-chat-history', JSON.stringify(chatHistory.value))
    } catch (err) {
      console.error('Failed to save chat history:', err)
    }
  }

  const saveMessages = (): void => {
    try {
      const messagesObj = Object.fromEntries(messages.value)
      localStorage.setItem('armins-messages', JSON.stringify(messagesObj))
    } catch (err) {
      console.error('Failed to save messages:', err)
    }
  }

  const setAduModel = (model: string): void => {
    selectedAduModel.value = model
  }

  const setStanceModel = (model: string): void => {
    selectedStanceModel.value = model
  }

  const fetchAvailableModels = async (): Promise<void> => {
    try {
      isLoadingModels.value = true
      const response = await fetch(`${API_BASE_URL}/models/available`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch available models')
      }
      
      const data = await response.json()
      availableModels.value = data
      
      // Set default models if current selection is not available
      if (data.adu_classification.length > 0 && !data.adu_classification.find((m: ModelInfo) => m.id === selectedAduModel.value)) {
        // Try to find gpt-4.1 first, otherwise use the first available model
        const defaultModel = data.adu_classification.find((m: ModelInfo) => m.id === 'gpt-4.1') || data.adu_classification[0]
        selectedAduModel.value = defaultModel.id
      }
      
      if (data.stance_classification.length > 0 && !data.stance_classification.find((m: ModelInfo) => m.id === selectedStanceModel.value)) {
        // Try to find gpt-4.1 first, otherwise use the first available model
        const defaultModel = data.stance_classification.find((m: ModelInfo) => m.id === 'gpt-4.1') || data.stance_classification[0]
        selectedStanceModel.value = defaultModel.id
      }
    } catch (err) {
      console.error('Error fetching available models:', err)
      error.value = 'Failed to load available models. Using defaults.'
      
      // Fallback to hardcoded models if API fails
      availableModels.value = {
        adu_classification: [
          { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI GPT-4.1', provider: 'openai' },
          { id: 'gpt-5', name: 'GPT-5', description: 'OpenAI GPT-5', provider: 'openai' },
          { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'OpenAI GPT-5 Mini', provider: 'openai' },
          { id: 'modernbert', name: 'ModernBERT', description: 'Local BERT model', provider: 'local' },
          { id: 'tinyllama', name: 'TinyLlama', description: 'Lightweight LLM', provider: 'local' },
          { id: 'deberta', name: 'DeBERTa', description: 'Decoding-enhanced BERT', provider: 'local' }
        ],
        stance_classification: [
          { id: 'gpt-4.1', name: 'GPT-4.1', description: 'OpenAI GPT-4.1', provider: 'openai' },
          { id: 'gpt-5', name: 'GPT-5', description: 'OpenAI GPT-5', provider: 'openai' },
          { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'OpenAI GPT-5 Mini', provider: 'openai' },
          { id: 'modernbert', name: 'ModernBERT', description: 'Local BERT model', provider: 'local' },
          { id: 'tinyllama', name: 'TinyLlama', description: 'Lightweight LLM', provider: 'local' },
          { id: 'deberta', name: 'DeBERTa', description: 'Decoding-enhanced BERT', provider: 'local' }
        ]
      }
    } finally {
      isLoadingModels.value = false
    }
  }

  const loadData = (): void => {
    // Fetch available models when loading data
    fetchAvailableModels()
    
    try {
      // Load chat history
      const savedHistory = localStorage.getItem('armins-chat-history')
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory) as ChatItem[]
        chatHistory.value = parsedHistory
      }

      // Load messages
      const savedMessages = localStorage.getItem('armins-messages')
      if (savedMessages) {
        const messagesObj = JSON.parse(savedMessages) as Record<string, Message[]>
        messages.value = new Map(Object.entries(messagesObj))
      }

      // Select most recent chat if available
      if (chatHistory.value.length > 0) {
        currentChatId.value = chatHistory.value[0].id
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  return {
    // State
    currentChatId,
    chatHistory,
    currentMessages,
    isAnalyzing,
    error,
    selectedAduModel,
    selectedStanceModel,
    availableModels,
    isLoadingModels,

    // Methods
    startNewChat,
    deleteChat,
    selectChat,
    sendMessage,
    setAduModel,
    setStanceModel,
    loadData,
    fetchAvailableModels,
    formatDate,
    formatTime,
  }
}

// Export types for use in components
export type { ChatItem, Message, UserMessage, AssistantMessage, MessageData, FileInfo }
