# Component role vocabulary (closed set — spec Appendix B)

```
layout.page, layout.section, layout.sidebar, layout.topbar, layout.grid, layout.stack
nav.primary, nav.secondary, nav.breadcrumb, nav.tabs, nav.pagination
action.button.primary, action.button.secondary, action.button.ghost,
action.button.destructive, action.link, action.icon-button
input.text, input.select, input.checkbox, input.radio, input.toggle,
input.textarea, input.search, input.date, input.file
display.card, display.list, display.table, display.stat, display.badge,
display.avatar, display.chart, display.media, display.code
feedback.alert, feedback.toast, feedback.empty, feedback.loading,
feedback.error, feedback.progress, feedback.skeleton
overlay.modal, overlay.drawer, overlay.popover, overlay.tooltip, overlay.menu
typography.h1..h6, typography.body, typography.caption, typography.label, typography.mono
```

Every role should map to a key in `.stylesync/components.md` or a documented
fallback (apply the closest matching role's recipe and note the substitution
in your final report). Don't invent a new role — if nothing fits, say so.
