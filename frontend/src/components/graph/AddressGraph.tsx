import { useEffect, useRef, useCallback, useState } from 'react'
import { Network, DataSet, Options } from 'vis-network/standalone'
import type { NeighborInfo } from '@/types'

export interface GraphNode {
  id: string
  label: string
  title?: string
  color?: string | { background: string; border: string }
  size?: number
  font?: { color: string }
  borderWidth?: number
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  label?: string
  title?: string
  arrows?: string
  color?: string | { color: string }
  width?: number
  dashes?: boolean
}

interface AddressGraphProps {
  centerAddress: string
  neighbors: NeighborInfo[]
  onNodeClick?: (address: string) => void
  onNodeDoubleClick?: (address: string) => void
  height?: string
  className?: string
}

// Risk score to color mapping
function getRiskColor(riskScore: number | undefined): string {
  if (riskScore === undefined || riskScore === null) return '#9CA3AF' // gray
  if (riskScore >= 0.8) return '#DC2626' // red
  if (riskScore >= 0.6) return '#EA580C' // orange
  if (riskScore >= 0.4) return '#CA8A04' // yellow
  return '#16A34A' // green
}

function getRiskBorderColor(riskScore: number | undefined): string {
  if (riskScore === undefined || riskScore === null) return '#6B7280'
  if (riskScore >= 0.8) return '#991B1B'
  if (riskScore >= 0.6) return '#9A3412'
  if (riskScore >= 0.4) return '#854D0E'
  return '#15803D'
}

// Format address for display
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Create tooltip content
function createTooltip(
  address: string,
  riskScore?: number,
  tags?: string[],
  transferCount?: number,
  direction?: string
): string {
  const lines = [
    `<strong>Address:</strong> ${address}`,
    riskScore !== undefined
      ? `<strong>Risk Score:</strong> ${riskScore.toFixed(2)}`
      : '',
    tags && tags.length > 0 ? `<strong>Tags:</strong> ${tags.join(', ')}` : '',
    transferCount !== undefined
      ? `<strong>Transfers:</strong> ${transferCount}`
      : '',
    direction ? `<strong>Direction:</strong> ${direction}` : '',
  ].filter(Boolean)

  return `<div style="padding: 8px; max-width: 300px;">${lines.join('<br/>')}</div>`
}

export function AddressGraph({
  centerAddress,
  neighbors,
  onNodeClick,
  onNodeDoubleClick,
  height = '500px',
  className = '',
}: AddressGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  // Build graph data
  const buildGraphData = useCallback(() => {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeSet = new Set<string>()

    // Add center node
    nodes.push({
      id: centerAddress,
      label: formatAddress(centerAddress),
      title: createTooltip(centerAddress),
      color: {
        background: '#3B82F6',
        border: '#1D4ED8',
      },
      size: 30,
      font: { color: '#FFFFFF' },
      borderWidth: 3,
    })
    nodeSet.add(centerAddress)

    // Add neighbor nodes and edges
    neighbors.forEach((neighbor, index) => {
      if (!nodeSet.has(neighbor.address)) {
        nodes.push({
          id: neighbor.address,
          label: formatAddress(neighbor.address),
          title: createTooltip(
            neighbor.address,
            neighbor.riskScore,
            neighbor.tags,
            neighbor.transferCount,
            neighbor.direction
          ),
          color: {
            background: getRiskColor(neighbor.riskScore),
            border: getRiskBorderColor(neighbor.riskScore),
          },
          size: Math.min(25, 15 + neighbor.transferCount * 0.5),
          borderWidth: 2,
        })
        nodeSet.add(neighbor.address)
      }

      // Create edge based on direction
      const edgeId = `edge-${index}`
      if (neighbor.direction === 'incoming') {
        edges.push({
          id: edgeId,
          from: neighbor.address,
          to: centerAddress,
          arrows: 'to',
          title: `${neighbor.transferCount} transfers`,
          width: Math.min(5, 1 + neighbor.transferCount * 0.2),
          color: { color: '#10B981' },
        })
      } else if (neighbor.direction === 'outgoing') {
        edges.push({
          id: edgeId,
          from: centerAddress,
          to: neighbor.address,
          arrows: 'to',
          title: `${neighbor.transferCount} transfers`,
          width: Math.min(5, 1 + neighbor.transferCount * 0.2),
          color: { color: '#EF4444' },
        })
      } else {
        // Both directions
        edges.push({
          id: edgeId,
          from: centerAddress,
          to: neighbor.address,
          arrows: 'to;from',
          title: `${neighbor.transferCount} transfers`,
          width: Math.min(5, 1 + neighbor.transferCount * 0.2),
          color: { color: '#6B7280' },
        })
      }
    })

    return { nodes, edges }
  }, [centerAddress, neighbors])

  // Initialize network
  useEffect(() => {
    if (!containerRef.current) return

    const { nodes, edges } = buildGraphData()

    const nodesDataSet = new DataSet(nodes)
    const edgesDataSet = new DataSet(edges)

    const options: Options = {
      nodes: {
        shape: 'dot',
        font: {
          size: 12,
          color: '#374151',
        },
        borderWidth: 2,
        shadow: true,
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.5,
        },
        shadow: true,
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 150,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: {
          enabled: true,
          iterations: 100,
          updateInterval: 25,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true,
      },
      layout: {
        improvedLayout: true,
      },
    }

    const network = new Network(
      containerRef.current,
      { nodes: nodesDataSet, edges: edgesDataSet },
      options
    )

    // Event handlers
    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        setSelectedNode(nodeId)
        onNodeClick?.(nodeId)
      } else {
        setSelectedNode(null)
      }
    })

    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        onNodeDoubleClick?.(nodeId)
      }
    })

    // Stabilization complete
    network.on('stabilizationIterationsDone', () => {
      network.setOptions({ physics: { enabled: false } })
    })

    networkRef.current = network

    return () => {
      network.destroy()
      networkRef.current = null
    }
  }, [buildGraphData, onNodeClick, onNodeDoubleClick])

  return (
    <div className={className}>
      <div
        ref={containerRef}
        style={{ height, width: '100%' }}
        className="border border-gray-200 rounded-lg bg-gray-50"
      />
      {selectedNode && (
        <div className="mt-2 text-sm text-gray-600">
          Selected: <span className="font-mono">{selectedNode}</span>
        </div>
      )}
    </div>
  )
}

// Legend component
export function GraphLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-700" />
        <span>Center Address</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-700" />
        <span>Low Risk (&lt;0.4)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-yellow-700" />
        <span>Medium Risk (0.4-0.6)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-orange-700" />
        <span>High Risk (0.6-0.8)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-700" />
        <span>Critical Risk (&gt;0.8)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0.5 bg-green-500" />
        <span>Incoming</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-0.5 bg-red-500" />
        <span>Outgoing</span>
      </div>
    </div>
  )
}
