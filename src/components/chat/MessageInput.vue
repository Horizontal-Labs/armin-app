<template>
  <div class="input-area">
    <div class="input-container" ref="inputContainer">
      <input
        ref="fileInput"
        type="file"
        accept=".pdf"
        @change="handleFileUpload"
        hidden
      />

      <button
        @click="triggerFileUpload"
        class="file-upload-button"
        :disabled="isAnalyzing"
        title="Upload PDF file"
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

    <div v-if="selectedFile" class="selected-file">
      📄 {{ selectedFile.name }}
      <button @click="clearSelectedFile" class="clear-file">✕</button>
    </div>

    <div v-if="isExtractingPdf" class="pdf-extracting">
      🔄 Extracting text from PDF...
    </div>

    <!-- Model Selection Dropdowns -->
    <div class="model-selection">
      <div class="model-group">
        <label for="adu-select" class="model-label">ADU Classifier:</label>
        <select
          id="adu-select"
          v-model="selectedAduModel"
          class="model-dropdown"
          :disabled="isAnalyzing"
        >
          <option value="openai">OpenAI</option>
          <option value="modernbert">ModernBERT</option>
          <option value="tinyllama">TinyLlama</option>
          <option value="deberta">DeBERTa</option>
        </select>
      </div>
      
      <div class="model-group">
        <label for="stance-select" class="model-label">Stance Classifier:</label>
        <select
          id="stance-select"
          v-model="selectedStanceModel"
          class="model-dropdown"
          :disabled="isAnalyzing"
        >
          <option value="openai">OpenAI</option>
          <option value="modernbert">ModernBERT</option>
          <option value="tinyllama">TinyLlama</option>
          <option value="deberta">DeBERTa</option>
        </select>
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
import { ref, computed, onMounted, nextTick } from 'vue'
import { useChat } from '@/composables/useChat'
import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Configure PDF.js worker to use local bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const textInput = ref('')
const selectedFile = ref(null)
const fileInput = ref(null)
const textarea = ref(null)
const inputContainer = ref(null)
const isExtractingPdf = ref(false)

const MIN_HEIGHT = 48
const MAX_HEIGHT = 256

const { isAnalyzing, error, sendMessage, selectedAduModel, selectedStanceModel, setAduModel, setStanceModel } = useChat()

const canSend = computed(() => {
  return textInput.value.trim() || selectedFile.value
})

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

const handlePaste = async () => {
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
    isExtractingPdf.value = true

    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Load the PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Combine text items from the page
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')

      fullText += pageText + '\n'
    }

    return fullText.trim()
  } catch (err) {
    console.error('Error extracting text from PDF:', err)
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.')
  } finally {
    isExtractingPdf.value = false
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0]
  if (file) {
    // Check if it's a PDF (fallback to extension check if type is missing)
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!isPdf) {
      error.value = 'Please select a PDF file'
      return
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      error.value = 'PDF file is too large. Please select a file smaller than 10MB.'
      return
    }

    try {
      // Extract text from PDF
      const extractedText = await extractTextFromPdf(file)

      // Check if text was extracted
      if (!extractedText || extractedText.trim().length === 0) {
        error.value = 'No text could be extracted from this PDF. The file might be image-based or corrupted.'
        return
      }

      // Set the extracted text to the textarea
      textInput.value = extractedText

      // Store the file reference for display
      selectedFile.value = file

      // Auto-resize the textarea
      await nextTick()
      autoResize()

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to extract text from PDF. Please ensure the file is a valid PDF.'
      // Clear the file input
      if (fileInput.value) {
        fileInput.value.value = ''
      }
    }
  }
}

const clearSelectedFile = () => {
  selectedFile.value = null
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

const handleSendMessage = async () => {
  if (!canSend.value || isAnalyzing.value) return

  const messageData = {
    text: textInput.value
  }

  await sendMessage(messageData)

  // Clear inputs after sending
  textInput.value = ''
  clearSelectedFile()

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
  padding: 20px;
  margin-left: 25%;
  margin-right: 25%;
  border-radius: 8px;
  background: #2d3748;
  /* border-top: 1px solid #4a5568; */
  /* background: #2d3748; */
  margin-bottom: 16px;
}

.model-selection {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 12px;
  padding: 8px 12px;
  background: #4a5568;
  border-radius: 6px;
  border: 1px solid #718096;
  flex-wrap: wrap;
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
  min-width: 120px;
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
  background: #4a5568;
  color: #e2e8f0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
  flex-shrink: 0;
  height: 48px;
}

.file-upload-button:hover:not(:disabled) {
  background: #718096;
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
  padding: 12px;
  background: #4a5568;
  border: 1px solid #718096;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  overflow-y: hidden;
  min-height: 48px;
  max-height: 256px;
  line-height: 1.4;
  transition: height 0.15s ease;
  box-sizing: border-box;
}

.text-input:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 1px #4299e1;
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
  padding: 12px;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
  flex-shrink: 0;
  height: 48px;
}

.send-button:hover:not(:disabled) {
  background: #3182ce;
}

.send-button:disabled {
  background: #4a5568;
  cursor: not-allowed;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(66, 153, 225, 0.1);
  border: 1px solid #4299e1;
  border-radius: 6px;
  font-size: 14px;
  color: #4299e1;
}

.clear-file {
  background: none;
  border: none;
  color: #4299e1;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
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

.pdf-extracting {
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
