import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Habit } from '../types';
import {
  buildHabitHeatmapModel,
  DailyCompletionTrend,
  HabitHeatmapCell,
  HeatmapIntensity,
} from '../utils/habitHeatmap';

interface HabitActivityHeatmapProps {
  habits: Habit[];
  onToggleHabitDay: (habitId: string, dateKey: string) => void;
}

const INTENSITY_STYLES: Record<
  HeatmapIntensity,
  { fill: string; stroke: string; checkStroke: string; label: string }
> = {
  0: {
    fill: '#f2f3ff',
    stroke: '#dfe3f4',
    checkStroke: 'transparent',
    label: 'Missed',
  },
  1: {
    fill: '#a7f3d0',
    stroke: '#6ee7b7',
    checkStroke: '#065f46',
    label: 'Building',
  },
  2: {
    fill: '#34d399',
    stroke: '#10b981',
    checkStroke: '#064e3b',
    label: 'On Track',
  },
  3: {
    fill: '#059669',
    stroke: '#047857',
    checkStroke: '#ffffff',
    label: 'Target Hit',
  },
};

function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(4, maxChars - 1)).trimEnd()}…`;
}

export const HabitActivityHeatmap: React.FC<HabitActivityHeatmapProps> = ({
  habits,
  onToggleHabitDay,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const toggleRef = useRef(onToggleHabitDay);
  toggleRef.current = onToggleHabitDay;

  const [containerWidth, setContainerWidth] = useState<number>(760);
  const [hoveredCell, setHoveredCell] = useState<{
    cell: HabitHeatmapCell;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredTrend, setHoveredTrend] = useState<{
    trend: DailyCompletionTrend;
    x: number;
    y: number;
  } | null>(null);

  const model = useMemo(() => buildHabitHeatmapModel(habits), [habits]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) {
        setContainerWidth(next);
      }
    };

    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isCompact = containerWidth < 560;
  const effectiveWidth = Math.max(460, containerWidth);
  const margin = useMemo(
    () => ({
      top: 22,
      right: 18,
      bottom: 14,
      left: isCompact ? 124 : 210,
    }),
    [isCompact]
  );

  const trendHeight = 72;
  const headerBandHeight = 32;
  const rowHeight = 40;
  const matrixHeight = Math.max(rowHeight, habits.length * rowHeight);
  const svgHeight =
    margin.top + trendHeight + headerBandHeight + matrixHeight + margin.bottom;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || habits.length === 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const innerWidth = Math.max(220, effectiveWidth - margin.left - margin.right);

    const defs = svg.append('defs');
    const areaGrad = defs
      .append('linearGradient')
      .attr('id', 'habit-trend-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.24);
    areaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.02);

    const xScale = d3
      .scaleBand<string>()
      .domain(model.days.map((d) => d.key))
      .range([0, innerWidth])
      .paddingInner(0.18)
      .paddingOuter(0.05);

    const yTrend = d3.scaleLinear().domain([0, 100]).range([trendHeight, 0]);

    const yHabit = d3
      .scaleBand<string>()
      .domain(habits.map((h) => h.id))
      .range([0, matrixHeight])
      .paddingInner(0.22);

    const colorScale = d3
      .scaleOrdinal<HeatmapIntensity, (typeof INTENSITY_STYLES)[HeatmapIntensity]>()
      .domain([0, 1, 2, 3])
      .range([
        INTENSITY_STYLES[0],
        INTENSITY_STYLES[1],
        INTENSITY_STYLES[2],
        INTENSITY_STYLES[3],
      ]);

    const root = svg
      .attr('viewBox', `0 0 ${effectiveWidth} ${svgHeight}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // =========================================================================
    // 1. 7-Day Completion Trend Sparkline & Area (D3 Line + Area + Scales)
    // =========================================================================
    const trendGroup = root.append('g').attr('class', 'habit-trend-layer');

    trendGroup
      .append('text')
      .attr('x', -14)
      .attr('y', trendHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#464554')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .text('Daily Completion %');

    const gridTicks = [0, 50, 100];
    trendGroup
      .selectAll('line.trend-grid')
      .data(gridTicks)
      .join('line')
      .attr('class', 'trend-grid')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d) => yTrend(d))
      .attr('y2', (d) => yTrend(d))
      .attr('stroke', (d) => (d === 0 ? '#dfe3f4' : '#eef0ff'))
      .attr('stroke-width', 1);

    trendGroup
      .selectAll('text.trend-tick')
      .data([0, 100])
      .join('text')
      .attr('class', 'trend-tick')
      .attr('x', -4)
      .attr('y', (d) => yTrend(d))
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#767586')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .text((d) => `${d}%`);

    const xCenter = (dateKey: string) =>
      (xScale(dateKey) ?? 0) + xScale.bandwidth() / 2;

    const areaGenerator = d3
      .area<DailyCompletionTrend>()
      .x((d) => xCenter(d.dateKey))
      .y0(trendHeight)
      .y1((d) => yTrend(d.completionRate))
      .curve(d3.curveMonotoneX);

    const lineGenerator = d3
      .line<DailyCompletionTrend>()
      .x((d) => xCenter(d.dateKey))
      .y((d) => yTrend(d.completionRate))
      .curve(d3.curveMonotoneX);

    trendGroup
      .append('path')
      .datum(model.dailyTrends)
      .attr('fill', 'url(#habit-trend-area-gradient)')
      .attr('d', areaGenerator);

    trendGroup
      .append('path')
      .datum(model.dailyTrends)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGenerator);

    const nodeGroups = trendGroup
      .selectAll('g.trend-node')
      .data(model.dailyTrends)
      .join('g')
      .attr('class', 'trend-node')
      .attr(
        'transform',
        (d) => `translate(${xCenter(d.dateKey)}, ${yTrend(d.completionRate)})`
      )
      .style('cursor', 'default');

    nodeGroups
      .append('circle')
      .attr('r', (d) => (d.isToday ? 5.5 : 4.5))
      .attr('fill', (d) => (d.isToday ? '#4648d4' : '#10b981'))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    nodeGroups
      .append('text')
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (d.isToday ? '#4648d4' : '#131b2e'))
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .text((d) => `${d.completionRate}%`);

    nodeGroups
      .append('circle')
      .attr('r', 14)
      .attr('fill', 'transparent')
      .on('mouseenter', function (_event, d) {
        setHoveredCell(null);
        setHoveredTrend({
          trend: d,
          x: margin.left + xCenter(d.dateKey),
          y: margin.top + yTrend(d.completionRate),
        });
      })
      .on('mouseleave', () => {
        setHoveredTrend(null);
      });

    // =========================================================================
    // 2. Shared Day Column Headers
    // =========================================================================
    const headerY = trendHeight + 20;
    const headerGroup = root
      .append('g')
      .attr('transform', `translate(0, ${headerY})`);

    headerGroup
      .selectAll('text.day-col-label')
      .data(model.days)
      .join('text')
      .attr('class', 'day-col-label')
      .attr('x', (d) => xCenter(d.key))
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (d.isToday ? '#4648d4' : '#464554'))
      .attr('font-size', '11px')
      .attr('font-weight', (d) => (d.isToday ? '800' : '700'))
      .text((d) => (d.isToday ? 'Today' : `${d.shortDay} ${d.dayNum}`));

    // =========================================================================
    // 3. Habit x 7-Day Activity Heat Map Matrix
    // =========================================================================
    const matrixTop = trendHeight + headerBandHeight;
    const matrixGroup = root
      .append('g')
      .attr('class', 'habit-heatmap-matrix')
      .attr('transform', `translate(0, ${matrixTop})`);

    // Subtle column highlight behind Today
    const todaySlot = model.days.find((d) => d.isToday);
    if (todaySlot) {
      const tx = xScale(todaySlot.key);
      if (tx !== undefined) {
        matrixGroup
          .append('rect')
          .attr('x', tx - 4)
          .attr('y', -4)
          .attr('width', xScale.bandwidth() + 8)
          .attr('height', matrixHeight + 8)
          .attr('rx', 12)
          .attr('fill', '#eef0ff')
          .attr('opacity', 0.65);
      }
    }

    // Left habit labels
    const maxChars = isCompact ? 16 : 26;
    const labelGroups = matrixGroup
      .selectAll('g.habit-row-label')
      .data(habits)
      .join('g')
      .attr('class', 'habit-row-label')
      .attr(
        'transform',
        (h) => `translate(-12, ${(yHabit(h.id) ?? 0) + yHabit.bandwidth() / 2})`
      );

    labelGroups
      .append('text')
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#131b2e')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .text((h) => truncateLabel(h.title, maxChars))
      .append('title')
      .text((h) => h.title);

    // Heatmap tiles
    const cellGroups = matrixGroup
      .selectAll<SVGGElement, HabitHeatmapCell>('g.heatmap-cell-group')
      .data(model.cells, (c) => `${c.habitId}-${c.dateKey}`)
      .join('g')
      .attr('class', 'heatmap-cell-group')
      .attr(
        'transform',
        (c) => `translate(${xScale(c.dateKey) ?? 0}, ${yHabit(c.habitId) ?? 0})`
      )
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr(
        'aria-label',
        (c) =>
          `${c.habitTitle} on ${c.isToday ? 'Today' : `${c.shortDay} ${c.dayNum}`}: ${
            c.completed ? 'completed' : 'not completed'
          }. Click to toggle.`
      )
      .style('cursor', 'pointer')
      .on('click', (_event, c) => {
        toggleRef.current(c.habitId, c.dateKey);
      })
      .on('keydown', (event: KeyboardEvent, c) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleRef.current(c.habitId, c.dateKey);
        }
      })
      .on('mouseenter', function (_event, c) {
        setHoveredTrend(null);
        d3.select(this)
          .select('rect.heatmap-tile')
          .attr('stroke', '#131b2e')
          .attr('stroke-width', 2);
        setHoveredCell({
          cell: c,
          x: margin.left + (xScale(c.dateKey) ?? 0) + xScale.bandwidth() / 2,
          y: margin.top + matrixTop + (yHabit(c.habitId) ?? 0),
        });
      })
      .on('mouseleave', function (_event, c) {
        const styleToken = colorScale(c.intensity);
        d3.select(this)
          .select('rect.heatmap-tile')
          .attr('stroke', !c.completed && c.isToday ? '#4648d4' : styleToken.stroke)
          .attr('stroke-width', !c.completed && c.isToday ? 1.75 : 1.25);
        setHoveredCell(null);
      })
      .on('focus', function (_event, c) {
        setHoveredTrend(null);
        setHoveredCell({
          cell: c,
          x: margin.left + (xScale(c.dateKey) ?? 0) + xScale.bandwidth() / 2,
          y: margin.top + matrixTop + (yHabit(c.habitId) ?? 0),
        });
      })
      .on('blur', () => {
        setHoveredCell(null);
      });

    const cellW = xScale.bandwidth();
    const cellH = yHabit.bandwidth();

    cellGroups
      .append('rect')
      .attr('class', 'heatmap-tile')
      .attr('width', cellW)
      .attr('height', cellH)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (c) => colorScale(c.intensity).fill)
      .attr('stroke', (c) =>
        !c.completed && c.isToday ? '#4648d4' : colorScale(c.intensity).stroke
      )
      .attr('stroke-width', (c) => (!c.completed && c.isToday ? 1.75 : 1.25));

    // Accessible non-hue completion mark inside completed cells
    cellGroups
      .filter((c) => c.completed)
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', (c) => colorScale(c.intensity).checkStroke)
      .attr('stroke-width', 2.2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('pointer-events', 'none')
      .attr('d', () => {
        const cx = cellW / 2;
        const cy = cellH / 2;
        return `M ${cx - 4.5} ${cy + 0.5} L ${cx - 1.2} ${cy + 3.8} L ${cx + 5} ${cy - 3.2}`;
      });
  }, [effectiveWidth, habits, isCompact, margin, matrixHeight, model, svgHeight]);

  const trendSummaryText =
    model.trendDeltaPct > 0
      ? `+${model.trendDeltaPct} pts vs early week`
      : model.trendDeltaPct < 0
        ? `${model.trendDeltaPct} pts vs early week`
        : 'Steady 7-day pace';

  const tooltipLeft = (rawX: number) =>
    Math.max(12, Math.min(Math.max(12, containerWidth - 248), rawX - 116));

  return (
    <section
      aria-label="7-day habit activity heat map and completion trend"
      className="arcade-card rounded-3xl p-6"
    >
      <div className="flex flex-col gap-3 border-b border-[#e8ebf8] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-[#131b2e]">
            7-Day Activity Heat Map &amp; Completion Trend
          </h2>
          <p className="mt-0.5 text-xs text-[#464554] tabular-nums">
            <span className="font-mono font-bold text-[#006c49]">
              {model.overallAdherencePct}% Weekly Target
            </span>
            <span aria-hidden="true"> · </span>
            <span>{model.dailyAveragePct}% daily avg</span>
            <span aria-hidden="true"> · </span>
            <span>{trendSummaryText}</span>
            {model.peakDay && (
              <>
                <span aria-hidden="true"> · </span>
                <span>
                  Peak {model.peakDay.isToday ? 'Today' : model.peakDay.shortDay} (
                  {model.peakDay.completionRate}%)
                </span>
              </>
            )}
          </p>
        </div>

        {/* Heat Intensity Legend */}
        <div
          className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#464554]"
          aria-label="Heat map intensity legend"
        >
          {([0, 1, 2, 3] as HeatmapIntensity[]).map((level) => (
            <span key={level} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-[4px] border"
                style={{
                  backgroundColor: INTENSITY_STYLES[level].fill,
                  borderColor: INTENSITY_STYLES[level].stroke,
                }}
              />
              <span>{INTENSITY_STYLES[level].label}</span>
            </span>
          ))}
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-bold text-[#131b2e]">
            No habit telemetry to visualize yet
          </p>
          <p className="mt-1 text-xs text-[#464554]">
            Approve an AI habit draft or add a routine below to light up your 7-day heat map and trend curve.
          </p>
        </div>
      ) : (
        <div ref={containerRef} className="relative mt-4 overflow-x-auto">
          <svg
            ref={svgRef}
            role="img"
            aria-label="D3 7-day habit consistency heat map and daily completion rate trend chart"
            className="block w-full min-w-[460px] select-none"
            style={{ height: `${svgHeight}px` }}
          />

          {hoveredCell && (
            <div
              role="status"
              className="pointer-events-none absolute z-20 w-[236px] rounded-2xl border border-[#dfe3f4] bg-[#131b2e] px-3.5 py-2.5 text-white shadow-lg"
              style={{
                left: `${tooltipLeft(hoveredCell.x)}px`,
                top: `${Math.max(6, hoveredCell.y - 78)}px`,
              }}
            >
              <p className="truncate text-xs font-bold">{hoveredCell.cell.habitTitle}</p>
              <p className="mt-0.5 text-[11px] text-[#c7c4d7] tabular-nums">
                {hoveredCell.cell.isToday
                  ? 'Today'
                  : `${hoveredCell.cell.shortDay} ${hoveredCell.cell.dayNum}`}
                {' · '}
                <span
                  className={
                    hoveredCell.cell.completed
                      ? 'font-bold text-[#34d399]'
                      : 'font-semibold text-[#fbbf24]'
                  }
                >
                  {hoveredCell.cell.completed ? 'Completed' : 'Missed (click to log)'}
                </span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#e2e7ff] tabular-nums">
                {hoveredCell.cell.weeklyHits}/{hoveredCell.cell.targetDaysPerWeek} weekly ·{' '}
                {hoveredCell.cell.streak}d streak ·{' '}
                {INTENSITY_STYLES[hoveredCell.cell.intensity].label}
              </p>
            </div>
          )}

          {hoveredTrend && (
            <div
              role="status"
              className="pointer-events-none absolute z-20 w-[210px] rounded-2xl border border-[#dfe3f4] bg-[#131b2e] px-3.5 py-2 text-white shadow-lg"
              style={{
                left: `${tooltipLeft(hoveredTrend.x)}px`,
                top: `${Math.max(6, hoveredTrend.y + 18)}px`,
              }}
            >
              <p className="text-xs font-bold tabular-nums">
                {hoveredTrend.trend.isToday
                  ? 'Today'
                  : `${hoveredTrend.trend.shortDay} ${hoveredTrend.trend.dayNum}`}{' '}
                · {hoveredTrend.trend.completionRate}%
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-[#34d399] tabular-nums">
                {hoveredTrend.trend.completedCount} of {hoveredTrend.trend.totalHabits} habits logged
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
