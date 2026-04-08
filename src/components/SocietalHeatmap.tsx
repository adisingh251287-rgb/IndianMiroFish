import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ImpactPoint, Agent } from '../types';
import { motion } from 'motion/react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SocietalHeatmapProps {
  points: ImpactPoint[];
  agents: Agent[];
}

export const SocietalHeatmap: React.FC<SocietalHeatmapProps> = ({ points, agents }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll("*").remove();

    // Create a color scale for sentiment
    // -1 (Red/Negative) to 0 (Neutral/Gray) to 1 (Green/Positive)
    const colorScale = d3.scaleLinear<string>()
      .domain([-1, 0, 1])
      .range(["#ef4444", "#334155", "#22c55e"]);

    // Add a defs section for gradients/filters
    const defs = svg.append("defs");

    // Create a radial gradient for each point to simulate "spread"
    points.forEach((point, i) => {
      const gradientId = `grad-${i}`;
      const radialGradient = defs.append("radialGradient")
        .attr("id", gradientId)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%");

      radialGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale(point.value))
        .attr("stop-opacity", 0.6);

      radialGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale(point.value))
        .attr("stop-opacity", 0);
    });

    // Draw the heatmap "blobs"
    svg.selectAll(".impact-blob")
      .data(points)
      .enter()
      .append("circle")
      .attr("class", "impact-blob")
      .attr("cx", (d: ImpactPoint) => d.x * width)
      .attr("cy", (d: ImpactPoint) => d.y * height)
      .attr("r", width * 0.15)
      .attr("fill", (_, i) => `url(#grad-${i})`)
      .style("mix-blend-mode", "screen");

    // Add labels for segments
    svg.selectAll(".segment-label")
      .data(points)
      .enter()
      .append("text")
      .attr("class", "segment-label")
      .attr("x", (d: ImpactPoint) => d.x * width)
      .attr("y", (d: ImpactPoint) => d.y * height)
      .attr("dy", -5)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "8px")
      .attr("font-weight", "bold")
      .attr("text-transform", "uppercase")
      .attr("letter-spacing", "0.1em")
      .style("opacity", 0.4)
      .text((d: ImpactPoint) => d.label);

    // Draw the agents as "anchors" in this space
    const agentNodes = svg.selectAll(".agent-node")
      .data(agents)
      .enter()
      .append("g")
      .attr("class", "agent-node")
      .attr("transform", (d: Agent) => `translate(${d.location.x * width}, ${d.location.y * height})`);

    agentNodes.append("circle")
      .attr("r", 4)
      .attr("fill", (d: Agent) => d.color)
      .attr("stroke", "white")
      .attr("stroke-width", 1);

    agentNodes.append("text")
      .attr("dy", 15)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "8px")
      .style("opacity", 0.8)
      .text((d: Agent) => d.name);

  }, [points, agents]);

  return (
    <div className="relative w-full aspect-square md:aspect-video bg-slate-900/50 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl">
      <div className="absolute top-6 left-8 z-10 flex items-start gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4e00] mb-1">Societal Sentiment Heatmap</h4>
          <p className="text-[10px] opacity-40 uppercase tracking-widest">Geographic & Demographic Spread</p>
        </div>
        <Tooltip>
          <TooltipTrigger className="opacity-20 hover:opacity-100 transition-opacity mt-0.5">
            <Info className="w-3 h-3 text-white" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px]">
            <p>Visualizes how sentiment and adoption trends spread across different demographic segments and geographic regions based on the simulation debate.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      <div className="absolute bottom-6 right-8 z-10 flex items-center gap-4 text-[8px] uppercase tracking-widest font-bold">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="opacity-40 text-red-500">Resistance</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="opacity-40">Neutral</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="opacity-40 text-green-500">Adoption</span>
        </div>
      </div>

      <svg 
        ref={svgRef} 
        className="w-full h-full"
      />
    </div>
  );
};
