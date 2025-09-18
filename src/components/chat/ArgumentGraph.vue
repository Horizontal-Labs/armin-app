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
        <select v-model="selectedLayout" @change="changeLayout" class="layout-select" title="Change Layout">
          <option value="cose-bilkent">Grouped Layout</option>
          <option value="circle">Circle</option>
          <option value="concentric">Concentric</option>
          <option value="grid">Grid</option>
        </select>
        <button @click="zoomIn" class="zoom-button" title="Zoom In">
          ➕
        </button>
        <button @click="zoomOut" class="zoom-button" title="Zoom Out">
          ➖
        </button>
        <button @click="resetZoom" class="zoom-button" title="Reset Zoom">
          🔍
        </button>
        <button @click="toggleGraph" class="toggle-button" :class="{ 'active': isVisible }">
          {{ isVisible ? 'Hide Graph' : 'Show Graph' }}
        </button>
      </div>
    </div>

    <div v-show="isVisible" ref="graphContainer" class="graph-container">
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
            <span>Premises without stance (no link yet)</span>
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
const selectedLayout = ref('cose-bilkent')  // Default to grouped layout
let cy: any = null
let tooltipEl: HTMLDivElement | null = null
const CTRL_ZOOM_SENSITIVITY = 0.75

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

function ensureTooltipElement(): HTMLDivElement | null {
  if (!graphContainer.value) return null
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'graph-tooltip'
    tooltipEl.style.opacity = '0'
    tooltipEl.style.left = '0px'
    tooltipEl.style.top = '0px'
    graphContainer.value.appendChild(tooltipEl)
  } else if (tooltipEl.parentElement !== graphContainer.value) {
    graphContainer.value.appendChild(tooltipEl)
  }
  return tooltipEl
}

function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.style.opacity = '0'
  }
}

function destroyTooltip(): void {
  if (tooltipEl && tooltipEl.parentElement) {
    tooltipEl.parentElement.removeChild(tooltipEl)
    tooltipEl = null
  }
}

function positionTooltip(event: any): void {
  if (!tooltipEl || !graphContainer.value) return
  const position = event.renderedPosition || { x: 0, y: 0 }
  const containerWidth = graphContainer.value.clientWidth
  const containerHeight = graphContainer.value.clientHeight
  const tooltipRect = tooltipEl.getBoundingClientRect()

  let left = position.x + 18
  let top = position.y + 18

  const maxLeft = Math.max(0, containerWidth - tooltipRect.width - 12)
  const maxTop = Math.max(0, containerHeight - tooltipRect.height - 12)

  left = Math.min(Math.max(12, left), maxLeft)
  top = Math.min(Math.max(12, top), maxTop)

  tooltipEl.style.left = `${left}px`
  tooltipEl.style.top = `${top}px`
}

function registerTooltipHandlers(): void {
  if (!cy) return
  cy.on('mouseover', 'node', (event: any) => {
    const el = ensureTooltipElement()
    if (!el) return
    el.textContent = event.target.data('fullText') || event.target.data('label') || ''
    positionTooltip(event)
    el.style.opacity = '1'
  })

  cy.on('mouseout', 'node', () => {
    hideTooltip()
  })

  cy.on('mousemove', 'node', (event: any) => {
    positionTooltip(event)
  })
}

function clearHighlights(): void {
  if (!cy) return
  cy.elements().removeClass('highlighted-claim highlighted-premise highlighted-edge highlighted-group faded')
  hideTooltip()
}

function registerHighlightHandlers(): void {
  if (!cy) return

  const highlightClaim = (claimNode: any) => {
    clearHighlights()
    cy.elements().addClass('faded')
    const neighborhood = claimNode.closedNeighborhood()
    const parentGroup = claimNode.parent()
    if (parentGroup && parentGroup.length > 0) {
      parentGroup.removeClass('faded')
      parentGroup.addClass('highlighted-group')
    }
    neighborhood.removeClass('faded')
    claimNode.addClass('highlighted-claim')
    neighborhood.filter('node[type="premise"]').addClass('highlighted-premise')
    neighborhood.filter('edge').addClass('highlighted-edge')
  }

  const highlightPremise = (premiseNode: any) => {
    clearHighlights()
    cy.elements().addClass('faded')

    const parentGroup = premiseNode.parent()
    if (parentGroup && parentGroup.length > 0) {
      parentGroup.removeClass('faded')
      parentGroup.addClass('highlighted-group')
    }

    const connectedEdges = premiseNode.connectedEdges()
    if (!connectedEdges.length) {
      premiseNode.removeClass('faded')
      premiseNode.addClass('highlighted-premise')
      return
    }

    const neighborhood = premiseNode.closedNeighborhood()
    neighborhood.removeClass('faded')
    premiseNode.addClass('highlighted-premise')
    neighborhood.filter('node[type="claim"]').addClass('highlighted-claim')
    neighborhood.filter('edge').addClass('highlighted-edge')
  }

  cy.on('tap', 'node[type="claim"]', (event: any) => {
    highlightClaim(event.target)
  })

  cy.on('tap', 'node[type="premise"]', (event: any) => {
    highlightPremise(event.target)
  })

  cy.on('tap', 'node[type="group"]', (event: any) => {
    const claimChild = event.target.children('node[type="claim"]').first()
    if (claimChild && claimChild.length > 0) {
      highlightClaim(claimChild[0])
      return
    }
    const premiseChild = event.target.children('node[type="premise"]').first()
    if (premiseChild && premiseChild.length > 0) {
      highlightPremise(premiseChild[0])
    }
  })

  cy.on('tap', (event: any) => {
    if (event.target === cy) {
      clearHighlights()
      hideTooltip()
    }
  })
}

const changeLayout = () => {
  if (!cy) return

  clearHighlights()

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
    const claims = cy.nodes('[type="claim"]')
    const premises = cy.nodes('[type="premise"]')
    const claimCount = Math.max(claims.length, 1)
    const groupSpacing = 420
    const premiseHorizontalSpacing = 200
    const premiseVerticalSpacing = 200
    const claimBaselineY = -60
    const premiseBaselineY = 220

    layoutOptions.name = 'preset'
    layoutOptions.positions = (node: any) => {
      if (node.data('type') === 'claim') {
        const claimIndex = claims.indexOf(node)
        const baseX = (claimIndex - (claimCount - 1) / 2) * groupSpacing
        return { x: baseX, y: claimBaselineY }
      }

      const outgoingEdges = cy.edges(`[source="${node.id()}"]`)
      if (outgoingEdges.length > 0) {
        const claimId = outgoingEdges[0].target().id()
        const claimNode = cy.getElementById(claimId)
        const claimIndex = claims.indexOf(claimNode)
        const baseX = (claimIndex - (claimCount - 1) / 2) * groupSpacing

        const connectedPremises = cy.edges(`[target="${claimId}"]`).sources()
        const premiseIndex = connectedPremises.indexOf(node)
        const horizontalOffset = (connectedPremises.length > 1)
          ? (premiseIndex - (connectedPremises.length - 1) / 2) * premiseHorizontalSpacing
          : 0
        const y = premiseBaselineY + premiseIndex * premiseVerticalSpacing
        return { x: baseX + horizontalOffset, y }
      }

      // Fallback for premises without linked claims
      return { x: 0, y: premiseBaselineY }
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

    // Prepare grouping structures
    const elements: any[] = []
    const nodeIds = new Set<string>()

    const claimGroupMap = new Map<string, string>()
    const premisePrimaryClaimMap = new Map<string, string>()
    const premiseStanceMap = new Map<string, string>()

    props.argumentData?.stance_relations.forEach(relation => {
      if (!premisePrimaryClaimMap.has(relation.premise_id)) {
        premisePrimaryClaimMap.set(relation.premise_id, relation.claim_id)
      }
      if (!premiseStanceMap.has(relation.premise_id)) {
        premiseStanceMap.set(relation.premise_id, relation.stance)
      }
    })

    props.argumentData.claims.forEach(claim => {
      const groupId = `group-${claim.id}`
      claimGroupMap.set(claim.id, groupId)

      elements.push({
        data: {
          id: groupId,
          type: 'group',
          nodeType: 'group',
          groupLabel: claim.text,
          claimId: claim.id
        },
        classes: 'claim-group'
      })
      nodeIds.add(groupId)

      elements.push({
        data: {
          id: claim.id,
          label: claim.text,
          fullText: claim.text,
          type: 'claim',
          nodeType: 'claim',
          parent: groupId
        }
      })
      nodeIds.add(claim.id)
    })

    let unlinkedGroupId: string | null = null
    const getUnlinkedGroupId = () => {
      if (!unlinkedGroupId) {
        unlinkedGroupId = 'group-unlinked'
        elements.push({
          data: {
            id: unlinkedGroupId,
            type: 'group',
            nodeType: 'group',
            groupLabel: 'Unlinked Premises'
          },
          classes: 'claim-group unlinked-group'
        })
        nodeIds.add(unlinkedGroupId)
      }
      return unlinkedGroupId
    }

    props.argumentData.premises.forEach(premise => {
      const stance = premiseStanceMap.get(premise.id) || 'unidentified'
      const parentClaimId = premisePrimaryClaimMap.get(premise.id)
      const parentGroupId = parentClaimId ? claimGroupMap.get(parentClaimId) : undefined
      const parent = parentGroupId || getUnlinkedGroupId()

      elements.push({
        data: {
          id: premise.id,
          label: premise.text,
          fullText: premise.text,
          type: 'premise',
          nodeType: 'premise',
          stance,
          parent
        }
      })
      nodeIds.add(premise.id)
    })

// Add edges for stance relations
    props.argumentData?.stance_relations.forEach((relation, index) => {
      if (nodeIds.has(relation.claim_id) && nodeIds.has(relation.premise_id)) {
        const displayLabel = relation.stance === 'pro'
          ? '✓ Supports'
          : relation.stance === 'con'
            ? '✗ Opposes'
            : 'No stance link'
        elements.push({
          data: {
            id: `edge-${index}`,
            source: relation.premise_id,
            target: relation.claim_id,
            label: relation.stance,
            displayLabel,
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
      wheelSensitivity: CTRL_ZOOM_SENSITIVITY, // Tuned for quicker Ctrl+wheel zooming

      style: [
              {
                selector: 'node',
                style: {
            'label': 'data(label)',
            'color': '#e2e8f0',
            'font-size': '14px',
            'font-weight': 500,
            'text-wrap': 'wrap',
            'text-max-width': '240px',
            'text-valign': 'center',
            'text-halign': 'center',
            'line-height': 1.45,
            'padding': '14px',
            'background-color': '#2d3748',
            'background-opacity': 0.95,
            'border-width': 2,
            'border-color': '#1a202c',
            'shape': 'round-rectangle',
            'width': 'label',
            'height': 'label',
            'text-outline-width': 0
                }
              },
              {
                selector: 'node[type="group"]',
                style: {
            'label': 'data(groupLabel)',
            'font-size': '12px',
            'color': '#a0aec0',
            'background-color': 'rgba(66, 153, 225, 0.08)',
            'background-opacity': 1,
            'border-width': 1,
            'border-style': 'dashed',
            'border-color': 'rgba(66, 153, 225, 0.35)',
            'shape': 'round-rectangle',
            'padding': '28px',
            'text-valign': 'top',
            'text-halign': 'left',
            'text-margin-y': -18,
            'text-margin-x': 8,
            'font-weight': 500
                }
              },
              {
                selector: 'node.unlinked-group',
                style: {
            'background-color': 'rgba(160, 174, 192, 0.12)',
            'border-color': 'rgba(113, 128, 150, 0.35)'
                }
              },
              {
                selector: 'node[type="premise"]',
                style: {
            'shape': 'round-rectangle'
                }
              },
              {
                selector: 'node[type="claim"]',
                style: {
            'background-color': '#2b6cb0',
            'border-color': '#1e4e8c',
            'color': '#f7fafc',
            'font-weight': 600
                }
              },
              {
                selector: 'node[type="premise"][stance="pro"]',
                style: {
            'background-color': '#276749',
            'border-color': '#1c4532',
            'color': '#f0fff4'
                }
              },
              {
                selector: 'node[type="premise"][stance="con"]',
                style: {
            'background-color': '#9b2c2c',
            'border-color': '#742a2a',
            'color': '#fff5f5'
                }
              },
              {
                selector: 'node[type="premise"][stance="unidentified"]',
                style: {
            'background-color': '#4a5568',
            'border-color': '#2d3748',
            'color': '#edf2f7'
                }
              },
              {
                selector: 'edge',
                style: {
            'width': 3,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#718096',
            'line-color': '#718096',
            'label': 'data(displayLabel)',
            'color': '#e2e8f0',
            'font-size': '13px',
            'font-weight': 600,
            'text-background-color': 'rgba(15, 23, 42, 0.85)',
            'text-background-opacity': 1,
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
            'text-margin-y': -4,
            'arrow-scale': 1.25,
            'text-outline-width': 0
                }
              },
              {
                selector: 'edge[stance="pro"]',
                style: {
            'line-color': '#48bb78',
            'target-arrow-color': '#48bb78',
            'color': '#c6f6d5',
            'text-background-color': 'rgba(36, 83, 60, 0.9)'
                }
              },
              {
                selector: 'edge[stance="con"]',
                style: {
            'line-color': '#f56565',
            'target-arrow-color': '#f56565',
            'color': '#fed7d7',
            'text-background-color': 'rgba(127, 29, 29, 0.9)'
                }
              },
              {
                selector: 'edge[stance="unidentified"]',
                style: {
            'line-color': '#a0aec0',
            'target-arrow-color': '#a0aec0',
            'color': '#e2e8f0',
            'line-style': 'dashed',
            'arrow-scale': 1,
            'text-background-color': 'rgba(74, 85, 104, 0.85)'
                }
              },
              {
                selector: '.highlighted-claim',
                style: {
            'border-color': '#f6ad55',
            'border-width': 4
                }
              },
              {
                selector: '.highlighted-premise',
                style: {
            'border-color': '#63b3ed',
            'border-width': 4
                }
              },
              {
                selector: 'node.highlighted-group',
                style: {
            'border-color': '#f6ad55',
            'border-width': 2,
            'background-color': 'rgba(246, 173, 85, 0.12)'
                }
              },
              {
                selector: 'edge.highlighted-edge',
                style: {
            'width': 6,
            'line-color': '#f6ad55',
            'target-arrow-color': '#f6ad55',
            'color': '#fed7aa',
            'text-background-color': 'rgba(101, 62, 14, 0.95)'
                }
              },
              {
                selector: '.faded',
                style: {
            'opacity': 0.15
                }
              },
              {
                selector: 'edge.faded',
                style: {
            'opacity': 0.1,
            'text-opacity': 0
                }
              }
            ],
            layout: {
              name: 'preset'
            }
          })
      
          registerTooltipHandlers()
          registerHighlightHandlers()
          changeLayout()
      
          // Add event listeners
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
            destroyTooltip()
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
      .graph-tooltip {
        position: absolute;
        pointer-events: none;
        max-width: 360px;
        background: rgba(15, 23, 42, 0.95);
        color: #f7fafc;
        padding: 8px 12px;
        border-radius: 6px;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
        font-size: 13px;
        line-height: 1.45;
        border: 1px solid rgba(99, 179, 237, 0.25);
        opacity: 0;
        transition: opacity 0.12s ease;
        z-index: 20;
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
