import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { z } from 'zod'
import { createChatHistoryStorage } from '@/services/chatHistoryStorage'

// Model type definitions
interface ModelInfo {
  id: string
  name: string
  description: string
  provider: 'local' | 'openai'
  supports_few_shot?: boolean
  disabled?: boolean
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
  use_few_shot_adu: z.boolean().default(false),
  use_few_shot_stance: z.boolean().default(false),
  use_few_shot: z.boolean().optional(),
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
const useFewShot: Ref<boolean> = ref(false) // legacy combined flag (not used by UI)
const useFewShotAdu: Ref<boolean> = ref(false)
const useFewShotStance: Ref<boolean> = ref(false)

const chatHistoryStorage = createChatHistoryStorage()

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Error handling helpers
const NETWORK_ERROR_REGEX = /NetworkError|Failed to fetch|Load failed|ECONNREFUSED|ERR_NETWORK|Network request failed/i

const isLikelyNetworkError = (err: unknown): boolean => {
  try {
    // If the browser reports offline, treat as network error immediately
    if (typeof navigator !== 'undefined' && navigator && 'onLine' in navigator && navigator.onLine === false) {
      return true
    }
  } catch (_) {
    // no-op
  }

  const message = (err as any)?.message ?? ''
  if (typeof message === 'string' && NETWORK_ERROR_REGEX.test(message)) return true

  // Fetch network failures often bubble as TypeError without status
  return err instanceof TypeError
}

const mapStatusToMessage = (status: number, statusText = ''): string => {
  if (status >= 500) return 'Service is temporarily unavailable. Please try again soon.'
  if (status === 429) return 'Too many requests. Please wait and retry.'
  if (status === 404) return 'Service endpoint not found.'
  if (status === 401 || status === 403) return 'You are not authorized to perform this action.'
  if (status >= 400) return 'Request failed. Please check your input and try again.'
  return statusText || 'Request failed.'
}

const toFriendlyError = (err: unknown): string => {
  if (isLikelyNetworkError(err)) {
    return 'Service is unavailable. Ensure the backend is running and reachable.'
  }
  if (err instanceof z.ZodError) {
    return `Validation error: ${err.errors[0]?.message ?? 'Invalid input'}`
  }
  if (err instanceof Error) {
    return err.message || 'Something went wrong'
  }
  return 'Something went wrong'
}

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
  useFewShot: Ref<boolean>
  useFewShotAdu: Ref<boolean>
  useFewShotStance: Ref<boolean>

  // Few-shot support
  canUseFewShotAdu: ComputedRef<boolean>
  canUseFewShotStance: ComputedRef<boolean>

  // Methods
  startNewChat: () => Promise<string>
  deleteChat: (chatId: string) => Promise<void>
  selectChat: (chatId: string) => void
  sendMessage: (messageData: MessageData) => Promise<void>
  setAduModel: (model: string) => void
  setStanceModel: (model: string) => void
  setUseFewShot: (val: boolean) => void
  setUseFewShotAdu: (val: boolean) => void
  setUseFewShotStance: (val: boolean) => void
  loadData: () => Promise<void>
  fetchAvailableModels: () => Promise<void>
  formatDate: (date: string | number | Date) => string
  formatTime: (date: string | number | Date) => string
}

export function useChat(): UseChatReturn {
  // Computed
  const currentMessages: ComputedRef<Message[]> = computed(() => {
    return currentChatId.value ? messages.value.get(currentChatId.value) || [] : []
  })

  const canUseFewShotAdu: ComputedRef<boolean> = computed(() => {
    const models = availableModels.value?.adu_classification || []
    const model = models.find(m => m.id === selectedAduModel.value)
    return !!model?.supports_few_shot
  })

  const canUseFewShotStance: ComputedRef<boolean> = computed(() => {
    const models = availableModels.value?.stance_classification || []
    const model = models.find(m => m.id === selectedStanceModel.value)
    return !!model?.supports_few_shot
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
  const startNewChat = async (): Promise<string> => {
    const chatId = generateId()
    const newChat: ChatItem = {
      id: chatId,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
    }

    chatHistory.value.unshift(newChat)
    messages.value.set(chatId, [])
    currentChatId.value = chatId

    await saveChatHistory()
    return chatId
  }

  const deleteChat = async (chatId: string): Promise<void> => {
    chatHistory.value = chatHistory.value.filter(c => c.id !== chatId)
    messages.value.delete(chatId)

    // If the deleted chat was the current one, reset currentChatId
    if (currentChatId.value === chatId) {
      currentChatId.value = null
    }

    try {
      await chatHistoryStorage.deleteChat(chatId, chatHistory.value)
    } catch (err) {
      console.error('Failed to delete chat history entry:', err)
    }

    saveMessages()
  }

  const selectChat = (chatId: string): void => {
    currentChatId.value = chatId
  }

  const updateChatTitle = async (chatId: string, title: string): Promise<void> => {
    const chat = chatHistory.value.find(c => c.id === chatId)
    if (chat) {
      chat.title = title.length > 50 ? title.substring(0, 50) + '...' : title
      await saveChatHistory()
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
    let chatId = currentChatId.value
    if (!chatId) {
      chatId = await startNewChat()
    }

    if (!chatId) {
      return
    }

    const activeChatId = chatId

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

      addMessage(activeChatId, userMessage)

      // Update chat title if it's the first message
      const chatMessages = messages.value.get(activeChatId)
      if (chatMessages && chatMessages.length === 1) {
        const title = text?.trim() || file?.name || 'File Analysis'
        await updateChatTitle(activeChatId, title)
      }

      // Add loading assistant message
      assistantMessageId = generateId()
      addMessage(activeChatId, {
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
        const rawRequest = {
          message: text!.trim(),
          session_id: activeChatId,
          adu_classifier_model: selectedAduModel.value,
          stance_classifier_model: selectedStanceModel.value,
          use_few_shot_adu: useFewShotAdu.value,
          use_few_shot_stance: useFewShotStance.value,
          // include legacy flag only when both are enabled, otherwise omit
          ...(useFewShotAdu.value && useFewShotStance.value ? { use_few_shot: true } : {}),
        }

        const requestData = TextAnalysisRequestSchema.parse(rawRequest)

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
        let message = mapStatusToMessage(response.status, response.statusText)
        const contentType = response.headers.get('content-type') || ''

        try {
          if (contentType.includes('application/json')) {
            const errorPayload = await response.json() as { detail?: unknown; message?: unknown }
            const detail = typeof errorPayload?.detail === 'string' ? errorPayload.detail : undefined
            const fallbackDetail = typeof errorPayload?.message === 'string' ? errorPayload.message : undefined
            const combined = detail || fallbackDetail
            if (combined && combined.trim()) {
              message = combined.trim()
            }
          } else {
            const text = await response.text()
            if (text && text.trim()) {
              message = text.trim()
            }
          }
        } catch (parseErr) {
          console.warn('Failed to parse error response:', parseErr)
        }

        throw new Error(message)
      }

      const result: unknown = await response.json()
      console.log('Response data:', result)

      // Update assistant message with results
      updateMessage(activeChatId, assistantMessageId, {
        isLoading: false,
        analysis: result
      })

    } catch (err) {
      const friendly = toFriendlyError(err)
      error.value = friendly
      console.error('Analysis error:', err)

      if (assistantMessageId !== null) {
        updateMessage(activeChatId, assistantMessageId, {
          isLoading: false,
          analysis: friendly
        })
      }
    } finally {
      isAnalyzing.value = false
    }
  }

  // Persistence
  const saveChatHistory = async (): Promise<void> => {
    try {
      await chatHistoryStorage.saveChatHistory(chatHistory.value)
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
    // Prevent selecting disabled models defensively
    const models = availableModels.value?.adu_classification || []
    const found = models.find(m => m.id === model)
    if (found && !found.disabled) {
      selectedAduModel.value = model
    }
  }

  const setStanceModel = (model: string): void => {
    // Prevent selecting disabled models defensively
    const models = availableModels.value?.stance_classification || []
    const found = models.find(m => m.id === model)
    if (found && !found.disabled) {
      selectedStanceModel.value = model
    }
  }

  const setUseFewShot = (val: boolean): void => {
    useFewShot.value = !!val
  }

  const setUseFewShotAdu = (val: boolean): void => {
    useFewShotAdu.value = !!val
  }

  const setUseFewShotStance = (val: boolean): void => {
    useFewShotStance.value = !!val
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
      
      // Ensure selections are valid and enabled; choose enabled defaults when needed
      const pickEnabledDefault = (models: ModelInfo[]): ModelInfo | undefined => {
        const enabled = models.filter(m => !m.disabled)
        if (enabled.length === 0) return undefined
        return enabled.find(m => m.id === 'gpt-4.1') || enabled[0]
      }

      if (data.adu_classification.length > 0) {
        const currentAdu = data.adu_classification.find((m: ModelInfo) => m.id === selectedAduModel.value)
        if (!currentAdu || currentAdu.disabled) {
          const defaultModel = pickEnabledDefault(data.adu_classification)
          if (defaultModel) selectedAduModel.value = defaultModel.id
        }
      }

      if (data.stance_classification.length > 0) {
        const currentStance = data.stance_classification.find((m: ModelInfo) => m.id === selectedStanceModel.value)
        if (!currentStance || currentStance.disabled) {
          const defaultModel = pickEnabledDefault(data.stance_classification)
          if (defaultModel) selectedStanceModel.value = defaultModel.id
        }
      }
    } catch (err) {
      console.error('Error fetching available models:', err)
      error.value = isLikelyNetworkError(err)
        ? 'Backend unreachable. Is the backend running?'
        : 'Failed to load available models. Using defaults.'
      
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

  const loadData = async (): Promise<void> => {
    await fetchAvailableModels()
    
    try {
      // Load chat history
      const savedHistory = await chatHistoryStorage.getChatHistory()
      chatHistory.value = savedHistory

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
    useFewShot,
    useFewShotAdu,
    useFewShotStance,
    canUseFewShotAdu,
    canUseFewShotStance,

    // Methods
    startNewChat,
    deleteChat,
    selectChat,
    sendMessage,
    setAduModel,
    setStanceModel,
    setUseFewShot,
    setUseFewShotAdu,
    setUseFewShotStance,
    loadData,
    fetchAvailableModels,
    formatDate,
    formatTime,
  }
}

// Export types for use in components
export type { ChatItem, Message, UserMessage, AssistantMessage, MessageData, FileInfo }
