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
            <ArgumentGraph :argument-data="argumentData" :model-name="message.analysis?.model || 'Unknown'" />

            <!-- Raw JSON data (collapsible) -->
            <details class="raw-data">
              <summary>View Raw Data</summary>
              <pre>{{ JSON.stringify(message.analysis, null, 2) }}</pre>
            </details>
          </div>

          <!-- Fallback for non-argument data -->
          <div v-else class="fallback-analysis">
            <pre>{{ JSON.stringify(message.analysis, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
    <div class="message-time">
      {{ formatTime(message.timestamp) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

.argument-analysis {
  width: 100%;
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

.raw-data {
  margin-top: 16px;
}

.raw-data summary {
  cursor: pointer;
  color: #a0aec0;
  font-size: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #4a5568;
}

.raw-data summary:hover {
  color: #e2e8f0;
}

.fallback-analysis {
  width: 100%;
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
