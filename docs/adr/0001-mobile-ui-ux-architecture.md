# 0001: Mobile UI/UX Architecture

We decided to adapt TerrainForge 3D for touch devices (<768px viewports) by replacing the fixed desktop sidebar with a collapsible bottom sheet (`Mobile Control Sheet`) and defaulting from a 5-canvas grid view to a single focused 3D canvas with horizontal touch swipe gestures (`Mobile Viewport Switcher`). Additionally, canvas touch interactions use `touch-action: none` to isolate orbit/zoom gestures from page scrolling, and desktop hover tooltips are replaced by tap-activated modal popovers (`ⓘ` targets). This trade-off prevents WebGL GPU context exhaustion and viewport crowding on mobile GPUs while ensuring smooth 60fps interaction and full-screen terrain visibility.

## Considered Options

- **Desktop Fixed Sidebar on Mobile**: Squeezes or completely obscures the WebGL canvas viewport.
- **5-Way Canvas Grid on Mobile**: Causes WebGL context limits/losses, battery/thermal throttling, and unusable canvas viewports on small screens.
- **Hover Tooltips on Touch**: Non-functional or buggy on touch interfaces.
