import Plot from 'react-plotly.js';
import { BarChart2, LineChart, PieChart, ScatterChart, Download, Maximize2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ChartViewerProps {
  config: any;
  isDarkMode?: boolean;
}

const CHART_META: Record<string, { label: string; icon: any; color: string }> = {
  bar:       { label: 'Bar Chart',    icon: BarChart2,    color: '#818cf8' },
  line:      { label: 'Line Chart',   icon: LineChart,    color: '#34d399' },
  scatter:   { label: 'Scatter Plot', icon: ScatterChart, color: '#f472b6' },
  pie:       { label: 'Donut Chart',  icon: PieChart,     color: '#fbbf24' },
  histogram: { label: 'Histogram',    icon: BarChart2,    color: '#60a5fa' },
};

const PALETTE = [
  '#818cf8','#a78bfa','#f472b6','#34d399',
  '#fbbf24','#60a5fa','#f87171','#fb923c',
  '#4ade80','#38bdf8',
];

export default function ChartViewer({ config }: ChartViewerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!config || !config.data || !config.layout) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500 rounded-2xl border border-dashed border-slate-700/50 bg-slate-900/30">
        <BarChart2 size={32} className="opacity-30" />
        <p className="text-sm">No chart data available</p>
      </div>
    );
  }

  const chartType = config.data[0]?.type ?? 'bar';
  const meta = CHART_META[chartType] ?? { label: 'Chart', icon: BarChart2, color: '#818cf8' };
  const Icon = meta.icon;

  /* ── Inject full dark-mode aesthetics into layout ── */
  const layout: any = {
    ...config.layout,
    autosize: true,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    font: {
      family: '"Inter", "Roboto", sans-serif',
      color:  '#94a3b8',
      size:   12,
      ...(config.layout?.font ?? {}),
    },
    title: {
      ...(config.layout?.title ?? {}),
      font: {
        size:   17,
        color:  '#e2e8f0',
        family: '"Inter", "Roboto", sans-serif',
        ...(config.layout?.title?.font ?? {}),
      },
      x: config.layout?.title?.x ?? 0.03,
      xanchor: 'left',
    },
    margin:  { t: 65, r: 30, b: 85, l: 75, pad: 4, ...(config.layout?.margin ?? {}) },
    legend: {
      bgcolor:     'rgba(15,23,42,0.85)',
      bordercolor: 'rgba(148,163,184,0.15)',
      borderwidth: 1,
      font:        { color: '#cbd5e1', size: 11 },
      ...(config.layout?.legend ?? {}),
    },
    xaxis: {
      gridcolor:     'rgba(148,163,184,0.07)',
      linecolor:     'rgba(148,163,184,0.15)',
      zerolinecolor: 'rgba(148,163,184,0.15)',
      tickfont:      { color: '#94a3b8', size: 11 },
      automargin:    true,
      zeroline:      false,
      ...(config.layout?.xaxis ?? {}),
      title: {
        font: { color: '#cbd5e1', size: 12 },
        ...(config.layout?.xaxis?.title ?? {}),
      },
    },
    yaxis: {
      gridcolor:     'rgba(148,163,184,0.07)',
      linecolor:     'rgba(148,163,184,0.15)',
      zerolinecolor: 'rgba(148,163,184,0.15)',
      tickfont:      { color: '#94a3b8', size: 11 },
      automargin:    true,
      zeroline:      false,
      ...(config.layout?.yaxis ?? {}),
      title: {
        font: { color: '#cbd5e1', size: 12 },
        ...(config.layout?.yaxis?.title ?? {}),
      },
    },
    bargap:  config.layout?.bargap ?? 0.28,
    hoverlabel: {
      bgcolor:     'rgba(15,23,42,0.95)',
      bordercolor: 'rgba(129,140,248,0.5)',
      font:        { color: '#e2e8f0', size: 12, family: '"Inter", sans-serif' },
    },
    modebar: {
      bgcolor:     'rgba(0,0,0,0)',
      color:       '#475569',
      activecolor: '#818cf8',
    },
  };

  /* ── Ensure vibrant palette if LLM skipped it ── */
  const data = config.data.map((trace: any) => {
    if (trace.type === 'bar' && !trace.marker?.color) {
      return {
        ...trace,
        marker: {
          ...trace.marker,
          color:   PALETTE,
          opacity: 0.9,
          line:    { color: 'rgba(0,0,0,0.1)', width: 1 },
        },
      };
    }
    if (trace.type === 'pie' && !trace.marker?.colors) {
      return {
        ...trace,
        hole:   trace.hole ?? 0.42,
        marker: { ...trace.marker, colors: PALETTE, line: { color: 'rgba(15,23,42,0.6)', width: 2 } },
        textfont: { color: '#e2e8f0' },
      };
    }
    if ((trace.type === 'line' || trace.type === 'scatter') && !trace.line?.color) {
      return {
        ...trace,
        line:   { color: '#818cf8', width: 2.5, ...(trace.line ?? {}) },
        marker: { color: '#818cf8', size: 7, line: { color: '#fff', width: 1 }, ...(trace.marker ?? {}) },
      };
    }
    return trace;
  });

  const handleDownload = () => {
    const el = document.querySelector('#plotly-chart-canvas .js-plotly-plot');
    if ((window as any).Plotly && el) {
      (window as any).Plotly.downloadImage(el, {
        format: 'png', filename: 'chart', width: 1400, height: 720, scale: 2,
      });
    }
  };

  const chartHeight = expanded ? 560 : 420;

  return (
    <div className="w-full flex flex-col gap-3 animate-scale-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="chart-badge"
            style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}18` }}
          >
            <Icon size={10} />
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse' : 'Expand'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-200"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={handleDownload}
            title="Download PNG"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-all duration-200"
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* ── Chart Canvas ── */}
      <div
        className="chart-container w-full transition-all duration-500"
        style={{ height: `${chartHeight}px` }}
      >
        {/* Decorative corner dots */}
        <div className="absolute top-3 left-3 flex gap-1.5 z-10">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>

        <div
          id="plotly-chart-canvas"
          className="w-full h-full pt-3"
        >
          <Plot
            data={data}
            layout={layout}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{
              displayModeBar:          true,
              displaylogo:             false,
              responsive:              true,
              modeBarButtonsToRemove:  ['lasso2d', 'select2d', 'autoScale2d', 'resetScale2d'],
              toImageButtonOptions:    { format: 'png', filename: 'chart', scale: 2 },
            }}
          />
        </div>
      </div>

      {/* ── Footer note ── */}
      <p className="text-[10px] text-slate-600 text-right flex items-center justify-end gap-1">
        <RefreshCw size={9} />
        Generated by AI Visualization Agent
      </p>
    </div>
  );
}
