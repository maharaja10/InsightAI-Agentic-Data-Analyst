/**
 * plotlyTheme.ts
 * Centralized Plotly layout theme for InsightAI.
 * Import applyPlotlyTheme(layout, isDark) in any chart component.
 */

const FONT_FAMILY = '"Inter", "Roboto", ui-sans-serif, sans-serif';

/** Vibrant trace palette shared across both themes */
export const PALETTE = [
  '#818cf8', '#a78bfa', '#f472b6', '#34d399',
  '#fbbf24', '#60a5fa', '#f87171', '#fb923c',
  '#4ade80', '#38bdf8',
];

function getTheme(isDark: boolean) {
  if (isDark) {
    return {
      paper_bgcolor:  'rgba(0,0,0,0)',
      plot_bgcolor:   'rgba(0,0,0,0)',
      fontColor:      '#94a3b8',
      titleColor:     '#e2e8f0',
      legend: {
        bgcolor: 'rgba(15,23,42,0.85)', bordercolor: 'rgba(148,163,184,0.15)',
        borderwidth: 1, font: { color: '#cbd5e1', size: 11 },
      },
      hoverlabel: {
        bgcolor: 'rgba(15,23,42,0.95)', bordercolor: 'rgba(129,140,248,0.5)',
        font: { color: '#e2e8f0', size: 12, family: FONT_FAMILY },
      },
      modebar: { bgcolor: 'rgba(0,0,0,0)', color: '#475569', activecolor: '#818cf8' },
      gridcolor:     'rgba(148,163,184,0.07)',
      linecolor:     'rgba(148,163,184,0.15)',
      zerolinecolor: 'rgba(148,163,184,0.15)',
      tickColor:     '#94a3b8',
      axisTitleColor:'#cbd5e1',
      lineColor:     '#818cf8',
      markerBorder:  '#ffffff',
      pieText:       '#e2e8f0',
      pieBorder:     'rgba(15,23,42,0.6)',
    };
  }
  return {
    paper_bgcolor:  '#ffffff',
    plot_bgcolor:   '#f8fafc',
    fontColor:      '#475569',
    titleColor:     '#1e293b',
    legend: {
      bgcolor: 'rgba(255,255,255,0.92)', bordercolor: 'rgba(100,116,139,0.2)',
      borderwidth: 1, font: { color: '#475569', size: 11 },
    },
    hoverlabel: {
      bgcolor: 'rgba(255,255,255,0.97)', bordercolor: 'rgba(99,102,241,0.4)',
      font: { color: '#1e293b', size: 12, family: FONT_FAMILY },
    },
    modebar: { bgcolor: 'rgba(255,255,255,0)', color: '#94a3b8', activecolor: '#6366f1' },
    gridcolor:     'rgba(100,116,139,0.12)',
    linecolor:     'rgba(100,116,139,0.2)',
    zerolinecolor: 'rgba(100,116,139,0.2)',
    tickColor:     '#64748b',
    axisTitleColor:'#334155',
    lineColor:     '#6366f1',
    markerBorder:  '#f8fafc',
    pieText:       '#1e293b',
    pieBorder:     'rgba(255,255,255,0.8)',
  };
}

/** Merges a base layout with the correct Plotly theme. Theme colours always win. */
export function applyPlotlyTheme(baseLayout: any = {}, isDark: boolean): any {
  const t = getTheme(isDark);

  const mergeAxis = (key: 'xaxis' | 'yaxis') => ({
    gridcolor: t.gridcolor, linecolor: t.linecolor,
    zerolinecolor: t.zerolinecolor, zeroline: false, automargin: true,
    tickfont: { color: t.tickColor, size: 11 },
    ...baseLayout[key],
    title: { font: { color: t.axisTitleColor, size: 12 }, ...(baseLayout[key]?.title ?? {}) },
  });

  return {
    ...baseLayout,
    autosize:      true,
    paper_bgcolor: t.paper_bgcolor,
    plot_bgcolor:  t.plot_bgcolor,
    font:          { family: FONT_FAMILY, color: t.fontColor, size: 12, ...(baseLayout.font ?? {}) },
    title: {
      ...(baseLayout.title ?? {}),
      font: { family: FONT_FAMILY, size: 17, color: t.titleColor, ...(baseLayout.title?.font ?? {}) },
      x: baseLayout.title?.x ?? 0.03,
      xanchor: 'left',
    },
    margin:     { t: 65, r: 30, b: 85, l: 75, pad: 4, ...(baseLayout.margin ?? {}) },
    legend:     { ...t.legend,     ...(baseLayout.legend     ?? {}) },
    hoverlabel: { ...t.hoverlabel },
    modebar:    { ...t.modebar },
    xaxis:      mergeAxis('xaxis'),
    yaxis:      mergeAxis('yaxis'),
    bargap:     baseLayout.bargap ?? 0.28,
  };
}

/** Applies theme-aware default colours to traces that have none. */
export function applyPlotlyTraceTheme(traces: any[], isDark: boolean): any[] {
  const t = getTheme(isDark);
  return traces.map((trace: any) => {
    if (trace.type === 'bar' && !trace.marker?.color) {
      return { ...trace, marker: { ...trace.marker, color: PALETTE, opacity: 0.9, line: { color: 'rgba(0,0,0,0.08)', width: 1 } } };
    }
    if (trace.type === 'pie' && !trace.marker?.colors) {
      return { ...trace, hole: trace.hole ?? 0.42,
        marker: { ...trace.marker, colors: PALETTE, line: { color: t.pieBorder, width: 2 } },
        textfont: { color: t.pieText } };
    }
    if ((trace.type === 'line' || trace.type === 'scatter') && !trace.line?.color) {
      return { ...trace,
        line:   { color: t.lineColor, width: 2.5, ...(trace.line   ?? {}) },
        marker: { color: t.lineColor, size: 7, line: { color: t.markerBorder, width: 1.5 }, ...(trace.marker ?? {}) } };
    }
    return trace;
  });
}
