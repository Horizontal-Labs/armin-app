<template>
  <div class="argument-graph-container">
    <div class="graph-header">
      <div class="model-badge">{{ modelName.toUpperCase() }}</div>
      <div class="header-controls">
        <button
          @click="zoomIn"
          class="zoom-button"
          title="Zoom In"
        >
          ➕
        </button>
        <button
          @click="zoomOut"
          class="zoom-button"
          title="Zoom Out"
        >
          ➖
        </button>
        <button
          @click="resetZoom"
          class="zoom-button"
          title="Reset Zoom"
        >
          🔍
        </button>
        <button
          @click="toggleGraph"
          class="toggle-button"
          :class="{ 'active': isVisible }"
        >
          {{ isVisible ? 'Hide Graph' : 'Show Graph' }}
        </button>
      </div>
    </div>

    <div
      v-show="isVisible"
      ref="graphContainer"
      class="graph-container"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import cytoscape from 'cytoscape'

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
  argumentData: ArgumentData | null
  modelName: string
}

const props = defineProps<Props>()

const graphContainer = ref<HTMLElement>()
const isVisible = ref(true)
let cy: any = null

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

const toggleGraph = () => {
  isVisible.value = !isVisible.value
  if (isVisible.value && cy) {
    nextTick(() => {
      cy.resize()
      cy.fit()
    })
  }
}

const createGraph = () => {
  console.log('createGraph called')
  console.log('Graph container:', graphContainer.value)
  console.log('Argument data:', props.argumentData)

  if (!graphContainer.value || !props.argumentData) {
    console.log('Graph container or argument data not available')
    return
  }

  try {
    console.log('Creating graph with data:', props.argumentData)

    // Clear existing graph
    if (cy) {
      cy.destroy()
    }

  const elements: any[] = []
  const nodeIds = new Set<string>()

  // Add claim nodes
  props.argumentData.claims.forEach(claim => {
    elements.push({
      data: {
        id: claim.id,
        label: claim.text.length > 50 ? claim.text.substring(0, 50) + '...' : claim.text,
        fullText: claim.text,
        type: 'claim',
        nodeType: 'claim'
      }
    })
    nodeIds.add(claim.id)
  })

  // Add premise nodes
  props.argumentData.premises.forEach(premise => {
    elements.push({
      data: {
        id: premise.id,
        label: premise.text.length > 50 ? premise.text.substring(0, 50) + '...' : premise.text,
        fullText: premise.text,
        type: 'premise',
        nodeType: 'premise'
      }
    })
    nodeIds.add(premise.id)
  })

  // Add edges for stance relations
  props.argumentData.stance_relations.forEach((relation, index) => {
    if (nodeIds.has(relation.claim_id) && nodeIds.has(relation.premise_id)) {
      elements.push({
        data: {
          id: `edge-${index}`,
          source: relation.claim_id,
          target: relation.premise_id,
          label: relation.stance,
          stance: relation.stance
        }
      })
    }
  })

                 // Initialize Cytoscape
               cy = cytoscape({
                 container: graphContainer.value,
                 elements: elements,

                 // Add zoom and pan functionality
                 minZoom: 0.2,
                 maxZoom: 3,
                 wheelSensitivity: 0, // Disable scroll zoom

                 style: [
                         {
                     selector: 'node[type="claim"]',
                     style: {
                       'background-color': '#4299e1',
                       'color': '#ffffff',
                       'label': 'data(label)',
                       'text-wrap': 'wrap',
                       'text-max-width': '120px',
                       'font-size': '12px',
                       'font-weight': 'bold',
                       'text-valign': 'center',
                       'text-halign': 'center',
                       'width': '120px',
                       'height': '60px',
                       'shape': 'rectangle',
                       'border-width': 2,
                       'border-color': '#2b6cb0'
                     }
                   },
                         {
                     selector: 'node[type="premise"]',
                     style: {
                       'background-color': '#48bb78',
                       'color': '#ffffff',
                       'label': 'data(label)',
                       'text-wrap': 'wrap',
                       'text-max-width': '120px',
                       'font-size': '12px',
                       'font-weight': 'bold',
                       'text-valign': 'center',
                       'text-halign': 'center',
                       'width': '120px',
                       'height': '60px',
                       'shape': 'rectangle',
                       'border-width': 2,
                       'border-color': '#2f855a'
                     }
                   },
                         {
                     selector: 'edge[stance="pro"]',
                     style: {
                       'width': 4,
                       'line-color': '#48bb78',
                       'target-arrow-color': '#48bb78',
                       'target-arrow-shape': 'triangle',
                       'target-arrow-width': 8,
                       'curve-style': 'bezier',
                       'label': 'PRO',
                       'font-size': '12px',
                       'font-weight': 'bold',
                       'color': '#48bb78',
                       'text-outline-color': '#1a202c',
                       'text-outline-width': 2,
                       'text-outline-opacity': 0.8,
                       'text-background-color': '#48bb78',
                       'text-background-opacity': 0.2,
                       'text-background-padding': '4px',
                       'text-border-color': '#48bb78',
                       'text-border-width': 1,
                       'text-border-opacity': 0.5
                     }
                   },
                         {
                     selector: 'edge[stance="con"]',
                     style: {
                       'width': 4,
                       'line-color': '#f56565',
                       'target-arrow-color': '#f56565',
                       'target-arrow-shape': 'triangle',
                       'target-arrow-width': 8,
                       'curve-style': 'bezier',
                       'label': 'CON',
                       'font-size': '12px',
                       'font-weight': 'bold',
                       'color': '#f56565',
                       'text-outline-color': '#1a202c',
                       'text-outline-width': 2,
                       'text-outline-opacity': 0.8,
                       'text-background-color': '#f56565',
                       'text-background-opacity': 0.2,
                       'text-background-padding': '4px',
                       'text-border-color': '#f56565',
                       'text-border-width': 1,
                       'text-border-opacity': 0.5
                     }
                   },
                         {
                     selector: 'edge[stance="unidentified"]',
                     style: {
                       'width': 2,
                       'line-color': '#a0aec0',
                       'target-arrow-color': '#a0aec0',
                       'target-arrow-shape': 'triangle',
                       'curve-style': 'bezier',
                       'label': 'UNKNOWN',
                       'font-size': '10px',
                       'font-weight': 'bold',
                       'color': '#a0aec0'
                     }
                   }
    ],
                     layout: {
                   name: 'cose',
                   animate: true,
                   animationDuration: 800,
                   nodeDimensionsIncludeLabels: true,
                   padding: 60,
                   nodeRepulsion: 6000,
                   nodeOverlap: 30,
                   idealEdgeLength: 150,
                   edgeElasticity: 80
                 }
  })

  // Add event listeners
  cy.on('tap', 'node', function(evt: any) {
    const node = evt.target
    const fullText = node.data('fullText')
    if (fullText) {
      alert(`${node.data('type').toUpperCase()}: ${fullText}`)
    }
  })

    // Fit the graph to the container
    cy.fit()
  } catch (error) {
    console.error('Error creating graph:', error)
  }
}

// Watch for changes in argument data
watch(() => props.argumentData, (newData) => {
  console.log('Argument data changed:', newData)
  console.log('Is visible:', isVisible.value)
  if (newData && isVisible.value) {
    console.log('Creating graph on data change')
    nextTick(() => {
      createGraph()
    })
  }
}, { deep: true })

onMounted(() => {
  console.log('ArgumentGraph mounted')
  console.log('Initial argument data:', props.argumentData)
  console.log('Initial isVisible:', isVisible.value)
  if (props.argumentData && isVisible.value) {
    console.log('Creating graph on mount')
    nextTick(() => {
      createGraph()
    })
  }
})

onUnmounted(() => {
  if (cy) {
    cy.destroy()
  }
})
</script>

<style scoped>
.argument-graph-container {
  margin: 20px 0;
  border: 1px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
  overflow: hidden;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #4a5568;
  border-bottom: 1px solid #718096;
  border-radius: 8px 8px 0 0;
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

.header-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.zoom-button {
  background: rgba(66, 153, 225, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(66, 153, 225, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.zoom-button:hover {
  background: rgba(66, 153, 225, 0.3);
  border-color: rgba(66, 153, 225, 0.5);
}

.toggle-button {
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle-button:hover {
  background: #3182ce;
}

.toggle-button.active {
  background: #e53e3e;
}

.toggle-button.active:hover {
  background: #c53030;
}

.graph-container {
  width: 100%;
  height: 80vh;
  min-height: 500px;
  max-height: 800px;
  background: #1a202c;
  border-radius: 0 0 8px 8px;
}
</style>
