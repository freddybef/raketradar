<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:raketradar-workflow-rules -->
# RaketRadar workflow

Use this repository as the single canonical working tree on `origin/main`.

Do not create recovery clones, parallel worktrees, or push-fix directories for normal implementation passes. If Git needs recovery, clean the current tree first and keep temporary files outside committed paths or in ignored scratch files.

Terminal v2 snapshot code lives under `src/lib/terminalV2/` while the app route remains `/terminal-v2`.
<!-- END:raketradar-workflow-rules -->
