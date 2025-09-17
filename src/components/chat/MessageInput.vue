<template>
  <div class="input-area">
    <div class="input-container" ref="inputContainer">
      <input
        ref="fileInput"
        type="file"
        multiple
        accept=".pdf,.txt,text/plain"
        @change="handleFileUpload"
        hidden
      />

      <button
        @click="triggerFileUpload"
        class="file-upload-button"
        :disabled="isAnalyzing"
        title="Upload PDF or TXT file"
      >
        📎
      </button>

      <div class="textarea-wrapper">
        <textarea
          ref="textarea"
          v-model="textInput"
          @keydown.enter.exact.prevent="handleSendMessage"
          @keydown.enter.shift.exact="insertNewLine"
          @input="autoResize"
          @keyup="autoResize"
          @paste="handlePaste"
          placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
          class="text-input"
          rows="1"
          :disabled="isAnalyzing"
        />
      </div>

      <button
        @click="handleSendMessage"
        :disabled="!canSend || isAnalyzing"
        class="send-button"
      >
        {{ isAnalyzing ? '⏳' : '➡️' }}
      </button>
    </div>

    <div v-if="attachments.length > 0" class="attachments">
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="attachment-card"
      >
        <div class="attachment-header">
          <span class="attachment-title">📄 {{ attachment.name }}</span>
          <button
            @click="removeAttachment(attachment.id)"
            class="remove-attachment"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
        <textarea
          v-model="attachment.content"
          class="attachment-content"
          rows="4"
        ></textarea>
      </div>
    </div>

    <div v-if="isExtractingFile" class="file-extracting">
      🔄 Extracting text from file...
    </div>

    <!-- Model Selection Dropdowns -->
  <div class="model-selection">
    <div class="model-group">
      <label for="adu-select" class="model-label">ADU Identifier + Classifier:</label>
      <select
        id="adu-select"
        v-model="selectedAduModel"
        class="model-dropdown"
        :disabled="isAnalyzing || isLoadingModels"
        :title="getModelDescription('adu', selectedAduModel)"
        @change="setAduModel($event.target.value)"
      >
          <option v-if="isLoadingModels" disabled>Loading models...</option>
          <template v-else-if="availableModels?.adu_classification">
            <optgroup v-for="provider in groupedAduModels" :key="provider.name" :label="provider.name">
              <option 
                v-for="model in provider.models" 
                :key="model.id" 
                :value="model.id"
                :title="model.description"
                :disabled="!!model.disabled"
              >
                {{ model.name }}
              </option>
            </optgroup>
          </template>
          <template v-else>
            <option value="gpt-4.1">GPT-4.1</option>
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
            <option value="modernbert">ModernBERT</option>
            <option value="tinyllama">TinyLlama</option>
            <option value="deberta">DeBERTa</option>
          </template>
        </select>
        <label v-if="canUseFewShotAdu" class="fewshot-toggle" :title="fewShotTooltip">
          <input
            type="checkbox"
            :checked="useFewShotAdu"
            :disabled="isAnalyzing || isLoadingModels"
            @change="setUseFewShotAdu($event.target.checked)"
          />
          Few-shot
        </label>
    </div>
    
    <div class="model-group">
      <label for="stance-select" class="model-label">Stance Classifier:</label>
      <select
        id="stance-select"
        v-model="selectedStanceModel"
        class="model-dropdown"
        :disabled="isAnalyzing || isLoadingModels"
        :title="getModelDescription('stance', selectedStanceModel)"
        @change="setStanceModel($event.target.value)"
      >
          <option v-if="isLoadingModels" disabled>Loading models...</option>
          <template v-else-if="availableModels?.stance_classification">
            <optgroup v-for="provider in groupedStanceModels" :key="provider.name" :label="provider.name">
              <option 
                v-for="model in provider.models" 
                :key="model.id" 
                :value="model.id"
                :title="model.description"
                :disabled="!!model.disabled"
              >
                {{ model.name }}
              </option>
            </optgroup>
          </template>
          <template v-else>
            <option value="gpt-4.1">GPT-4.1</option>
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
            <option value="modernbert">ModernBERT</option>
            <option value="tinyllama">TinyLlama</option>
            <option value="deberta">DeBERTa</option>
          </template>
        </select>
        <label v-if="canUseFewShotStance" class="fewshot-toggle" :title="fewShotTooltip">
          <input
            type="checkbox"
            :checked="useFewShotStance"
            :disabled="isAnalyzing || isLoadingModels"
            @change="setUseFewShotStance($event.target.checked)"
          />
          Few-shot
        </label>
    </div>
  </div>

    <div v-if="error" class="error-message">
        <span class="error-text">{{ error }}</span>
  <button
    @click="clearErrorMessage"
    class="dismiss-error-button"
    aria-label="Dismiss error"
  >
    ✕
  </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useChat } from '@/composables/useChat'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Configure PDF.js worker to use local bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const textInput = ref('')
const attachments = ref([])
const fileInput = ref(null)
const textarea = ref(null)
const inputContainer = ref(null)
const isExtractingFile = ref(false)

const MIN_HEIGHT = 48
const MAX_HEIGHT = 256
const ATTACHMENT_SIZE_LIMIT = 10 * 1024 * 1024

const createAttachmentId = () => Math.random().toString(36).slice(2, 11)

const { 
  isAnalyzing, 
  error, 
  sendMessage, 
  selectedAduModel, 
  selectedStanceModel, 
  setAduModel, 
  setStanceModel,
  availableModels,
  isLoadingModels,
  fetchAvailableModels,
  useFewShotAdu,
  useFewShotStance,
  setUseFewShotAdu,
  setUseFewShotStance,
  canUseFewShotAdu,
  canUseFewShotStance
} = useChat()

const canSend = computed(() => {
  const hasManualText = textInput.value.trim().length > 0
  const hasAttachmentContent = attachments.value.some(attachment => attachment.content.trim().length > 0)
  return hasManualText || hasAttachmentContent
})

// Group models by provider
const groupedAduModels = computed(() => {
  if (!availableModels.value?.adu_classification) return []
  
  const openaiModels = availableModels.value.adu_classification.filter(m => m.provider === 'openai')
  const localModels = availableModels.value.adu_classification.filter(m => m.provider === 'local')
  
  const groups = []
  if (openaiModels.length > 0) {
    groups.push({ name: 'OpenAI Models', models: openaiModels })
  }
  if (localModels.length > 0) {
    groups.push({ name: 'Local Models', models: localModels })
  }
  
  return groups
})

const groupedStanceModels = computed(() => {
  if (!availableModels.value?.stance_classification) return []
  
  const openaiModels = availableModels.value.stance_classification.filter(m => m.provider === 'openai')
  const localModels = availableModels.value.stance_classification.filter(m => m.provider === 'local')
  
  const groups = []
  if (openaiModels.length > 0) {
    groups.push({ name: 'OpenAI Models', models: openaiModels })
  }
  if (localModels.length > 0) {
    groups.push({ name: 'Local Models', models: localModels })
  }
  
  return groups
})

// Get model description for tooltip
const getModelDescription = (type, modelId) => {
  if (!availableModels.value || !modelId) return ''
  
  const models = type === 'adu' 
    ? availableModels.value.adu_classification 
    : availableModels.value.stance_classification
    
  const model = models?.find(m => m.id === modelId)
  return model?.description || ''
}

const fewShotTooltip = 'Include small example prompts when supported.'

const autoResize = async () => {
  await nextTick()
  if (!textarea.value || !inputContainer.value) return

  const element = textarea.value
  const container = inputContainer.value

  // Reset height to get accurate scrollHeight
  element.style.height = `${MIN_HEIGHT}px`

  // Handle empty text case
  if (!textInput.value.trim()) {
    element.style.height = `${MIN_HEIGHT}px`
    element.style.overflowY = 'hidden'
    container.style.marginTop = '0px'
    return
  }

  const scrollHeight = element.scrollHeight
  const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT)

  // Calculate how much to move up (difference from minimum height)
  const heightDifference = newHeight - MIN_HEIGHT

  // Set the new height
  element.style.height = `${newHeight}px`

  // Move the entire input container up by the height difference
  container.style.marginTop = `-${heightDifference}px`

  // Enable/disable scrolling based on content
  if (scrollHeight > MAX_HEIGHT) {
    element.style.overflowY = 'auto'
    // Scroll to bottom when content exceeds max height
    element.scrollTop = element.scrollHeight
  } else {
    element.style.overflowY = 'hidden'
  }
}

const handlePaste = async (event) => {
  // Get the pasted text
  const clipboardData = event.clipboardData || window.clipboardData
  const pastedText = clipboardData.getData('text/plain')
  
  // If there's pasted content with line breaks, preserve them
  if (pastedText && pastedText.includes('\n')) {
    event.preventDefault()
    
    // Get current cursor position
    const start = event.target.selectionStart
    const end = event.target.selectionEnd
    const currentValue = textInput.value
    
    // Insert pasted text at cursor position
    textInput.value = currentValue.substring(0, start) + pastedText + currentValue.substring(end)
    
    // Set cursor position after pasted text
    await nextTick()
    event.target.setSelectionRange(start + pastedText.length, start + pastedText.length)
  }
  
  // Small delay to let paste content be processed
  await new Promise(resolve => setTimeout(resolve, 10))
  autoResize()
}

const insertNewLine = () => {
  const cursorPos = textarea.value.selectionStart
  const textBefore = textInput.value.substring(0, cursorPos)
  const textAfter = textInput.value.substring(cursorPos)
  textInput.value = textBefore + '\n' + textAfter

  nextTick(() => {
    textarea.value.setSelectionRange(cursorPos + 1, cursorPos + 1)
    autoResize()
  })
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const extractTextFromPdf = async (file) => {
  try {
    isExtractingFile.value = true

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Combine text items from the page with better formatting
      let pageText = ''
      let lastY = null
      let lastX = null
      
      textContent.items.forEach((item, index) => {
        // Check if this item is on a new line based on Y position
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
          pageText += '\n'
        } else if (lastX !== null && item.transform[4] - lastX > 10) {
          // Add space for items far apart horizontally
          pageText += ' '
        }
        
        pageText += item.str
        
        lastY = item.transform[5]
        lastX = item.transform[4] + (item.width || 0)
      })
      
      // Clean up formatting
      pageText = pageText
        .replace(/  +/g, ' ') // Remove multiple spaces
        .replace(/\n\s*\n\s*\n+/g, '\n\n') // Max 2 line breaks
        .trim()
      
      if (pageText) {
        fullText += pageText + '\n\n' // Add double line break between pages
      }
    }

    return fullText.trim()
  } catch (err) {
    console.error('Error extracting text from PDF:', err)
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.')
  } finally {
    isExtractingFile.value = false
  }
}

const extractTextFromTxt = async (file) => {
  try {
    isExtractingFile.value = true
    const text = await file.text()
    return text.trim()
  } catch (err) {
    console.error('Error reading text file:', err)
    throw new Error('Failed to read the text file. Please ensure it is a valid UTF-8 encoded .txt file.')
  } finally {
    isExtractingFile.value = false
  }
}

const addAttachment = (file, content, type) => {
  attachments.value.push({
    id: createAttachmentId(),
    name: file.name,
    size: file.size,
    type,
    content: content.trim(),
  })
}

const handleFileUpload = async (event) => {
  const fileList = event.target.files ? Array.from(event.target.files) : []
  if (fileList.length === 0) {
    return
  }

  for (const file of fileList) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    const isText = file.type === 'text/plain' || /\.txt$/i.test(file.name)

    if (!isPdf && !isText) {
      error.value = `Unsupported file "${file.name}". Please select a PDF or plain text (.txt) file.`
      continue
    }

    if (file.size > ATTACHMENT_SIZE_LIMIT) {
      error.value = `"${file.name}" is too large. Please select a file smaller than 10MB.`
      continue
    }

    try {
      const extractedText = isPdf
        ? await extractTextFromPdf(file)
        : await extractTextFromTxt(file)

      if (!extractedText || extractedText.trim().length === 0) {
        error.value = isPdf
          ? `No text could be extracted from "${file.name}". The file might be image-based or corrupted.`
          : `"${file.name}" appears to be empty.`
        continue
      }

      addAttachment(file, extractedText, isPdf ? 'pdf' : 'txt')
    } catch (err) {
      const fallbackMessage = isPdf
        ? `Failed to extract text from "${file.name}". Please ensure it is a valid PDF.`
        : `Failed to read "${file.name}". Please ensure it is a UTF-8 encoded .txt file.`
      error.value = err instanceof Error ? err.message : fallbackMessage
    }
  }

  if (fileInput.value) {
    fileInput.value.value = ''
  }
}


const removeAttachment = (attachmentId) => {
  attachments.value = attachments.value.filter(attachment => attachment.id !== attachmentId)
}

const clearAttachments = () => {
  attachments.value = []
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}


const resetTextarea = () => {
  if (textarea.value && inputContainer.value) {
    textarea.value.style.height = `${MIN_HEIGHT}px`
    textarea.value.style.overflowY = 'hidden'
    inputContainer.value.style.marginTop = '0px'
  }
}


const buildMessageText = () => {
  const segments = []
  const manual = textInput.value.trim()
  if (manual.length > 0) {
    segments.push(manual)
  }

  attachments.value.forEach(attachment => {
    const body = attachment.content.trim()
    if (body.length === 0) {
      return
    }

    const header = `File (${attachment.type.toUpperCase()}): ${attachment.name}`
    segments.push(`${header}\n${body}`)
  })

  return segments.join('\n\n').trim()
}



const handleSendMessage = async () => {
  if (!canSend.value || isAnalyzing.value) return

  const messageText = buildMessageText()
  if (!messageText) {
    return
  }

  await sendMessage({
    text: messageText
  })

  textInput.value = ''
  clearAttachments()

  // Reset textarea to minimum size
  resetTextarea()
}

const clearErrorMessage = () => {
  error.value = null
}

onMounted(() => {
  resetTextarea()
})
</script>

<style scoped>
.input-area {
  padding: 24px 20px;
  margin-left: 25%;
  margin-right: 25%;
  border-radius: 12px 12px 0 0;
  background: linear-gradient(to bottom, #374151, #2d3748);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(74, 85, 104, 0.5);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3), 
              0 -2px 10px rgba(0, 0, 0, 0.2);
  position: sticky;
  bottom: 0;
  z-index: 10;
  margin-top: 20px;
}

.model-selection {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 12px;
  padding: 10px 14px;
  background: rgba(45, 55, 72, 0.6);
  backdrop-filter: blur(5px);
  border-radius: 8px;
  border: 1px solid rgba(113, 128, 150, 0.3);
  flex-wrap: wrap;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.model-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-label {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.model-dropdown {
  background: #2d3748;
  color: #ffffff;
  border: 1px solid #718096;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 14px;
  cursor: pointer;
  min-width: 150px;
}

.model-dropdown optgroup {
  background: #1a202c;
  color: #a0aec0;
  font-weight: 600;
  font-size: 12px;
}

.model-dropdown option {
  background: #2d3748;
  color: #ffffff;
  padding: 4px 8px;
}

.model-dropdown option:disabled {
  color: #a0aec0;
  opacity: 0.6;
}

.model-dropdown option:hover {
  background: #4a5568;
}

.model-dropdown:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 1px #4299e1;
}

.model-dropdown:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-container {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  transition: margin-top 0.15s ease;
}

.file-upload-button {
  padding: 12px;
  background: #2d3748;
  color: #e2e8f0;
  border: 2px solid #4a5568;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  flex-shrink: 0;
  height: 52px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.file-upload-button:hover:not(:disabled) {
  background: #374151;
  border-color: #718096;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.file-upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea-wrapper {
  flex: 1;
}

.text-input {
  width: 100%;
  padding: 14px 16px;
  background: #1a202c;
  border: 2px solid #4a5568;
  border-radius: 10px;
  color: #ffffff;
  font-size: 15px;
  font-family: inherit;
  resize: none;
  overflow-y: hidden;
  min-height: 48px;
  max-height: 256px;
  line-height: 1.5;
  transition: all 0.2s ease;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-wrap: break-word;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.text-input:focus {
  outline: none;
  border-color: #4299e1;
  background: #1e2633;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15),
              inset 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.text-input::placeholder {
  color: #a0aec0;
}

.text-input::-webkit-scrollbar {
  width: 6px;
}

.text-input::-webkit-scrollbar-track {
  background: transparent;
}

.text-input::-webkit-scrollbar-thumb {
  background: #718096;
  border-radius: 3px;
}

.text-input::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

.send-button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #4299e1, #3182ce);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
  flex-shrink: 0;
  height: 52px;
  box-shadow: 0 2px 8px rgba(66, 153, 225, 0.3);
}

.send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #3182ce, #2c5aa0);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 153, 225, 0.4);
}

.send-button:disabled {
  background: #4a5568;
  cursor: not-allowed;
}

.attachments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.attachment-card {
  background: rgba(66, 153, 225, 0.08);
  border: 1px solid #4299e1;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #e2e8f0;
  font-weight: 500;
}

.attachment-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.remove-attachment {
  background: none;
  border: none;
  color: #f56565;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  transition: background 0.2s;
}

.remove-attachment:hover {
  background: rgba(245, 101, 101, 0.15);
}

.attachment-content {
  width: 100%;
  background: #1a202c;
  border: 1px solid #4a5568;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 120px;
  line-height: 1.4;
}

.error-message {
  position: relative;
  margin-top: 8px;
  padding: 12px 16px;
  padding-left: 48px;
  background: rgba(229, 62, 62, 0.2);
  border: 1px solid #e53e3e;
  border-radius: 6px;
  color: #feb2b2;
  font-size: 14px;
}

.dismiss-error-button {
  position: absolute;
  top: -10px;                     /* distance from top of the box */
  left: -10px;                    /* distance from left of the box */
  width: 24px;                  /* square button */
  height: 24px;
  padding: 0;                   /* no extra padding */
  border: none;
  border-radius: 50%;           /* make it a circle */
  background: rgba(229, 62, 62, 0.7);  /* <-- alpha = 0.5 for 50% opacity */
  color: white;                 /* white “×” */
  font-size: 16px;              /* big enough to see */
  line-height: 1;               /* center the “×” vertically */
  display: flex;                /* center both axes */
  align-items: center;
  justify-content: center;
  cursor: pointer;
}


.dismiss-error-button:hover {
  color: #c53030;
}

.file-extracting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid #ffc107;
  border-radius: 6px;
  font-size: 14px;
  color: #ffc107;
}

@media (max-width: 768px) {
  .input-container {
    flex-direction: column;
    align-items: stretch;
  }

  .file-upload-button,
  .send-button {
    order: 1;
    height: auto;
  }

  .textarea-wrapper {
    order: 0;
  }
}
</style>
