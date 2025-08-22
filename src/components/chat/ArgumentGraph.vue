<template>
  <div class="argument-graph-container">
    <div class="graph-header">
      <div class="model-badges">
        <div class="model-badge claim-badge">
          <span class="badge-label">ADU:</span> {{ (props.aduModel || 'Unknown').toUpperCase() }}
        </div>
        <div class="model-badge stance-badge">
          <span class="badge-label">Stance:</span> {{ (props.stanceModel || 'Unknown').toUpperCase() }}
        </div>
      </div>
      <div class="header-controls">
        <select
          v-model="selectedLayout"
          @change="changeLayout"
          class="layout-select"
          title="Change Layout"
        >
          <option value="cose-bilkent">Grouped Layout</option>
          <option value="circle">Circle</option>
          <option value="concentric">Concentric</option>
          <option value="grid">Grid</option>
        </select>
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
    >
      <div class="graph-legend">
        <div class="legend-title">Legend</div>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-color claim-color"></div>
            <span>Claims</span>
          </div>
          <div class="legend-item">
            <div class="legend-color support-premise-color"></div>
            <span>Supporting Premises</span>
          </div>
          <div class="legend-item">
            <div class="legend-color oppose-premise-color"></div>
            <span>Opposing Premises</span>
          </div>
          <div class="legend-item">
            <div class="legend-color neutral-premise-color"></div>
            <span>Unclear Stance</span>
          </div>
        </div>
      </div>
    </div>
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
  aduModel?: string
  stanceModel?: string
}

const props = defineProps<Props>()

const graphContainer = ref<HTMLElement>()
const isVisible = ref(false)
const selectedLayout = ref('grid')  // Default to grid layout
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
    cy.fit(50)  // Reset with reasonable padding
    cy.center()
  }
}

const toggleGraph = () => {
  isVisible.value = !isVisible.value
  if (isVisible.value) {
    nextTick(() => {
      if (!cy && props.argumentData) {
        createGraph()
      } else if (cy) {
        cy.resize()
        setTimeout(() => {
          cy.fit(50)  // Use reasonable padding
          cy.center()
        }, 100)
      }
    })
  }
}

const changeLayout = () => {
  if (!cy) return
  
  // Get the number of nodes to adjust spacing
  const nodeCount = cy.nodes().length
  
  const layoutOptions: any = {
    name: selectedLayout.value,
    animate: true,
    animationDuration: 500,
    nodeDimensionsIncludeLabels: true,
    avoidOverlap: true,
    fit: false,  // Don't auto-fit during layout
    boundingBox: undefined  // Use full viewport
  }
  
  // Add specific options for different layouts
  if (selectedLayout.value === 'cose-bilkent') {
    // Custom grouped layout - align claims horizontally
    // First, use a preset layout to position claims in a row
    const claims = cy.nodes('[type="claim"]')
    const premises = cy.nodes('[type="premise"]')
    const claimCount = claims.length
    const totalWidth = claimCount * 550  // Increased width per claim group for better spacing
    
    layoutOptions.name = 'preset'
    layoutOptions.positions = (node: any) => {
      if (node.data('type') === 'claim') {
        // Position claims in a horizontal row
        const claimIndex = claims.indexOf(node)
        const x = -totalWidth/2 + (claimIndex + 0.5) * 550  // Match increased spacing
        return { x: x, y: 0 }
      } else {
        // Position premises above their connected claims
        // Find connected claim
        const edges = cy.edges(`[source="${node.id()}"]`)
        if (edges.length > 0) {
          const claimId = edges[0].target().id()
          const claimNode = cy.getElementById(claimId)
          const claimIndex = claims.indexOf(claimNode)
          const x = -totalWidth/2 + (claimIndex + 0.5) * 550  // Match increased spacing
          
          // Stack premises vertically above the claim with more spacing
          const connectedPremises = cy.edges(`[target="${claimId}"]`).sources()
          const premiseIndex = connectedPremises.indexOf(node)
          const y = -250 - (premiseIndex * 220)  // Increased vertical spacing
          
          return { x: x, y: y }
        }
        // Fallback position for unconnected premises
        return { x: 0, y: -400 }
      }
    }
    layoutOptions.animate = true
  } else if (selectedLayout.value === 'concentric') {
    layoutOptions.levelWidth = () => 1
    layoutOptions.minNodeSpacing = 80  // Better node spacing
    layoutOptions.concentric = (node: any) => {
      return node.data('type') === 'claim' ? 2 : 1
    }
  } else if (selectedLayout.value === 'circle') {
    // Calculate radius based on number of nodes - reasonable radius for visibility
    const radius = Math.max(150, Math.min(250, nodeCount * 20))
    layoutOptions.radius = radius
    layoutOptions.startAngle = 0
    layoutOptions.sweep = 2 * Math.PI
    layoutOptions.clockwise = true
    layoutOptions.sort = undefined
  } else if (selectedLayout.value === 'grid') {
    layoutOptions.rows = Math.ceil(Math.sqrt(nodeCount))
    layoutOptions.cols = Math.ceil(nodeCount / layoutOptions.rows)
    // Remove the position function to let grid layout auto-position nodes
    layoutOptions.nodeDimensionsIncludeLabels = true  // Include labels to prevent stacking
    layoutOptions.spacingFactor = 1.5  // Add spacing factor for grid
    layoutOptions.condense = false  // Don't condense empty spaces
    layoutOptions.avoidOverlapPadding = 10  // Add padding between nodes
  }
  
  const layout = cy.layout(layoutOptions)
  
  // Listen for layout completion
  layout.on('layoutstop', () => {
    // After layout is complete, fit with appropriate padding
    setTimeout(() => {
      // Use reasonable padding for better visibility
      let padding = 50  // Default padding
      if (selectedLayout.value === 'breadthfirst') {
        padding = 80  // Much more padding for hierarchical layout
      } else if (selectedLayout.value === 'grid') {
        padding = 40  // Slightly less for grid to see all nodes
      }
      
      cy.fit(padding)
      cy.center()
    }, 100)
  })
  
  layout.run()
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
        label: claim.text,
        fullText: claim.text,
        type: 'claim',
        nodeType: 'claim'
      }
    })
    nodeIds.add(claim.id)
  })

  // Create a map to store premise stances
  const premiseStanceMap = new Map<string, string>()
  props.argumentData?.stance_relations.forEach(relation => {
    if (!premiseStanceMap.has(relation.premise_id)) {
      premiseStanceMap.set(relation.premise_id, relation.stance)
    }
  })

  // Add premise nodes with stance information
  props.argumentData.premises.forEach(premise => {
    const stance = premiseStanceMap.get(premise.id) || 'unidentified'
    elements.push({
      data: {
        id: premise.id,
        label: premise.text,
        fullText: premise.text,
        type: 'premise',
        nodeType: 'premise',
        stance: stance
      }
    })
    nodeIds.add(premise.id)
  })

  // Add edges for stance relations
  props.argumentData?.stance_relations.forEach((relation, index) => {
    if (nodeIds.has(relation.claim_id) && nodeIds.has(relation.premise_id)) {
      elements.push({
        data: {
          id: `edge-${index}`,
          source: relation.premise_id,
          target: relation.claim_id,
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
                 wheelSensitivity: 0.1, // Enable scroll zoom with Ctrl

                 style: [
                         {
                     selector: 'node[type="claim"]',
                     style: {
                       'background-color': '#4299e1',
                       'color': '#ffffff',
                       'label': 'data(label)',
                       'text-wrap': 'wrap',
                       'text-max-width': '280px',
                       'font-size': '16px',
                       'font-weight': 600,
                       'text-valign': 'center',
                       'text-halign': 'center',
                       'width': '300px',
                       'height': '140px',
                       'shape': 'round-rectangle',
                       'border-width': 3,
                       'border-color': '#2b6cb0',
                       'padding': '20px'
                     }
                   },
                         {
                     selector: 'node[type="premise"][stance="pro"]',
                     style: {
                       'background-color': '#48bb78',
                       'color': '#ffffff',
                       'label': 'data(label)',
                       'text-wrap': 'wrap',
                       'text-max-width': '280px',
                       'font-size': '16px',
                       'font-weight': 600,
                       'text-valign': 'center',
                       'text-halign': 'center',
                       'width': '300px',
                       'height': '140px',
                       'shape': 'round-rectangle',
                       'border-width': 3,
                       'border-color': '#2f855a',
                       'padding': '20px'
                     }
                   },
                         {
                     selector: 'node[type="premise"][stance="con"]',
                     style: {
                       'background-color': '#f56565',
                       'color': '#ffffff',
                       'label': 'data(label)',
                       'text-wrap': 'wrap',
                       'text-max-width': '280px',
                       'font-size': '16px',
                       'font-weight': 600,
                       'text-valign': 'center',
                       'text-halign': 'center',
                       'width': '300px',
                       'height': '140px',
                       'shape': 'round-rectangle',
                       'border-width': 3,
                       'border-color': '#c53030',
                       'padding': '20px'
                     }
                   },
                         {
                     selector: 'node[type="premise"][stance="unidentified"]',
                     style: {
                       'background-color': '#a0aec0',
                       'color': '#ffffff',
                       'label': 'data(label)',
                       'text-wrap': 'wrap',
                       'text-max-width': '280px',
                       'font-size': '16px',
                       'font-weight': 600,
                       'text-valign': 'center',
                       'text-halign': 'center',
                       'width': '300px',
                       'height': '140px',
                       'shape': 'round-rectangle',
                       'border-width': 3,
                       'border-color': '#718096',
                       'padding': '20px'
                     }
                   },
                         {
                     selector: 'edge[stance="pro"]',
                     style: {
                       'width': 5,
                       'line-color': '#48bb78',
                       'target-arrow-color': '#48bb78',
                       'target-arrow-shape': 'triangle',
                       'curve-style': 'bezier',
                       'label': '✓ SUPPORTS',
                       'font-size': '16px',
                       'font-weight': 600,
                       'color': '#48bb78',
                       'text-outline-color': '#1a202c',
                       'text-outline-width': 3,
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
                       'width': 5,
                       'line-color': '#f56565',
                       'target-arrow-color': '#f56565',
                       'target-arrow-shape': 'triangle',
                       'curve-style': 'bezier',
                       'label': '✗ OPPOSES',
                       'font-size': '16px',
                       'font-weight': 600,
                       'color': '#f56565',
                       'text-outline-color': '#1a202c',
                       'text-outline-width': 3,
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
                       'label': '? UNCLEAR',
                       'font-size': '14px',
                       'font-weight': 600,
                       'color': '#a0aec0'
                     }
                   }
    ],
                     layout: {
                   name: 'preset',
                   positions: (node: any) => {
                     const claimNodes = elements.filter(e => e.data && e.data.type === 'claim')
                     const claimCount = claimNodes.length
                     const totalWidth = claimCount * 550  // Increased spacing
                     
                     if (node.data('type') === 'claim') {
                       const claimIndex = claimNodes.findIndex(c => c.data.id === node.id())
                       const x = -totalWidth/2 + (claimIndex + 0.5) * 550  // Match increased spacing
                       return { x: x, y: 0 }
                     } else {
                       // Find connected claim for this premise
                       const relation = props.argumentData?.stance_relations.find(
                         r => r.premise_id === node.id()
                       )
                       if (relation) {
                         const claimIndex = claimNodes.findIndex(c => c.data.id === relation.claim_id)
                         const x = -totalWidth/2 + (claimIndex + 0.5) * 550  // Match increased spacing
                         
                         // Count premises for this claim to stack them with more spacing
                         const premisesForClaim = props.argumentData?.stance_relations
                           ?.filter(r => r.claim_id === relation.claim_id)
                           ?.map(r => r.premise_id) || []
                         const premiseIndex = premisesForClaim.indexOf(node.id())
                         const y = -250 - (premiseIndex * 220)  // Increased vertical spacing
                         
                         return { x: x, y: y }
                       }
                       return { x: 0, y: -400 }
                     }
                   },
                   animate: true,
                   animationDuration: 500,
                   fit: false
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

  // Add custom wheel event listener for Ctrl+Wheel zoom
  const container = graphContainer.value
  if (container) {
    container.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const zoomLevel = cy.zoom()
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
        const newZoom = Math.min(Math.max(zoomLevel * zoomFactor, 0.2), 3)
        
        // Get the position relative to the container
        const rect = container.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        cy.zoom({
          level: newZoom,
          renderedPosition: { x, y }
        })
      }
    }, { passive: false })
  }

    // Ensure all nodes are visible with reasonable padding
    setTimeout(() => {
      cy.fit(80)  // More padding for initial view to prevent overlap
      cy.center()
    }, 600)
  } catch (error) {
    console.error('Error creating graph:', error)
  }
}

// Watch for changes in argument data
watch(() => props.argumentData, (newData) => {
  console.log('Argument data changed:', newData)
  console.log('Is visible:', isVisible.value)
  if (newData) {
    if (isVisible.value) {
      console.log('Creating graph on data change (visible)')
      nextTick(() => {
        createGraph()
      })
    } else {
      // Destroy existing graph if hidden to recreate when shown
      if (cy) {
        cy.destroy()
        cy = null
      }
    }
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
  margin-bottom: 30px;
  border: 1px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
  overflow: hidden;
  position: relative;
  z-index: 1;
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

.model-badges {
  display: flex;
  gap: 12px;
  align-items: center;
}

.model-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 6px;
}

.claim-badge {
  background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%);
}

.stance-badge {
  background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%);
}

.badge-label {
  font-weight: 400;
  opacity: 0.9;
  font-size: 11px;
}

.header-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.layout-select {
  background: #2d3748;
  color: #e2e8f0;
  border: 2px solid #4a5568;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.layout-select option {
  background: #2d3748;
  color: #e2e8f0;
  padding: 4px;
}

.layout-select:hover {
  background: #374151;
  border-color: #4299e1;
}

.layout-select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.3);
  background: #374151;
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
  height: 600px;
  min-height: 600px;
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  border-radius: 0 0 8px 8px;
  position: relative;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.3);
}

.graph-legend {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(45, 55, 72, 0.95);
  border: 1px solid #4a5568;
  border-radius: 8px;
  padding: 12px;
  z-index: 10;
}

.legend-title {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  border-bottom: 1px solid #4a5568;
  padding-bottom: 4px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #a0aec0;
  font-size: 12px;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid #2d3748;
}

.claim-color {
  background: #4299e1;
  border-color: #2b6cb0;
}

.support-premise-color {
  background: #48bb78;
  border-color: #2f855a;
}

.oppose-premise-color {
  background: #f56565;
  border-color: #c53030;
}

.neutral-premise-color {
  background: #a0aec0;
  border-color: #718096;
}

.legend-line {
  width: 20px;
  height: 3px;
  position: relative;
}

.legend-line::after {
  content: '';
  position: absolute;
  right: -2px;
  top: -3px;
  width: 0;
  height: 0;
  border-left: 6px solid currentColor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
}

.support-line {
  background: #48bb78;
  color: #48bb78;
}

.oppose-line {
  background: #f56565;
  color: #f56565;
}
</style>
