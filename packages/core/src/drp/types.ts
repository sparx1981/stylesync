export interface ColorRamp {
  base: string;
  ramp: Record<string, string>;
}

export interface DRPColor {
  palette: {
    primary: ColorRamp;
    neutral: ColorRamp;
    accent?: ColorRamp;
    success?: ColorRamp;
    warning?: ColorRamp;
    danger?: ColorRamp;
    [role: string]: ColorRamp | undefined;
  };
  semantic: Record<string, string>;
  contrast_report: {
    min_body_ratio: number;
    wcag_aa_pass: boolean;
    contrast_adjusted: boolean;
  };
}

export interface TypeStep {
  size: string;
  line: number;
  tracking: string;
  weight: number;
}

export interface DRPFont {
  role: string;
  stack: string;
  source: 'google' | 'system' | 'custom';
}

export interface DRPTypography {
  families: {
    display: { stack: string; source: 'google' | 'system' | 'custom'; weights: number[] };
    body: { stack: string; source: 'google' | 'system' | 'custom'; weights: number[] };
    mono: { stack: string; source: 'google' | 'system' | 'custom'; weights: number[] };
    // Any further distinct fonts spotted on the reference beyond the main
    // display/body pairing -- e.g. a separate wordmark/logo font, or a
    // tabular/numeric font used for stats and prices. Optional and additive,
    // so existing DRPs/consumers without this field keep working.
    additional?: DRPFont[];
  };
  scale: {
    ratio: number;
    base_px: number;
    steps: Record<string, TypeStep>;
  };
}

export interface DRPSpace {
  unit_px: number;
  scale: number[];
  section_rhythm_px: number;
}

export interface DRPShape {
  radius: Record<string, string>;
  border_widths: Record<string, string>;
}

export interface DRPElevation {
  strategy: 'border' | 'shadow' | 'mixed';
  levels: Record<string, string>;
}

export interface MotionSignature {
  trigger: string;
  target: string;
  effect: string;
  duration: number;
  stagger?: number;
}

export interface DRPMotion {
  durations: { fast: number; base: number; slow: number };
  easings: Record<string, string>;
  signatures: MotionSignature[];
  reduced_motion_fallback: string;
}

export interface DRPLayout {
  container_max_px: number;
  grid: { columns: number; gutter_px: number };
  breakpoints: Record<string, number>;
  nav_pattern: 'sidebar' | 'topbar' | 'none';
  content_alignment: 'left' | 'center';
}

export interface ComponentStateRecipe {
  [state: string]: Record<string, unknown>;
}

export interface ComponentRecipe {
  bg?: string;
  fg?: string;
  radius?: string;
  padding?: string;
  font?: string;
  elevation?: string;
  border?: string;
  states?: ComponentStateRecipe;
  [key: string]: unknown;
}

export const COMPONENT_ROLES = [
  'layout.page', 'layout.section', 'layout.sidebar', 'layout.topbar', 'layout.grid', 'layout.stack',
  'nav.primary', 'nav.secondary', 'nav.breadcrumb', 'nav.tabs', 'nav.pagination',
  'action.button.primary', 'action.button.secondary', 'action.button.ghost',
  'action.button.destructive', 'action.link', 'action.icon-button',
  'input.text', 'input.select', 'input.checkbox', 'input.radio', 'input.toggle',
  'input.textarea', 'input.search', 'input.date', 'input.file',
  'display.card', 'display.list', 'display.table', 'display.stat', 'display.badge',
  'display.avatar', 'display.chart', 'display.media', 'display.code',
  'feedback.alert', 'feedback.toast', 'feedback.empty', 'feedback.loading',
  'feedback.error', 'feedback.progress', 'feedback.skeleton',
  'overlay.modal', 'overlay.drawer', 'overlay.popover', 'overlay.tooltip', 'overlay.menu',
  'typography.h1', 'typography.h2', 'typography.h3', 'typography.h4', 'typography.h5', 'typography.h6',
  'typography.body', 'typography.caption', 'typography.label', 'typography.mono',
] as const;
export type ComponentRole = typeof COMPONENT_ROLES[number];

export interface DRP {
  drp_version: 1;
  ref_id: string;
  provenance: {
    source: string;
    origin_url: string;
    creator_credit: string;
    captured_at: string;
    extraction_method: 'computed_css' | 'figma_api' | 'vision_inferred';
    confidence: number;
  };
  identity: {
    name: string;
    descriptors: string[];
    theme_mode: 'light' | 'dark';
    density: 'compact' | 'comfortable' | 'spacious';
    character: string;
  };
  color: DRPColor;
  typography: DRPTypography;
  space: DRPSpace;
  shape: DRPShape;
  elevation: DRPElevation;
  motion: DRPMotion;
  layout: DRPLayout;
  components: Partial<Record<ComponentRole, ComponentRecipe>>;
  anti_patterns: string[];
  assets_policy: { may_emit_fonts: boolean; may_emit_images: boolean; may_emit_icons: boolean };
}
