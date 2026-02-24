"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as d3 from "d3";
import type { Agent } from "@/data/agents";

interface PolarPair {
  domain: string;
  agents: string[];
  tension: string;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "agent" | "domain" | "concept" | "theorem";
  color: string;
  radius: number;
  collapsed?: boolean;
  domain?: string;
  agentData?: Agent;
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: "polar" | "domain" | "cites" | "verifies";
  label?: string;
}

interface SelectedItem {
  kind: "node" | "edge";
  node?: GraphNode;
  edge?: GraphEdge;
}

const concepts: { id: string; label: string; domain: string }[] = [
  { id: "c-decoherence", label: "Decoherence", domain: "Quantum Foundations" },
  { id: "c-born-rule", label: "Born Rule", domain: "Quantum Foundations" },
  { id: "c-measurement", label: "Measurement Problem", domain: "Quantum Foundations" },
  { id: "c-spin-networks", label: "Spin Networks", domain: "Quantum Gravity" },
  { id: "c-ads-cft", label: "AdS/CFT", domain: "Quantum Gravity" },
  { id: "c-renormalization", label: "Renormalization", domain: "Quantum Field Theory" },
  { id: "c-symmetry-breaking", label: "Symmetry Breaking", domain: "Quantum Field Theory" },
  { id: "c-incompleteness", label: "Incompleteness", domain: "Foundations of Mathematics" },
  { id: "c-type-theory", label: "Type Theory", domain: "Foundations of Mathematics" },
  { id: "c-hard-problem", label: "Hard Problem", domain: "Philosophy of Mind" },
  { id: "c-iit", label: "IIT (Phi)", domain: "Philosophy of Mind" },
  { id: "c-lean4", label: "Lean 4", domain: "Foundations of Mathematics" },
  { id: "c-background-indep", label: "Background Independence", domain: "Quantum Gravity" },
  { id: "c-path-integral", label: "Path Integral", domain: "Quantum Field Theory" },
];

function edgeNodeId(n: string | GraphNode): string {
  return typeof n === "string" ? n : n.id;
}

export default function KnowledgeClient({
  agents,
  domainColors,
  polarPairs,
}: {
  agents: Agent[];
  domainColors: Record<string, string>;
  polarPairs: PolarPair[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);

  const allNodes = useMemo(() => {
    const nodes: GraphNode[] = [];
    const domains = Object.keys(domainColors);
    domains.forEach((domain) => {
      nodes.push({
        id: `d-${domain}`,
        label: domain,
        type: "domain",
        color: domainColors[domain],
        radius: 22,
        domain,
      });
    });
    agents.forEach((agent) => {
      nodes.push({
        id: agent.id,
        label: agent.name,
        type: "agent",
        color: agent.color,
        radius: 14,
        domain: agent.domain,
        agentData: agent,
      });
    });
    concepts.forEach((concept) => {
      nodes.push({
        id: concept.id,
        label: concept.label,
        type: "concept",
        color: domainColors[concept.domain] || "#64748b",
        radius: 9,
        domain: concept.domain,
      });
    });
    return nodes;
  }, [agents, domainColors]);

  const allEdges = useMemo(() => {
    const edges: GraphEdge[] = [];
    agents.forEach((agent) => {
      edges.push({ source: agent.id, target: `d-${agent.domain}`, type: "domain" });
    });
    polarPairs.forEach((pair) => {
      edges.push({ source: pair.agents[0], target: pair.agents[1], type: "polar", label: pair.tension });
    });
    concepts.forEach((concept) => {
      edges.push({ source: concept.id, target: `d-${concept.domain}`, type: "cites" });
    });
    edges.push({ source: "c-type-theory", target: "c-measurement", type: "cites" });
    edges.push({ source: "c-iit", target: "c-decoherence", type: "cites" });
    edges.push({ source: "c-incompleteness", target: "c-hard-problem", type: "cites" });
    edges.push({ source: "c-spin-networks", target: "c-background-indep", type: "verifies" });
    edges.push({ source: "c-path-integral", target: "c-renormalization", type: "verifies" });
    return edges;
  }, [agents, polarPairs]);

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matched = new Set<string>();
    for (const n of allNodes) {
      if (n.label.toLowerCase().includes(q) || (n.domain && n.domain.toLowerCase().includes(q)) || n.type.includes(q)) {
        matched.add(n.id);
      }
    }
    return matched;
  }, [searchQuery, allNodes]);

  const toggleCollapse = useCallback((domainId: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return next;
    });
  }, []);

  // Main D3 simulation setup — depends on structure changes (nodes, edges, collapsed domains)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let width = svg.clientWidth || 900;
    let height = svg.clientHeight || 600;

    // Filter nodes/edges based on collapsed domains
    const visibleNodeIds = new Set<string>();
    const nodes: GraphNode[] = allNodes
      .filter((n) => {
        if (n.type === "domain") { visibleNodeIds.add(n.id); return true; }
        const domainId = `d-${n.domain}`;
        if (collapsedDomains.has(domainId)) return false;
        visibleNodeIds.add(n.id);
        return true;
      })
      .map((n) => ({ ...n }));

    const edges: GraphEdge[] = allEdges
      .filter((e) => {
        const srcId = typeof e.source === "string" ? e.source : e.source.id;
        const tgtId = typeof e.target === "string" ? e.target : e.target.id;
        return visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId);
      })
      .map((e) => ({
        source: typeof e.source === "string" ? e.source : e.source.id,
        target: typeof e.target === "string" ? e.target : e.target.id,
        type: e.type,
        label: e.label,
      }));

    const d3svg = d3.select(svg);
    d3svg.selectAll("*").remove();

    const g = d3svg.append("g");

    // Zoom & pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    d3svg.call(zoom);

    // Arrow markers
    const defs = d3svg.append("defs");
    ["domain", "polar", "cites", "verifies"].forEach((t) => {
      defs.append("marker")
        .attr("id", `arrow-${t}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", t === "polar" ? "rgba(245,158,11,0.4)" : t === "verifies" ? "rgba(16,185,129,0.3)" : "rgba(100,116,139,0.3)");
    });

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphEdge>(edges).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.radius + 8));

    simulationRef.current = simulation;

    // Draw edges with arrow markers applied
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup.selectAll<SVGLineElement, GraphEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => {
        if (d.type === "polar") return "rgba(245, 158, 11, 0.35)";
        if (d.type === "verifies") return "rgba(16, 185, 129, 0.25)";
        return "rgba(100, 116, 139, 0.2)";
      })
      .attr("stroke-width", (d) => d.type === "polar" ? 2 : 1)
      .attr("stroke-dasharray", (d) => d.type === "polar" ? "6 4" : "")
      .attr("marker-end", (d) => `url(#arrow-${d.type})`)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        setSelectedItem({ kind: "edge", edge: d });
      });

    // Draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup.selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Store node selection ref for search highlight updates
    nodeSelectionRef.current = node;

    // Node glow for domains
    node.filter((d) => d.type === "domain")
      .append("circle")
      .attr("r", (d) => d.radius * 2.5)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.08);

    // Node circle
    node.append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.type === "concept" ? d.color + "70" : d.color)
      .attr("stroke", (d) => d.type === "domain" ? d.color : "none")
      .attr("stroke-width", (d) => d.type === "domain" ? 2 : 0)
      .attr("class", "node-circle");

    // Collapse indicator for domains
    node.filter((d) => d.type === "domain")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("pointer-events", "none")
      .text((d) => collapsedDomains.has(d.id) ? "+" : "−");

    // Node label
    node.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 14)
      .attr("fill", "#e2e8f0")
      .attr("font-size", (d) => d.type === "domain" ? "11px" : d.type === "agent" ? "9px" : "8px")
      .attr("font-weight", (d) => d.type === "domain" || d.type === "agent" ? "bold" : "normal")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    // Click handlers
    node.on("click", (_event, d) => {
      if (d.type === "domain") {
        toggleCollapse(d.id);
      }
      setSelectedItem({ kind: "node", node: d });
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Respond to container resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0 && (newWidth !== width || newHeight !== height)) {
          width = newWidth;
          height = newHeight;
          simulation.force("center", d3.forceCenter(width / 2, height / 2));
          simulation.alpha(0.3).restart();
        }
      }
    });
    resizeObserver.observe(svg);

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [allNodes, allEdges, collapsedDomains, toggleCollapse]);

  // Separate effect for search highlight — only updates styling, doesn't recreate the graph
  useEffect(() => {
    const node = nodeSelectionRef.current;
    if (!node) return;

    if (searchQuery.length >= 2 && searchResults.size > 0) {
      node.select(".node-circle")
        .attr("stroke", (d) => searchResults.has(d.id) ? "#fbbf24" : d.type === "domain" ? d.color : "none")
        .attr("stroke-width", (d) => searchResults.has(d.id) ? 3 : d.type === "domain" ? 2 : 0);
    } else {
      node.select(".node-circle")
        .attr("stroke", (d) => d.type === "domain" ? d.color : "none")
        .attr("stroke-width", (d) => d.type === "domain" ? 2 : 0);
    }
  }, [searchQuery, searchResults]);

  const connectedEdges = selectedItem?.kind === "node" && selectedItem.node
    ? allEdges.filter((e) => {
        const nodeId = selectedItem.node?.id;
        return edgeNodeId(e.source) === nodeId || edgeNodeId(e.target) === nodeId;
      })
    : [];

  return (
    <div className="page-enter p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-sm text-[var(--text-secondary)]">Interactive visualization of agents, domains, concepts, and their relationships</p>
        </div>
        {/* Global search bar */}
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search agents, concepts, domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input text-sm w-full"
            aria-label="Search agents, concepts, and domains in the knowledge graph"
          />
          {searchQuery.length >= 2 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
              {searchResults.size} match{searchResults.size !== 1 ? "es" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="glass-card p-4 flex flex-wrap gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-[var(--accent-indigo)]" />
          <span className="text-[var(--text-secondary)]">Domain (click to collapse/expand)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--accent-emerald)]" />
          <span className="text-[var(--text-secondary)]">Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
          <span className="text-[var(--text-secondary)]">Concept</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 border-t-2 border-dashed border-[var(--accent-amber)]" />
          <span className="text-[var(--text-secondary)]">Polar Tension</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 border-t border-[var(--border-primary)]" />
          <span className="text-[var(--text-secondary)]">Domain Link</span>
        </div>
      </div>

      {/* Graph + side panel */}
      <div className="flex gap-4">
        <div className="glass-card overflow-hidden flex-1" style={{ height: 600 }}>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-crosshair"
            role="img"
            aria-label="Interactive knowledge graph showing agents, domains, concepts, and their relationships"
            tabIndex={0}
          />
        </div>

        {/* Side panel */}
        {selectedItem && (
          <div className="glass-card p-4 w-80 shrink-0 overflow-y-auto" style={{ maxHeight: 600 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">
                {selectedItem.kind === "node" ? "Node Details" : "Edge Details"}
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none"
                aria-label="Close details panel"
              >
                &times;
              </button>
            </div>

            {selectedItem.kind === "node" && selectedItem.node && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: selectedItem.node.color }} />
                  <span className="font-bold">{selectedItem.node.label}</span>
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  <span className="badge bg-[var(--bg-elevated)]">{selectedItem.node.type}</span>
                </div>
                {selectedItem.node.domain && (
                  <div>
                    <span className="text-xs text-[var(--text-muted)]">Domain: </span>
                    <span className="text-xs">{selectedItem.node.domain}</span>
                  </div>
                )}
                {selectedItem.node.agentData && (
                  <div className="space-y-2 border-t border-[var(--border-primary)] pt-3 mt-3">
                    <div><span className="text-xs text-[var(--text-muted)]">Title: </span><span className="text-xs">{selectedItem.node.agentData.title}</span></div>
                    <div><span className="text-xs text-[var(--text-muted)]">Subfield: </span><span className="text-xs">{selectedItem.node.agentData.subfield}</span></div>
                    <div><span className="text-xs text-[var(--text-muted)]">Stance: </span><span className="text-xs">{selectedItem.node.agentData.epistemicStance}</span></div>
                    <div><span className="text-xs text-[var(--text-muted)]">Verification: </span><span className="text-xs">{selectedItem.node.agentData.verificationStandard}</span></div>
                    <div><span className="text-xs text-[var(--text-muted)]">Approach: </span><span className="text-xs">{selectedItem.node.agentData.approach}</span></div>
                    <div>
                      <span className="text-xs text-[var(--text-muted)]">Formalisms: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(selectedItem.node.agentData.formalisms as string[]).map((f) => (
                          <span key={f} className="badge bg-[var(--bg-elevated)] text-[var(--text-secondary)]" style={{ fontSize: 9 }}>{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div className="glass-card p-2 text-center">
                        <div className="font-mono text-[var(--accent-teal)]">{selectedItem.node.agentData.reputationScore}</div>
                        <div className="text-[var(--text-muted)]">Reputation</div>
                      </div>
                      <div className="glass-card p-2 text-center">
                        <div className="font-mono text-[var(--accent-gold)]">{selectedItem.node.agentData.verifiedClaims}</div>
                        <div className="text-[var(--text-muted)]">Verified</div>
                      </div>
                    </div>
                  </div>
                )}
                {connectedEdges.length > 0 && (
                  <div className="border-t border-[var(--border-primary)] pt-3 mt-3">
                    <div className="text-xs text-[var(--text-muted)] mb-2">Connections ({connectedEdges.length}):</div>
                    <div className="space-y-1">
                      {connectedEdges.slice(0, 10).map((e, i) => {
                        const srcId = edgeNodeId(e.source);
                        const tgtId = edgeNodeId(e.target);
                        const otherId = srcId === selectedItem.node?.id ? tgtId : srcId;
                        const otherNode = allNodes.find((n) => n.id === otherId);
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="badge bg-[var(--bg-elevated)]" style={{ fontSize: 8 }}>{e.type}</span>
                            <span>{otherNode?.label || otherId}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedItem.kind === "edge" && selectedItem.edge && (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Type: </span>
                  <span className="badge bg-[var(--bg-elevated)]">{selectedItem.edge.type}</span>
                </div>
                {selectedItem.edge.label && (
                  <div>
                    <span className="text-xs text-[var(--text-muted)]">Tension: </span>
                    <span className="text-xs">{selectedItem.edge.label}</span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Source: </span>
                  <span className="text-xs">{allNodes.find((n) => n.id === edgeNodeId(selectedItem.edge!.source))?.label || edgeNodeId(selectedItem.edge.source)}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Target: </span>
                  <span className="text-xs">{allNodes.find((n) => n.id === edgeNodeId(selectedItem.edge!.target))?.label || edgeNodeId(selectedItem.edge.target)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Domain breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(domainColors).map(([domain, color]) => {
          const domainAgents = agents.filter((a) => a.domain === domain);
          const domainConcepts = concepts.filter((c) => c.domain === domain);
          return (
            <div key={domain} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <h3 className="font-semibold text-sm">{domain}</h3>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-[var(--text-muted)]">Agents:</div>
                <div className="flex flex-wrap gap-1">
                  {domainAgents.map((a) => (
                    <span key={a.id} className="badge" style={{ backgroundColor: `color-mix(in srgb, ${a.color} 15%, transparent)`, color: a.color, fontSize: 10 }}>
                      {a.name}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2">Key Concepts:</div>
                <div className="flex flex-wrap gap-1">
                  {domainConcepts.map((c) => (
                    <span key={c.id} className="badge bg-[var(--bg-elevated)] text-[var(--text-secondary)]" style={{ fontSize: 10 }}>
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
