# Argument Mining Frontend - Changes Documentation

## Overview
This document tracks all changes made to the armin-app repository during the setup and development process, focusing on the two main features implemented: model selection dropdown and Cytoscape graph visualization.

## Initial Setup Changes

### 1. Dependencies
**File:** `package.json`
**Changes Made:**
```bash
npm install cytoscape
```
**Purpose:** Added Cytoscape.js for graph visualization functionality

## Feature 1: Model Selection Dropdown

### 1. API Configuration
**File:** `src/composables/useChat.ts`
**Changes Made:**
```typescript
// Updated API base URL
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Added selectedModel state
const selectedModel: Ref<'modernbert' | 'openai' | 'tinyllama'> = ref('openai')

// Updated request schema
const TextAnalysisRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  session_id: z.string(),
  model: z.enum(['modernbert', 'openai', 'tinyllama']).default('openai'),
})

// Added setModel function
const setModel = (model: 'modernbert' | 'openai' | 'tinyllama'): void => {
  selectedModel.value = model
}

// Updated sendMessage to use correct field names
const requestData = TextAnalysisRequestSchema.parse({
  message: text!.trim(),
  session_id: chatId,
  model: selectedModel.value,
})
```

### 2. UI Component
**File:** `src/components/chat/MessageInput.vue`
**Changes Made:**
```vue
<template>
  <!-- Added model selection dropdown -->
  <div class="model-selection">
    <label class="model-label">Model:</label>
    <select 
      v-model="selectedModel" 
      @change="setModel(selectedModel)"
      class="model-dropdown"
    >
      <option value="modernbert">ModernBERT</option>
      <option value="openai">OpenAI</option>
      <option value="tinyllama">TinyLlama</option>
    </select>
  </div>
</template>

<script setup>
import { selectedModel, setModel } from '@/composables/useChat'
</script>

<style scoped>
.model-selection {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-label {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
}

.model-dropdown {
  background: #4a5568;
  color: #e2e8f0;
  border: 1px solid #718096;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
}
</style>
```

## Feature 2: Cytoscape Graph Visualization

### 1. Graph Component
**File:** `src/components/chat/ArgumentGraph.vue`
**New Component Created:**
```vue
<template>
  <div class="argument-graph-container">
    <div class="graph-header">
      <div class="model-badge">{{ modelName.toUpperCase() }}</div>
      <div class="header-controls">
        <button @click="zoomIn" class="zoom-button" title="Zoom In">➕</button>
        <button @click="zoomOut" class="zoom-button" title="Zoom Out">➖</button>
        <button @click="resetZoom" class="zoom-button" title="Reset Zoom">🔍</button>
        <button @click="toggleGraph" class="toggle-button" :class="{ 'active': isVisible }">
          {{ isVisible ? 'Hide Graph' : 'Show Graph' }}
        </button>
      </div>
    </div>
    <div v-show="isVisible" ref="graphContainer" class="graph-container"></div>
  </div>
</template>
```

**Key Features:**
- **Responsive Design:** 80vh height with min/max limits
- **Clickable Zoom Controls:** ➕ ➖ 🔍 buttons instead of scroll
- **Model Badge:** Colorful gradient badge showing model name
- **Toggle Functionality:** Show/hide graph with button
- **Interactive Nodes:** Click nodes to see full text

### 2. Graph Styling
**Visual Design:**
```css
.argument-graph-container {
  margin: 20px 0;
  border: 1px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
  overflow: hidden;
}

.graph-container {
  width: 100%;
  height: 80vh;
  min-height: 500px;
  max-height: 800px;
  background: #1a202c;
  border-radius: 0 0 8px 8px;
}

.model-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.2);
}
```

### 3. Node and Edge Styling
**Cytoscape Configuration:**
```javascript
// Node styles
'node[type="claim"]': {
  'background-color': '#4299e1',
  'color': '#ffffff',
  'width': '120px',
  'height': '60px',
  'shape': 'rectangle',
  'border-width': 2,
  'border-color': '#2b6cb0'
}

'node[type="premise"]': {
  'background-color': '#48bb78',
  'color': '#ffffff',
  'width': '120px', 
  'height': '60px',
  'shape': 'rectangle',
  'border-width': 2,
  'border-color': '#2f855a'
}

// Edge styles
'edge[stance="pro"]': {
  'width': 3,
  'line-color': '#48bb78',
  'target-arrow-color': '#48bb78',
  'target-arrow-shape': 'triangle',
  'curve-style': 'bezier',
  'label': 'PRO'
}

'edge[stance="con"]': {
  'width': 3,
  'line-color': '#f56565',
  'target-arrow-color': '#f56565',
  'target-arrow-shape': 'triangle',
  'curve-style': 'bezier',
  'label': 'CON'
}
```

### 4. Zoom Functionality
**Zoom Controls:**
```javascript
const zoomIn = () => {
  if (cy) {
    const currentZoom = cy.zoom()
    const newZoom = Math.min(currentZoom * 1.2, 3)
    cy.zoom({
      level: newZoom,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
    })
  }
}

const zoomOut = () => {
  if (cy) {
    const currentZoom = cy.zoom()
    const newZoom = Math.max(currentZoom / 1.2, 0.2)
    cy.zoom({
      level: newZoom,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
    })
  }
}

const resetZoom = () => {
  if (cy) {
    cy.fit()
    cy.center()
  }
}
```

## Integration Changes

### 1. Message Display
**File:** `src/components/chat/ChatMessage.vue`
**Changes Made:**
```vue
<template>
  <!-- Added argument analysis display -->
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
    
    <!-- Integrated graph component -->
    <ArgumentGraph :argument-data="argumentData" :model-name="message.analysis?.model || 'Unknown'" />
  </div>
</template>

<script setup>
import ArgumentGraph from './ArgumentGraph.vue'

// Added data parsing logic
const argumentData = computed<ArgumentData | null>(() => {
  if (!props.message.analysis || typeof props.message.analysis !== 'object') {
    return null
  }
  
  const analysis = props.message.analysis
  
  if (analysis.output &&
      Array.isArray(analysis.output.claims) &&
      Array.isArray(analysis.output.premises) &&
      Array.isArray(analysis.output.stance_relations)) {
    return analysis.output
  }
  
  return null
})
</script>
```

### 2. Data Parsing
**Interface Definitions:**
```typescript
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
```

## Debugging and Error Handling

### 1. Console Logging
**Added debugging throughout:**
```javascript
console.log('Sending request to:', `${API_BASE_URL}/chat/send`)
console.log('Request data:', requestData)
console.log('Response status:', response.status)
console.log('Response data:', result)
console.log('Creating graph with data:', props.argumentData)
```

### 2. Error Handling
**Enhanced error messages:**
```javascript
if (!response.ok) {
  throw new Error(`Analysis failed: ${response.statusText}`)
}
```

## Issues Resolved

### 1. API Field Mismatch
- **Issue:** Frontend sending `text` but backend expecting `message`
- **Solution:** Updated request schema and data structure
- **Result:** Successful API communication

### 2. CORS Issues
- **Issue:** Frontend couldn't connect to backend
- **Solution:** Backend CORS configuration (see backend docs)
- **Result:** Seamless frontend-backend communication

### 3. Graph Visibility
- **Issue:** Graph hidden by default
- **Solution:** Set `isVisible` to `true` by default
- **Result:** Graph shows immediately when data is available

### 4. Zoom Functionality
- **Issue:** Scroll zoom not user-friendly
- **Solution:** Implemented clickable zoom buttons
- **Result:** Better user control over graph navigation

## Current Status
- ✅ Model selection dropdown working
- ✅ Graph visualization with Cytoscape.js
- ✅ Clickable zoom controls (➕ ➖ 🔍)
- ✅ Responsive graph sizing (80vh)
- ✅ Model name display in colorful badge
- ✅ Interactive nodes with full text display
- ✅ Proper data parsing from API responses
- ✅ Error handling and debugging logs

## Features Implemented

### 1. Model Selection
- Dropdown with three model options
- Real-time model switching
- Visual feedback in UI

### 2. Graph Visualization
- Interactive Cytoscape.js graph
- Claim nodes (blue) and premise nodes (green)
- Stance relations with PRO/CON labels
- Clickable zoom controls
- Reset zoom functionality
- Responsive design

### 3. User Experience
- Clean, modern UI design
- Intuitive controls
- Proper error handling
- Debugging capabilities
- Responsive layout

## Notes
- All changes focused on frontend features only
- Backend architecture preserved as requested
- Graph shows by default for better UX
- Zoom controls are clickable instead of scroll-based
- Model name prominently displayed in header 

## Feature 3: PDF Upload and Text Extraction (Frontend-only)

### 1. Dependency Added
- **File:** `package.json`
- **Change:** Added `pdfjs-dist` to dependencies
  - Version: `^5.4.54`

### 2. Files Modified
- **File:** `src/components/chat/MessageInput.vue`
  - Updated file input to accept only PDFs (`accept=".pdf"`).
  - Integrated PDF.js for text extraction:
    - Imported library and configured a locally bundled worker so it works offline and during dev/build.
      ```ts
      import * as pdfjsLib from 'pdfjs-dist'
      import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
      ```
    - Implemented `extractTextFromPdf(file)` to iterate pages and concatenate text items:
      ```ts
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      ```
  - Added UI state and indicator while extracting: `isExtractingPdf` and a small status box.
  - Input validation improvements:
    - Accept by MIME type or `.pdf` extension (handles browsers that omit `file.type`).
    - File size limit: 10MB.
    - Graceful error messages for invalid/empty-text PDFs.
  - Flow alignment with existing architecture:
    - Extracted text is placed into the existing textarea.
    - Sending uses the existing text endpoint; no file upload to backend.
      ```ts
      const messageData = { text: textInput.value }
      await sendMessage(messageData)
      ```

### 3. Behavior and UX
- Click the paperclip, select a PDF.
- While extracting, a short progress message is shown.
- Extracted text appears in the textarea, so users can edit it before sending.
- Submit uses the same `/chat/send` API flow as manual text.

### 4. Backend Changes
- None. The backend was not modified for this feature. The frontend converts PDFs to plain text and reuses the existing text analysis endpoint.

### 5. Known Limitations
- Image-only or password-protected PDFs will not produce text. OCR or a password would be required, which is out of scope for this change.