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
          <!-- Display argument data if available -->
          <div v-if="argumentData" class="argument-analysis">
            <div class="analysis-summary">
              <h4>Argument Analysis Results</h4>
              <div class="summary-stats">
                <span class="stat">
                  <strong>{{ argumentData.claims.length }}</strong> Claims
                </span>
                <span class="stat">
                  <strong>{{ argumentData.premises.length }}</strong> Premises
                </span>
              </div>
            </div>

            <!-- Argument Graph -->
            <ArgumentGraph 
              :argument-data="argumentData" 
              :adu-model="message.analysis?.adu_classifier_model || message.analysis?.model || 'Unknown'"
              :stance-model="message.analysis?.stance_classifier_model || message.analysis?.model || 'Unknown'" 
            />

            <!-- Raw JSON data (collapsible) -->
            <div class="raw-data-container">
              <details class="raw-data">
                <summary>View Raw Data</summary>
                <pre>{{ JSON.stringify(message.analysis, null, 2) }}</pre>
              </details>
              <button 
                @click="copyToClipboard(JSON.stringify(message.analysis, null, 2))"
                class="copy-button raw-copy"
                title="Copy raw data"
              >
                {{ copiedText === JSON.stringify(message.analysis, null, 2) ? '✓' : '📋' }}
              </button>
            </div>
          </div>

          <!-- Fallback for non-argument data -->
          <div v-else class="fallback-analysis">
            <pre>{{ JSON.stringify(message.analysis, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
    <div class="message-footer">
      <div class="message-time">
        {{ formatTime(message.timestamp) }}
      </div>
      <button 
        v-if="message.type === 'user' && message.text"
        @click="copyToClipboard(message.text)"
        class="copy-button-footer"
        title="Copy to clipboard"
      >
        {{ copiedText === message.text ? '✓' : '📋' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChat } from '@/composables/useChat'
import ArgumentGraph from './ArgumentGraph.vue'

interface ArgumentUnit {
  id: string
  text: string
}

interface StanceRelation {
  claim_id: string
  premise_id: string
  stance: string
}

interface ArgumentData {
  original_text: string
  claims: ArgumentUnit[]
  premises: ArgumentUnit[]
  stance_relations: StanceRelation[]
}

interface Props {
  message: {
    type: 'user' | 'assistant'
    text?: string
    fileInfo?: { name: string; size: number } | null
    isLoading?: boolean
    analysis?: any
    timestamp: string
  }
}

const props = defineProps<Props>()

const { formatTime } = useChat()

// Copy functionality
const copiedText = ref<string | null>(null)

const copyToClipboard = async (text: string) => {
  if (!text) return
  
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = text
    
    // Reset after 2 seconds
    setTimeout(() => {
      copiedText.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text:', err)
  }
}

// Parse argument data from the analysis
const argumentData = computed<ArgumentData | null>(() => {
  if (!props.message.analysis || typeof props.message.analysis !== 'object') {
    console.log('No analysis data or not an object:', props.message.analysis)
    return null
  }

  // Check if the analysis has the expected structure
  const analysis = props.message.analysis
  console.log('Parsing analysis:', analysis)

  if (analysis.output &&
      Array.isArray(analysis.output.claims) &&
      Array.isArray(analysis.output.premises) &&
      Array.isArray(analysis.output.stance_relations)) {
    console.log('Found argument data in output:', analysis.output)
    return analysis.output
  }

  // Alternative: check if the analysis itself has the structure
  if (Array.isArray(analysis.claims) &&
      Array.isArray(analysis.premises) &&
      Array.isArray(analysis.stance_relations)) {
    console.log('Found argument data directly:', analysis)
    return analysis
  }

  console.log('No valid argument data structure found')
  return null
})
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
  max-width: 90%;
  width: 90%;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.user-message {
  background: #4299e1;
  border : 1px solid #3182ce;
  border-radius: 12px;
  padding: 16px 20px;
  color: white;
  white-space: pre-wrap;
  word-break: break-word;
  position: relative;
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px;
}

.copy-button-footer {
  background: rgba(66, 153, 225, 0.15);
  border: 1px solid rgba(66, 153, 225, 0.3);
  border-radius: 6px;
  color: #a0aec0;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 26px;
}

.copy-button-footer:hover {
  background: rgba(66, 153, 225, 0.25);
  border-color: rgba(66, 153, 225, 0.4);
  color: #e2e8f0;
}

.copy-button-footer:active {
  transform: scale(0.95);
}

.assistant-message {
  background: #4a5568;
  border: 1px solid #2d3748;
  border-radius: 12px;
  padding: 16px 20px;
  color: #e2e8f0;
  width: 100%;
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

.argument-analysis {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.analysis-summary {
  margin-bottom: 16px;
  padding: 12px;
  background: #2d3748;
  border-radius: 8px;
  border: 1px solid #4a5568;
}

.analysis-summary h4 {
  margin: 0 0 8px 0;
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
}

.summary-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.stat {
  color: #a0aec0;
  font-size: 12px;
}

.stat strong {
  color: #4299e1;
  font-weight: 600;
}

.raw-data-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.raw-data {
  width: auto;
}

.raw-data summary {
  cursor: pointer;
  color: #a0aec0;
  font-size: 12px;
  padding: 8px 12px;
  border: 1px solid #4a5568;
  border-radius: 6px;
  background: rgba(74, 85, 104, 0.3);
  transition: all 0.2s;
  display: inline-block;
}

.raw-data summary:hover {
  background: rgba(74, 85, 104, 0.5);
  border-color: #718096;
}

.raw-copy {
  background: rgba(66, 153, 225, 0.2);
  border: 1px solid rgba(66, 153, 225, 0.3);
  border-radius: 6px;
  color: #a0aec0;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 26px;
  flex-shrink: 0;
}

.raw-copy:hover {
  background: rgba(66, 153, 225, 0.3);
  border-color: rgba(66, 153, 225, 0.4);
  color: #e2e8f0;
}

.raw-data summary:hover {
  color: #e2e8f0;
}

.raw-data pre {
  margin-top: 12px;
}

.fallback-analysis {
  width: 100%;
}

.message-time {
  font-size: 10px;
  color: #a0aec0;
}

@media (max-width: 768px) {
  .message-content {
    max-width: 95%;
    width: 95%;
  }
}
</style>
